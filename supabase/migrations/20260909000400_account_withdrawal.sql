-- =============================================================================
-- 20260909000400_account_withdrawal
-- 회원 탈퇴(2단계 소프트 삭제) · 재가입 복구 · 90일 후 개인정보 파기.
-- 설계 문서: docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md
--
--   active ──탈퇴(deleted_at=now())──▶ withdrawn ──90일·배치──▶ purged(익명화 행 유지)
--                 ◀──재로그인 복구(deleted_at=null)──┘
--
-- 이 마이그레이션이 다루는 것
--   1) profiles.deleted_at / purged_at + 인덱스
--   2) 월드 계정 중복 불가 — msw_uid(기존) · lower(msw_profile_code)(신규) 유니크 인덱스
--   3) profiles.id → auth.users FK 제거 — 파기 뒤 auth 계정을 지워도 익명화 행이 남아야 한다
--   4) is_withdrawn() + 쓰기 정책(posts/comments/post_likes/reports/inquiries)에 `not is_withdrawn()`
--   5) guard_profile_role() 확장 — 일반 사용자는 자기 deleted_at 만(지금 탈퇴 · 복구) 바꿀 수 있고
--      purged_at 은 서비스 롤/파기 함수만 쓴다
--   6) 감사 로그 트리거 — member.withdraw / member.restore (행위자 = 본인)
--   7) purge_withdrawn_profiles() — 90일 경과 프로필 익명화 + member.purge 로그. 서비스 롤 전용
--   8) pg_cron 스케줄(확장이 켜져 있을 때만) — Edge Function purge-withdrawn 을 매일 호출
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 상태 컬럼
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists purged_at  timestamptz;

comment on column public.profiles.deleted_at is
  '탈퇴 요청 시각. null 이면 정상 회원. 90일 안에 같은 간편로그인 계정으로 다시 로그인하면 null 로 되돌린다(복구). 제재(suspended_until)는 이 값과 무관하게 유지된다.';
comment on column public.profiles.purged_at is
  '개인정보 파기 시각. purge_withdrawn_profiles() 만 채운다. 이 값이 있으면 행은 익명화된 상태이고 복구할 수 없다. 화면은 작성자를 "탈퇴한 회원"으로 표시한다.';

-- 파기 배치가 "deleted_at <= 기준 시각 and purged_at is null" 로 훑는다.
create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at)
  where deleted_at is not null;

-- -----------------------------------------------------------------------------
-- 2. 월드 계정 중복 불가 (피드백 8 · 오너 결정 1)
--
-- msw_uid 유니크는 20260908001500 에 이미 있다(if not exists 로 다시 보장한다).
-- 프로필 코드는 저장 전에 소문자로 정규화되지만(lib/validation/auth.ts), DB 를 직접
-- 고친 값까지 막으려면 lower() 로 건다. 적용 시점(2026-09-09) 중복 점검 결과 0건.
-- -----------------------------------------------------------------------------
create unique index if not exists profiles_msw_uid_key
  on public.profiles (msw_uid)
  where msw_uid is not null;

create unique index if not exists profiles_msw_profile_code_key
  on public.profiles (lower(msw_profile_code))
  where msw_profile_code is not null;

-- -----------------------------------------------------------------------------
-- 3. auth.users FK 제거
--
-- 파기 순서는 "프로필 익명화 → auth.users 삭제(Edge Function, 서비스 롤)" 다.
-- `on delete cascade` 가 남아 있으면 auth 삭제 순간 익명화된 프로필까지 사라지고,
-- 글·댓글의 author_id 가 null 로 비워져 "게시판에는 영향이 없다"(피드백 6)가 깨진다.
-- FK 를 다시 걸지 않는다 — 프로필을 만드는 경로는 handle_new_user() 트리거
-- (auth.users AFTER INSERT) 하나뿐이므로, auth 없는 프로필은 파기 배치에서만 생기고
-- 그것이 의도한 상태다. 개발용 스텁 계정 정리(supabase/README.md)도 이제 프로필을
-- 함께 지워야 한다.
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;

