-- =============================================================================
-- 20260908001700_admin_foundation
-- 관리자 사이트(`admin/`, @maple/admin) 1단계 기반 스키마.
--
-- 이 마이그레이션이 다루는 여섯 가지
--   1) `admin_invites`  — 관리자 초대 허용 목록(allow-list). 권한 승격의 유일한 근거.
--   2) 회원 제재         — `profiles.suspended_until` / `suspension_reason` +
--                          `is_suspended()` 를 쓰기 정책에 물린다.
--   3) 운영 숨김         — `posts.is_hidden` / `comments.is_hidden`.
--                          소프트 삭제(deleted_at, 작성자 행위)와 구분되는 운영 행위다.
--   4) `audit_logs`     — 관리자 행위 감사 로그. 관리자만 읽고 쓴다.
--   5) `handle_new_user()` 개편 — 초대장이 있는 이메일에만 role='admin' 을 준다.
--   6) 가드 트리거 확장  — 사용자가 자기 제재/숨김 상태를 되돌리지 못하게 막는다.
--
-- 설계 원칙(기존 마이그레이션과 동일)
--   * role 과 제재 상태는 **절대** 클라이언트 입력으로 채우지 않는다.
--   * 목록 필터링은 뷰가 아니라 RLS 정책으로 한다(20260908000700 과 같은 방식).
--     따라서 숨김 처리는 SELECT 정책에 조건을 더하는 것으로 끝난다.
--   * `auth.uid()` 는 `(select auth.uid())` 로 감싸 InitPlan 으로 한 번만 계산한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. admin_invites
--
-- 관리자 승격의 단일 근거다. Supabase 의 `auth.admin.inviteUserByEmail()` 이
-- 메일과 1회용 토큰을 책임지므로 여기서 토큰을 다시 발급하지 않는다
-- (`token_hash` 는 자체 초대 메일로 갈아탈 때를 위한 자리다).
--
-- 이 테이블이 없으면 "초대받았다"는 사실이 auth 스키마에만 남아 트리거가 확인할
-- 수 없다. handle_new_user() 는 여기 pending 행이 있을 때만 role 을 올린다.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid references public.profiles (id) on delete set null,
  token_hash text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint admin_invites_status_check check (status in ('pending', 'accepted', 'revoked'))
);

comment on table public.admin_invites is
  '관리자 초대 허용 목록. handle_new_user() 가 pending 행을 찾은 이메일에만 role=admin 을 부여한다.';
comment on column public.admin_invites.token_hash is
  'Supabase 초대 메일을 쓰는 동안에는 비어 있다. 자체 초대 링크로 전환할 때 해시를 담는다.';
comment on column public.admin_invites.status is
  'pending(발송) → accepted(가입 완료) | revoked(회수). revoked 행은 승격 근거가 되지 않는다.';

-- 대소문자만 다른 중복 초대를 막는다. 조회도 항상 lower(email) 로 한다.
create unique index if not exists admin_invites_email_key
  on public.admin_invites (lower(email));

create index if not exists admin_invites_status_created_idx
  on public.admin_invites (status, created_at desc);

alter table public.admin_invites enable row level security;

-- Supabase 의 `alter default privileges ... grant all on tables to anon,
-- authenticated` 때문에 새 테이블은 만들자마자 두 롤에 전권이 붙는다. 회수하고
-- 필요한 것만 다시 준다(권한 + 정책, 두 겹).
revoke all on public.admin_invites from anon;
revoke all on public.admin_invites from authenticated;
grant select, insert, update on public.admin_invites to authenticated;
grant all on public.admin_invites to service_role;

drop policy if exists admin_invites_admin_all on public.admin_invites;
create policy admin_invites_admin_all on public.admin_invites
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE 정책은 두지 않는다. 초대 이력은 남기고 status='revoked' 로만 종결한다.

