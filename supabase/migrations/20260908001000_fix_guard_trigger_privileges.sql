-- =============================================================================
-- 20260908001000_fix_guard_trigger_privileges
--
-- 보안 수정: 집계·권한 가드 트리거가 **아무것도 막지 못하고 있었다.**
--
-- 원인
--   `guard_post_counters()` 와 `guard_profile_role()` 는 20260908000600 에서
--   `security definer` 로 만들어졌다. SECURITY DEFINER 함수 안에서 `current_user`
--   는 **호출자가 아니라 함수 소유자**(마이그레이션을 적용한 `postgres`)로 평가된다.
--   두 함수의 첫 분기가
--
--       if current_user in ('postgres', 'supabase_admin', 'service_role') ...
--           then return new;
--
--   이므로 조건이 **항상 참**이 되어, 어떤 호출이든 신뢰 경로로 취급되고 가드가
--   그대로 통과했다.
--
-- 실제로 확인된 영향 (anon 키 + 일반 사용자 JWT, 2026-09-08)
--   1) PATCH /rest/v1/profiles?id=eq.<본인> {"role":"admin"}  → 200, role 이 admin 으로 저장됨.
--      `is_admin()` 기반 정책이 전부 열리므로 **누구나 관리자로 승격**할 수 있었다.
--   2) PATCH /rest/v1/posts?id=eq.<본인 글> {"view_count":123456,"like_count":999,"is_pinned":true}
--      → 200, 집계·고정 플래그가 그대로 반영됨.
--
-- 수정
--   두 함수를 `security invoker`(기본값)로 되돌린다. 그러면 `current_user` 가
--   PostgREST 가 `set local role` 로 지정한 **실효 롤**(anon / authenticated /
--   service_role)로 평가되어 분기가 의도대로 동작한다.
--
--   신뢰 경로는 그대로 유지된다.
--   - `increment_post_view()` · `sync_post_comment_count()` 는 SECURITY DEFINER 라
--     그 안에서의 `current_user` 가 `postgres` 이고, 세션 플래그
--     `app.counter_bypass` 도 함께 켠다 → 두 조건 모두로 통과한다.
--   - 서비스 롤 클라이언트(`lib/supabase/admin.ts`)는 `current_user = service_role`.
--   - 관리자는 `public.is_admin()` 분기로 통과한다.
--
--   함수 본문은 20260908000600 과 동일하다. 바뀐 것은 보안 속성뿐이다.
-- =============================================================================

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
  new.created_at := old.created_at;

  return new;
end;
$$;

comment on function public.guard_post_counters() is
  'SECURITY INVOKER 여야 한다. DEFINER 로 두면 current_user 가 소유자(postgres)로 평가되어 가드가 무력화된다.';

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

  return new;
end;
$$;

comment on function public.guard_profile_role() is
  'SECURITY INVOKER 여야 한다. DEFINER 로 두면 누구나 자기 role 을 admin 으로 바꿀 수 있다.';

-- 트리거는 함수를 이름으로 참조하므로 재생성이 필요 없지만, 어떤 이유로든
-- 빠져 있었다면 여기서 되살린다(idempotent).
drop trigger if exists guard_post_counters on public.posts;
create trigger guard_post_counters
  before update on public.posts
  for each row execute function public.guard_post_counters();

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 이미 스스로 승격한 계정이 있을 수 있다. 시드/개발 환경에서 승격시킨 관리자는
-- seed-users.md 절차대로 다시 지정한다.
--   update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'admin@example.com');