comment on table public.profiles is
  'auth.users 와 1:1 로 대응하는 서비스 프로필. id 는 auth.users.id 와 같지만 FK 는 걸지 않는다(20260909000400) — 파기 뒤 auth 계정만 지우고 익명화 행은 남긴다. 생성 경로는 handle_new_user() 트리거 하나다.';

-- -----------------------------------------------------------------------------
-- 4. is_withdrawn() + 쓰기 정책
--
-- is_suspended() 와 같은 구조(SECURITY INVOKER · 자기 행만 읽는다). 탈퇴 대기 중에는
-- 화면이 /auth/restore 로 보내지만, 서버 액션은 직접 POST 로도 호출되므로 최종
-- 방어선은 정책에 둔다. 정책 이름은 그대로 두고 조건만 한 줄씩 더한다.
-- -----------------------------------------------------------------------------
create or replace function public.is_withdrawn()
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
      and deleted_at is not null
  );
$$;

comment on function public.is_withdrawn() is
  'SECURITY INVOKER. 로그인 사용자가 탈퇴 대기(deleted_at 있음) 상태인지 판정한다. 쓰기 정책에서 not is_withdrawn() 으로 쓴다.';

revoke all on function public.is_withdrawn() from public;
revoke all on function public.is_withdrawn() from anon;
grant execute on function public.is_withdrawn() to authenticated, service_role;

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
    and not public.is_withdrawn()
  );

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and board = 'community'
    and deleted_at is null
    and not public.is_withdrawn()
  )
  with check (author_id = (select auth.uid()) and board = 'community');

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and deleted_at is null
    and not is_hidden
    and not public.is_suspended()
    and not public.is_withdrawn()
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.is_published
        and p.deleted_at is null
    )
  );

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and deleted_at is null
    and not public.is_withdrawn()
  )
  with check (author_id = (select auth.uid()));

drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.is_suspended()
    and not public.is_withdrawn()
    and exists (
      select 1
      from public.posts p
      where p.id = post_likes.post_id
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
    and not public.is_withdrawn()
    and public.can_report_target(target_type, target_id)
  );

drop policy if exists inquiries_insert_own on public.inquiries;
create policy inquiries_insert_own on public.inquiries
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and not public.is_withdrawn()
  );

drop policy if exists inquiries_update_own on public.inquiries;
create policy inquiries_update_own on public.inquiries
  for update to authenticated
  using (user_id = (select auth.uid()) and not public.is_withdrawn())
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 5. guard_profile_role() — 탈퇴 상태 컬럼 잠금
--
-- 20260909000200 의 정의를 그대로 옮기고 일반 사용자 분기에 다음을 더한다.
--   * deleted_at 을 바꿀 때: null 로 만드는 것(복구)과 채우는 것(탈퇴)만 허용한다.
--     채울 때는 값이 무엇이든 now() 로 고정한다 — 과거 시각을 넣어 파기를 앞당기거나
--     먼 미래를 넣어 영원히 보존 상태로 두는 요청이 통하지 않는다.
--   * 파기가 끝난(purged_at 있음) 프로필은 복구할 수 없다.
--   * purged_at 은 누구도(관리자 포함) 직접 쓰지 못한다. 파기 함수(SECURITY DEFINER,
--     소유자 postgres)와 서비스 롤만 첫 분기로 통과한다.
--
-- ▲ SECURITY INVOKER 여야 한다(20260908001000 · 20260908001700 참고).
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  -- 파기 시각은 파기 함수만 쓴다. 관리자의 "즉시 파기"도 그 함수를 거친다.
  new.purged_at := old.purged_at;

  if public.is_admin() then
    -- 관리자끼리도 등급이 있다. 권한 승격은 슈퍼어드민 한 곳으로 모은다.
    if not public.is_super_admin() then
      new.role := old.role;
      new.admin_role_id := old.admin_role_id;
    end if;

    return new;
  end if;

  new.role := old.role;
  new.admin_role_id := old.admin_role_id;
  new.id := old.id;
  new.created_at := old.created_at;
  new.email := old.email;
  new.provider := old.provider;
  new.provider_id := old.provider_id;
  -- 제재 상태는 운영자만 바꾼다. 이 두 줄이 is_suspended() 의 근거를 지킨다.
  new.suspended_until := old.suspended_until;
  new.suspension_reason := old.suspension_reason;

  -- 탈퇴 상태: 본인은 "지금 탈퇴"와 "복구"만 할 수 있다.
  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null then
      if old.purged_at is not null then
        new.deleted_at := old.deleted_at;
      end if;
    else
      new.deleted_at := now();
    end if;
  end if;

  return new;