-- -----------------------------------------------------------------------------
-- 2. 회원 제재
--
-- 정지는 "읽기는 되고 쓰기만 막힌다". 계정을 지우거나 로그인을 끊으면 사용자가
-- 자기 글·문의 내역을 확인할 수 없어 이의 제기 경로까지 함께 사라진다.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists suspended_until   timestamptz,
  add column if not exists suspension_reason text;

comment on column public.profiles.suspended_until is
  '이 시각까지 글·댓글·신고·좋아요 작성이 막힌다. null 이면 제재 없음. 영구 정지는 먼 미래 시각으로 표현한다.';
comment on column public.profiles.suspension_reason is
  '제재 사유. 사용자에게 그대로 노출되므로 내부 메모가 아니라 안내 문구를 넣는다.';

create index if not exists profiles_suspended_until_idx
  on public.profiles (suspended_until)
  where suspended_until is not null;

-- -----------------------------------------------------------------------------
-- is_suspended()
--
-- SECURITY INVOKER 여야 한다(요구 사항). 호출자 기준으로 profiles 를 읽으므로
-- `profiles_select_self` 정책을 타고 자기 행만 본다 — 남의 제재 여부는 이 함수로
-- 알아낼 수 없다. DEFINER 로 두면 RLS 를 우회해 조회 표면이 넓어진다.
--
-- INVOKER 의 대가는 "읽지 못하면 false(=제재 없음)"라는 열린 실패다. 그 구멍은
-- 아래 guard_profile_role() 확장이 막는다 — 사용자는 애초에 자기
-- suspended_until 을 지울 수 없고, 자기 프로필 행은 언제나 읽을 수 있다.
-- -----------------------------------------------------------------------------
create or replace function public.is_suspended()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and suspended_until is not null
      and suspended_until > now()
  );
$$;

comment on function public.is_suspended() is
  'SECURITY INVOKER. 로그인 사용자가 현재 제재 중인지 판정한다. 쓰기 정책(posts/comments/reports/post_likes insert)에서만 쓴다.';

revoke all on function public.is_suspended() from public;
revoke all on function public.is_suspended() from anon;
grant execute on function public.is_suspended() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. 운영 숨김 (posts.is_hidden / comments.is_hidden)
--
-- `deleted_at` 은 작성자의 삭제, `is_hidden` 은 운영자의 숨김이다. 두 축을 나눠야
-- "운영자가 숨긴 글을 작성자가 되살리는" 경로가 생기지 않고, 신고 처리 이력에서
-- 무엇이 운영 조치였는지 구분된다.
-- -----------------------------------------------------------------------------
alter table public.posts    add column if not exists is_hidden boolean not null default false;
alter table public.comments add column if not exists is_hidden boolean not null default false;

comment on column public.posts.is_hidden is
  '운영자 숨김. deleted_at(작성자 삭제)과 구분한다. 숨겨진 글은 관리자 외에는 조회되지 않는다.';
comment on column public.comments.is_hidden is
  '운영자 숨김. deleted_at(작성자 삭제)과 구분한다.';

-- 공개 목록 인덱스의 조건절에도 숨김을 반영한다. 그러지 않으면 아래 정책이
-- 인덱스를 벗어나 순차 스캔으로 떨어진다.
drop index if exists public.posts_board_published_idx;
create index posts_board_published_idx
  on public.posts (board, is_pinned desc, published_at desc)
  where is_published and deleted_at is null and not is_hidden;

drop index if exists public.posts_board_category_idx;
create index posts_board_category_idx
  on public.posts (board, category_key, published_at desc)
  where is_published and deleted_at is null and not is_hidden;

-- 관리자 큐: 숨김 처리된 것만 빠르게 뽑는다.
create index if not exists posts_hidden_idx
  on public.posts (updated_at desc)
  where is_hidden;

create index if not exists comments_hidden_idx
  on public.comments (updated_at desc)
  where is_hidden;

