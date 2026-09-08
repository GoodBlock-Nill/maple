-- =============================================================================
-- 20260908000600_functions_triggers
-- 공통 함수 · 트리거. 테이블이 모두 만들어진 뒤에 실행되어야 한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at 자동 갱신
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'board_categories', 'posts', 'comments',
    'inquiries', 'inquiry_replies', 'faqs',
    'site_settings', 'hero_banners', 'gacha_items'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', target);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      target
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- is_admin()
-- RLS 정책 안에서 profiles 를 직접 조회하면 profiles 의 정책이 다시 평가되어
-- 무한 재귀가 난다. SECURITY DEFINER 로 RLS 를 우회해 그 고리를 끊는다.
-- search_path 고정은 SECURITY DEFINER 함수의 스키마 하이재킹 방어책이다.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- handle_new_user()
-- 회원가입 직후 프로필을 만든다.
--
--  * role 은 절대 raw_user_meta_data 에서 읽지 않는다. 읽으면 클라이언트가 signUp
--    옵션에 role: 'admin' 을 실어 스스로 관리자가 될 수 있다(권한 상승).
--  * nickname 에는 대소문자 무시 유니크 인덱스가 걸려 있다. 여기서 충돌을 해소하지
--    않으면 "admin@a.com / admin@b.com" 처럼 앞부분이 같은 이메일의 두 번째 가입이
--    통째로 실패한다(트리거 예외 = signUp 실패).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_nickname text;
  candidate text;
  attempt integer := 0;
begin
  base_nickname := left(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nickname', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user'
    ),
    20
  );
  candidate := base_nickname;

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

  insert into public.profiles (id, email, nickname)
  values (new.id, new.email, candidate)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 집계 컬럼 보호
-- posts 의 update 정책은 "본인 글"까지만 판별할 수 있어서, 작성자가 조회수/좋아요를
-- 임의로 조작하는 것을 막지 못한다. 신뢰 경로(서비스 롤 · 관리자 · 아래 RPC)가
-- 아니면 집계·운영 컬럼을 이전 값으로 되돌린다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_post_counters()
returns trigger
language plpgsql
security definer
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
  new.created_at := old.created_at;

  return new;
end;
$$;

drop trigger if exists guard_post_counters on public.posts;
create trigger guard_post_counters
  before update on public.posts
  for each row execute function public.guard_post_counters();

-- -----------------------------------------------------------------------------
-- increment_post_view(p_id)
-- 조회수는 익명 사용자도 올릴 수 있어야 하므로 update 정책 대신 RPC 로 노출한다.
-- SECURITY DEFINER + 세션 로컬 플래그로 위 가드 트리거만 한시적으로 통과시킨다.
-- -----------------------------------------------------------------------------
create or replace function public.increment_post_view(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  perform set_config('app.counter_bypass', 'on', true);

  update public.posts
     set view_count = view_count + 1
   where id = p_id
     and is_published
     and deleted_at is null
  returning view_count into next_count;

  perform set_config('app.counter_bypass', 'off', true);

  return coalesce(next_count, 0);
end;
$$;

revoke all on function public.increment_post_view(uuid) from public;
grant execute on function public.increment_post_view(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 댓글 수 동기화
-- 목록에서 매번 count(*) 를 하면 게시글 수만큼 서브쿼리가 붙는다. 트리거로
-- posts.comment_count 를 유지해 목록 쿼리를 단일 테이블 스캔으로 끝낸다.
-- 소프트 삭제(deleted_at)도 감소로 취급한다.
-- -----------------------------------------------------------------------------
create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ids uuid[];
begin
  -- DELETE 트리거에서는 NEW 레코드가 존재하지 않으므로 TG_OP 로 분기해야 한다.
  if tg_op = 'DELETE' then
    target_ids := array[old.post_id];
  elsif tg_op = 'INSERT' then
    target_ids := array[new.post_id];
  else
    target_ids := array[old.post_id, new.post_id];
  end if;

  perform set_config('app.counter_bypass', 'on', true);

  update public.posts p
     set comment_count = (
       select count(*)
       from public.comments c
       where c.post_id = p.id
         and c.deleted_at is null
     )
   where p.id = any (target_ids);

  perform set_config('app.counter_bypass', 'off', true);

  return null;
end;
$$;

drop trigger if exists sync_post_comment_count on public.comments;
create trigger sync_post_comment_count
  after insert or delete or update of deleted_at, post_id on public.comments
  for each row execute function public.sync_post_comment_count();

-- -----------------------------------------------------------------------------
-- 프로필 권한 보호
-- "본인 행 수정" 정책만으로는 사용자가 자기 role 을 admin 으로 바꾸는 것을 막지
-- 못한다(WITH CHECK 안에서 같은 테이블을 조회하면 정책이 재귀한다). 트리거로
-- 신뢰 경로가 아닌 갱신의 role · id 변경을 되돌린다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
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

  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();