end;
$$;

comment on function public.guard_profile_role() is
  'SECURITY INVOKER 여야 한다. role·admin_role_id 는 슈퍼어드민(또는 서비스 롤)만, purged_at 은 서비스 롤/파기 함수만 바꿀 수 있다. 일반 사용자는 자기 deleted_at 을 now() 로 채우거나(탈퇴) 비우는 것(복구)만 할 수 있다.';

-- -----------------------------------------------------------------------------
-- 6. 감사 로그 — member.withdraw / member.restore
--
-- audit_logs_insert_admin 정책은 관리자만 통과시키므로 사용자 사이트의 서버 액션은
-- 로그를 직접 쓸 수 없다. 대신 deleted_at 이 바뀌는 순간 트리거가 남긴다.
-- SECURITY DEFINER(소유자 postgres = 테이블 소유자) 라 RLS 를 타지 않는다.
-- 행위자는 auth.uid() — 본인이 탈퇴/복구한 것이고, 서비스 롤 경로에서는 null 이다.
-- -----------------------------------------------------------------------------
create or replace function public.log_profile_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lifecycle_action text;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    lifecycle_action := 'member.withdraw';
  elsif old.deleted_at is not null and new.deleted_at is null then
    lifecycle_action := 'member.restore';
  else
    return new;
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, "before", "after")
  values (
    (select auth.uid()),
    lifecycle_action,
    'profiles',
    new.id::text,
    jsonb_build_object('deleted_at', old.deleted_at),
    jsonb_build_object('deleted_at', new.deleted_at)
  );

  return new;
end;
$$;

comment on function public.log_profile_lifecycle() is
  '트리거 전용. profiles.deleted_at 이 채워지면 member.withdraw, 비워지면 member.restore 를 audit_logs 에 남긴다. 행위자는 auth.uid()(본인).';

revoke all on function public.log_profile_lifecycle() from public;
revoke all on function public.log_profile_lifecycle() from anon;
revoke all on function public.log_profile_lifecycle() from authenticated;

drop trigger if exists log_profile_lifecycle on public.profiles;
create trigger log_profile_lifecycle
  after update of deleted_at on public.profiles
  for each row execute function public.log_profile_lifecycle();