-- -----------------------------------------------------------------------------
-- 숨김 반영 — SELECT 정책
--
-- 이 스키마는 공개 목록을 뷰가 아니라 정책으로 거른다(20260908000700). 따라서
-- 조건을 더할 곳도 정책 한 곳뿐이고, 클라이언트 쿼리는 손댈 필요가 없다.
-- 관리자용 `posts_select_admin` / `comments_select_admin` 은 그대로 두어
-- 관리자만 숨겨진 행을 본다.
-- -----------------------------------------------------------------------------
drop policy if exists posts_select_published on public.posts;
create policy posts_select_published on public.posts
  for select to anon, authenticated
  using (is_published and deleted_at is null and not is_hidden and published_at <= now());

/* 작성자에게도 숨긴다. 여기에 예외를 두면 "숨겼는데 당사자에게는 그대로 보이는"
   상태가 되어 운영 조치가 무의미해진다. 이의 제기는 고객지원 문의로 받는다. */
drop policy if exists posts_select_own on public.posts;
create policy posts_select_own on public.posts
  for select to authenticated
  using (author_id = (select auth.uid()) and not is_hidden);

drop policy if exists comments_select_public on public.comments;
create policy comments_select_public on public.comments
  for select to anon, authenticated
  using (
    deleted_at is null
    and not is_hidden
    and exists (
      select 1
      from public.posts p
      where p.id = comments.post_id
        and p.is_published
        and p.deleted_at is null
        and not p.is_hidden
    )
  );

-- -----------------------------------------------------------------------------
-- 4. 제재 반영 — INSERT 정책
--
-- 서버 액션에서도 같은 검사를 하지만, 액션은 UI 를 거치지 않는 직접 POST 로도
-- 호출된다. 최종 방어선은 DB 에 둔다.
-- -----------------------------------------------------------------------------
drop policy if exists posts_insert_community on public.posts;
create policy posts_insert_community on public.posts
  for insert to authenticated
  with check (
    board = 'community'
    and author_id = (select auth.uid())
    and deleted_at is null
    and is_published
    and not is_pinned
    and not is_hidden
    and not public.is_suspended()
  );

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and deleted_at is null
    and not is_hidden
    and not public.is_suspended()
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.is_published
        and p.deleted_at is null
    )
  );

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and not public.is_suspended()
    and public.can_report_target(target_type, target_id)
  );

drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.is_suspended()
    and exists (
      select 1
      from public.posts p
      where p.id = post_likes.post_id
        and p.is_published
        and p.deleted_at is null
    )
  );

-- -----------------------------------------------------------------------------
-- 5. 가드 트리거 확장
--
-- 정책은 "어느 행을" 까지만 판별한다. "어느 컬럼을" 은 표현할 수 없어(컬럼 단위
-- WITH CHECK 이 없다) 가드 트리거가 맡아 왔다. 새로 생긴 운영 컬럼도 같은 방식으로
-- 잠근다. 이 확장이 없으면 사용자가 profiles_update_self / posts_update_own 으로
-- 자기 제재·숨김을 스스로 해제할 수 있다.
--
-- ▲ 보안 회귀 수정 — guard_profile_role() 은 SECURITY **INVOKER** 여야 한다.
--
--   20260908001000 이 이 함수를 INVOKER 로 고쳤는데(사유: DEFINER 안에서는
--   `current_user` 가 호출자가 아니라 **함수 소유자**로 평가되어 첫 분기
--   `current_user in ('postgres', 'supabase_admin', 'service_role')` 가 항상 참이
--   되고, 가드가 통째로 무력화된다), 20260908001200 이 본문을 확장하면서 보안
--   속성을 `security definer` 로 되돌려 구멍이 되살아나 있었다.
--
--   실제 확인(2026-09-08, 일반 사용자 JWT): `update profiles set suspended_until =
--   null where id = <본인>` 이 그대로 반영됐다. 같은 경로로 `role = 'admin'` 도
--   통과한다 — 즉 **누구나 관리자로 승격**할 수 있는 상태였다.
--
--   아래 정의는 INVOKER 로 고정한다. 신뢰 경로는 그대로 남는다: 서비스 롤은
--   `current_user = service_role`, 관리자는 `public.is_admin()` 분기로 통과한다.
--
-- 나머지 두 함수는 기존 정의(INVOKER)를 그대로 옮기고 새 줄만 더한다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.is_admin()
  then
    return new;
  end if;

  new.role := old.role;
  new.id := old.id;
  new.created_at := old.created_at;
  new.email := old.email;
  new.provider := old.provider;
  new.provider_id := old.provider_id;
  -- 제재 상태는 운영자만 바꾼다. 이 두 줄이 is_suspended() 의 근거를 지킨다.
  new.suspended_until := old.suspended_until;
  new.suspension_reason := old.suspension_reason;

  return new;
end;
$$;

comment on function public.guard_profile_role() is
  'SECURITY INVOKER 여야 한다. DEFINER 로 두면 current_user 가 소유자로 평가되어 누구나 자기 role·제재 상태를 바꿀 수 있다(20260908001000 참고).';

create or replace function public.guard_post_counters()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(current_setting('app.counter_bypass', true), 'off') = 'on'
     or public.is_admin()
  then
    return new;
  end if;

  new.view_count := old.view_count;
  new.comment_count := old.comment_count;
  new.like_count := old.like_count;
  new.board := old.board;
  new.is_pinned := old.is_pinned;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.is_published := old.is_published;
  new.published_at := old.published_at;
  new.created_at := old.created_at;
  -- 운영 숨김은 관리자만 되돌린다.
  new.is_hidden := old.is_hidden;
  /* edited_at 은 mark_post_edited() 트리거만 채운다. 여기서 되돌려 두면
     본문을 고치지 않고 표시만 지우거나 위조하는 요청이 통하지 않는다. */
  new.edited_at := old.edited_at;

  return new;
end;
$$;

create or replace function public.guard_comment_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.is_admin()
  then
    return new;
  end if;

  new.post_id := old.post_id;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.created_at := old.created_at;
  new.is_hidden := old.is_hidden;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. audit_logs
--
-- 관리자 서버 액션이 "누가·언제·무엇을" 남기는 곳이다. before/after 를 jsonb 로
-- 통째로 담아 스키마가 바뀌어도 이력이 깨지지 않게 한다.
--
-- target_id 를 uuid 가 아닌 text 로 두는 이유: 대상이 uuid 인 테이블만 있는 게
-- 아니다(site_settings 는 단일 행 키, 랭킹 스냅샷은 복합 키가 될 수 있다).
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  "before" jsonb,
  "after" jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  '관리자 행위 감사 로그. 관리자만 읽고 쓸 수 있으며 수정·삭제 정책은 두지 않는다(추가 전용).';
comment on column public.audit_logs.actor_id is
  '행위자. 탈퇴해도 이력은 남아야 하므로 on delete set null 이다(로그 행 자체는 지우지 않는다).';
comment on column public.audit_logs.target_id is
  '대상 행 식별자. uuid 가 아닌 키(단일 행 설정 등)도 담을 수 있게 text 로 둔다.';

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_table, target_id);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon;
revoke all on public.audit_logs from authenticated;
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_logs_insert_admin on public.audit_logs;
create policy audit_logs_insert_admin on public.audit_logs
  for insert to authenticated
  with check (public.is_admin() and actor_id = (select auth.uid()));

-- UPDATE/DELETE 정책은 두지 않는다. 감사 로그는 추가 전용이어야 의미가 있다.