-- -----------------------------------------------------------------------------
-- 7. purge_withdrawn_profiles(p_cutoff)
--
-- 90일(기본값)이 지난 탈퇴 프로필의 개인정보를 지운다. 행은 남긴다 — 글·댓글의
-- author_id 가 살아 있어야 게시판이 그대로다(피드백 6). 화면은 닉네임 접두사
-- "탈퇴한 회원#" 을 보고 고정 문구 "탈퇴한 회원"으로 그린다(lib/utils/author-display.ts).
-- 닉네임 규칙(한글·영문·숫자·밑줄)상 실제 회원은 공백·'#' 을 쓸 수 없어 충돌하지 않고,
-- lower(nickname) 유니크 인덱스는 id 조각으로 만족한다.
--
-- 함께 지우는 것: email · 간편로그인 식별자(provider_id) · 아바타 · 월드 UID · 프로필
-- 코드 · 제재(식별 근거가 사라졌으므로 — 피드백 5). 글·댓글의 author_name 스냅샷도
-- 같은 익명 닉네임으로 바꾼다 — 공개 조회는 profiles 를 읽을 수 없으므로 스냅샷이
-- 화면의 유일한 근거다.
--
-- auth.users 삭제는 여기서 하지 않는다(DB 함수가 auth 스키마를 직접 지우는 것은
-- Supabase 가 권장하지 않는다). 처리한 id 를 돌려주면 Edge Function
-- `purge-withdrawn` 이 서비스 롤로 auth.admin.deleteUser 를 부른다. 그쪽이 실패하면
-- purged_at 을 비워 다음 날 다시 태운다.
--
-- SECURITY DEFINER 인 이유: RLS 밖에서 여러 프로필·글을 한 트랜잭션으로 고쳐야 하고,
-- 가드 트리거(guard_profile_role · guard_post_counters)는 소유자(postgres)를 신뢰
-- 경로로 통과시킨다. 실행 권한은 service_role 에만 준다.
-- -----------------------------------------------------------------------------
create or replace function public.purge_withdrawn_profiles(p_cutoff interval default interval '90 days')
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  anonymized_nickname text;
begin
  for target in
    select id
    from public.profiles
    where deleted_at is not null
      and deleted_at <= now() - p_cutoff
      and purged_at is null
    order by deleted_at
    for update skip locked
  loop
    anonymized_nickname := '탈퇴한 회원#' || left(target.id::text, 8);

    update public.profiles
       set email = null,
           nickname = anonymized_nickname,
           avatar_url = null,
           provider_id = null,
           msw_uid = null,
           msw_profile_code = null,
           suspended_until = null,
           suspension_reason = null,
           purged_at = now()
     where id = target.id;

    update public.posts
       set author_name = anonymized_nickname
     where author_id = target.id
       and author_name is distinct from anonymized_nickname;

    update public.comments
       set author_name = anonymized_nickname
     where author_id = target.id
       and author_name is distinct from anonymized_nickname;

    insert into public.audit_logs (actor_id, action, target_table, target_id, "before", "after")
    values (
      null,
      'member.purge',
      'profiles',
      target.id::text,
      null,
      jsonb_build_object('purged_at', now(), 'cutoff', p_cutoff::text)
    );

    return next target.id;
  end loop;

  return;
end;
$$;

comment on function public.purge_withdrawn_profiles(interval) is
  'SECURITY DEFINER · service_role 전용. deleted_at 이 기준 기간을 넘긴 프로필의 개인정보를 지우고(행은 익명화해 유지) member.purge 를 남긴다. 처리한 id 를 돌려주며, auth.users 삭제는 호출자(Edge Function purge-withdrawn)가 한다.';

revoke all on function public.purge_withdrawn_profiles(interval) from public;
revoke all on function public.purge_withdrawn_profiles(interval) from anon;
revoke all on function public.purge_withdrawn_profiles(interval) from authenticated;
grant execute on function public.purge_withdrawn_profiles(interval) to service_role;

-- -----------------------------------------------------------------------------
-- 8. 일일 스케줄 (pg_cron + pg_net 이 켜져 있을 때만)
--
-- 매일 18:00 UTC(03:00 KST) 에 Edge Function purge-withdrawn 을 부른다. 함수는
-- `x-cron-secret` 헤더가 자기 secret(CRON_SECRET)과 같을 때만 동작하고, 그 값은
-- Vault 의 `purge_withdrawn_cron_secret` 에서 읽는다 — 마이그레이션 파일에 비밀을
-- 적지 않기 위해서다.
--
-- 적용 시점(2026-09-09) 프로젝트에는 두 확장이 켜져 있지 않아 이 블록은 안내만
-- 남기고 지나간다. 켠 뒤에는 이 DO 블록을 SQL 편집기에서 그대로 실행하면 된다
-- (`cron.schedule` 은 같은 이름이면 갱신한다).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net')
  then
    perform cron.schedule(
      'purge-withdrawn-daily',
      '0 18 * * *',
      $job$
        select net.http_post(
          url := 'https://zafouiovmsfebfkjuyos.supabase.co/functions/v1/purge-withdrawn',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'purge_withdrawn_cron_secret'
              limit 1
            )
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
        );
      $job$
    );
  else
    raise notice 'pg_cron/pg_net 이 꺼져 있어 purge-withdrawn-daily 스케줄을 만들지 않았습니다. 확장을 켠 뒤 20260909000400 의 8절 DO 블록을 실행하세요.';
  end if;
end
$$;