-- -----------------------------------------------------------------------------
-- 7. handle_new_user() — 초대 기반 관리자 승격
--
-- 20260908001200 의 정의를 그대로 유지하면서 role 결정만 추가한다.
--
--  * role 은 여전히 raw_user_meta_data 에서 절대 읽지 않는다. 읽으면 클라이언트가
--    signUp 옵션에 role:'admin' 을 실어 스스로 관리자가 될 수 있다(권한 상승).
--  * 유일한 근거는 `admin_invites` 의 pending 행이다. 그 행은 관리자만 만들 수
--    있고(RLS), 초대 서버 액션이 서비스 롤로 넣는다.
--  * 승격에 성공하면 같은 트랜잭션에서 초대를 accepted 로 닫는다. 초대장 하나가
--    두 계정을 관리자로 만들 수 없다.
--
-- inviteUserByEmail() 은 초대 메일 발송 시점에 auth.users 행을 만든다. 따라서 이
-- 트리거는 "초대를 보낸 순간" 돈다 — 초대 행 insert 가 메일 발송보다 먼저여야 한다
-- (admin/lib/actions/admin-actions.ts 가 그 순서를 지킨다).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app_provider text;
  meta_provider text;
  resolved_provider text;
  resolved_provider_id text;
  resolved_avatar text;
  resolved_role public.user_role := 'user';
  invite_id uuid;
  base_nickname text;
  candidate text;
  attempt integer := 0;
begin
  app_provider := nullif(new.raw_app_meta_data ->> 'provider', '');
  meta_provider := nullif(new.raw_user_meta_data ->> 'provider', '');

  -- 익명/이메일은 "실제로 누른 버튼"을 알려 주지 못한다. 그때만 메타데이터를 믿는다.
  if app_provider is null or app_provider in ('email', 'anonymous') then
    resolved_provider := coalesce(meta_provider, app_provider, 'email');
  else
    resolved_provider := app_provider;
  end if;

  if resolved_provider not in ('google', 'kakao', 'naver', 'email', 'anonymous') then
    resolved_provider := 'email';
  end if;

  resolved_provider_id := coalesce(
    nullif(new.raw_user_meta_data ->> 'provider_id', ''),
    nullif(new.raw_user_meta_data ->> 'sub', '')
  );

  resolved_avatar := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', ''),
    nullif(new.raw_user_meta_data ->> 'profile_image', '')
  );

  -- 관리자 승격의 유일한 경로. 초대장이 없으면 조용히 일반 사용자로 남는다.
  if new.email is not null and new.email <> '' then
    select id
      into invite_id
      from public.admin_invites
     where lower(email) = lower(new.email)
       and status = 'pending'
     order by created_at
     limit 1;

    if invite_id is not null then
      resolved_role := 'admin';
    end if;
  end if;

  base_nickname := coalesce(
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '유저'
  );

  -- 닉네임 규칙(한글·영문·숫자·밑줄)에 맞게 다듬는다. 공백이 섞인 구글 이름을
  -- 그대로 넣으면 온보딩 폼이 곧바로 반려한다.
  base_nickname := left(regexp_replace(base_nickname, '[^0-9A-Za-z가-힣_]', '', 'g'), 10);

  if base_nickname = '' then
    base_nickname := '유저';
  end if;

  candidate := base_nickname;

  -- 닉네임에는 대소문자 무시 유니크 인덱스가 걸려 있다. 여기서 충돌을 해소하지
  -- 않으면 두 번째 가입이 통째로 실패한다(트리거 예외 = 가입 실패).
  while attempt < 50
    and exists (select 1 from public.profiles where lower(nickname) = lower(candidate))
  loop
    attempt := attempt + 1;
    candidate := base_nickname || attempt::text;
  end loop;

  -- 50회로도 못 찾으면(비정상) uuid 조각으로 확정적으로 유일해진다.
  if attempt >= 50 then
    candidate := base_nickname || '-' || left(replace(new.id::text, '-', ''), 8);
  end if;

  insert into public.profiles (id, email, nickname, avatar_url, provider, provider_id, role)
  values (new.id, new.email, candidate, resolved_avatar, resolved_provider, resolved_provider_id, resolved_role)
  on conflict (id) do nothing;

  if invite_id is not null then
    update public.admin_invites
       set status = 'accepted',
           accepted_at = now()
     where id = invite_id;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'role 은 admin_invites 의 pending 행이 있을 때만 admin 이 된다. 사용자 메타데이터는 절대 근거가 되지 않는다.';
