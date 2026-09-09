-- =============================================================================
-- 20260909000200_admin_roles
-- 관리자 권한 체계 재구축 (2026-09-09 제품 결정).
--
-- 바뀌는 것
--   1) `admin_roles`            — 관리자 권한(역할). 모듈별 none/read/write 를 담는다.
--   2) `profiles.admin_role_id` — 관리자 한 명이 가지는 역할. role='admin' 과 짝을 이룬다.
--   3) `admin_invites`          — 초대에 역할(role_id)과 만료(expires_at)를 싣는다.
--   4) `handle_new_user()`      — 초대받은 이메일은 가입 시 role='admin' + 초대의 역할을 받는다.
--   5) `is_super_admin()`       — 역할 관리·관리자 관리의 권한 판정.
--   6) 가드 트리거              — 슈퍼어드민이 아니면 profiles.role / admin_role_id 를 못 바꾼다.
--                                 시스템 역할(super_admin)은 수정·삭제 자체가 막힌다.
--
-- 설계 원칙
--   * RLS 는 여전히 **거친 문(coarse gate)** 이다 — `is_admin()`(role='admin') 하나로
--     관리자 테이블 접근을 판정한다. 모듈별 read/write 는 **앱 계층**(requirePermission)이
--     강제한다. 역할을 정책에 녹이면 정책 수가 모듈×역할로 폭발하고, 역할을 추가할
--     때마다 마이그레이션이 필요해진다. 대신 역할을 바꿀 수 있는 경로(profiles.role ·
--     admin_role_id · admin_roles)는 DB 에서 슈퍼어드민으로 잠근다.
--   * role 과 admin_role_id 는 **절대** 클라이언트 입력으로 채우지 않는다.
--   * `auth.uid()` 는 `(select auth.uid())` 로 감싸 InitPlan 으로 한 번만 계산한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. admin_roles
--
-- `permissions` 는 `{ "<module>": "none" | "read" | "write" }` 모양이다. 모듈 목록은
-- 앱의 `admin/lib/auth/permissions.ts` 의 `ADMIN_MODULES` 와 짝을 이룬다. 열거형이
-- 아니라 jsonb 인 이유: 모듈이 늘 때마다 컬럼·enum 을 고치면 마이그레이션과 배포가
-- 묶여 버린다. 없는 키는 'none' 으로 읽는다(앱의 `hasPermission`).
--
-- `key` 는 만든 뒤 바꾸지 않는다. 시스템 역할 판정(`super_admin`)이 key 로 이뤄지고,
-- 감사 로그도 key 를 남기기 때문이다.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_roles_key_format check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint admin_roles_permissions_object check (jsonb_typeof(permissions) = 'object')
);

comment on table public.admin_roles is
  '관리자 권한(역할). permissions 는 모듈별 none/read/write 를 담은 jsonb 다. 세밀한 강제는 앱 계층(requirePermission)이 한다.';
comment on column public.admin_roles.key is
  '영문 slug. 생성 후 불변 — is_super_admin() 과 감사 로그가 이 값을 근거로 삼는다.';
comment on column public.admin_roles.is_system is
  '시스템 역할(super_admin)은 수정·삭제할 수 없다. 지우면 콘솔에 아무도 들어올 수 없게 된다.';

drop trigger if exists set_updated_at on public.admin_roles;
create trigger set_updated_at before update on public.admin_roles
  for each row execute function public.set_updated_at();

-- 기본 역할 두 개.
--   super_admin — 모든 모듈 write. 시스템 역할이라 화면에서 지울 수 없다.
--   editor      — 삭제 가능한 예시. 콘텐츠는 쓰고 운영 지표는 읽기만 한다.
insert into public.admin_roles (key, name, description, permissions, is_system)
values (
  'super_admin',
  '슈퍼어드민',
  '모든 모듈을 사용하고 관리자·권한을 관리합니다.',
  jsonb_build_object(
    'dashboard', 'write', 'news', 'write', 'community', 'write', 'reports', 'write',
    'members', 'write', 'inquiries', 'write', 'faqs', 'write', 'gacha', 'write',
    'rankings', 'write', 'settings', 'write', 'legal', 'write', 'admins', 'write',
    'audit', 'write'
  ),
  true
)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      permissions = excluded.permissions,
      is_system = true;

insert into public.admin_roles (key, name, description, permissions, is_system)
values (
  'editor',
  '콘텐츠 편집자',
  '콘텐츠(뉴스·커뮤니티·FAQ·가이드·Legal)를 작성하고, 운영 지표는 확인만 합니다.',
  jsonb_build_object(
    'dashboard', 'read', 'news', 'write', 'community', 'write', 'reports', 'read',
    'members', 'read', 'inquiries', 'read', 'faqs', 'write', 'gacha', 'write',
    'rankings', 'none', 'settings', 'none', 'legal', 'write', 'admins', 'none',
    'audit', 'none'
  ),
  false
)
on conflict (key) do nothing;

alter table public.admin_roles enable row level security;

-- Supabase 의 `alter default privileges … grant all on tables to anon, authenticated`
-- 때문에 새 테이블은 만들자마자 두 롤에 전권이 붙는다. 회수하고 필요한 것만 다시 준다
-- (권한 + 정책, 두 겹).
revoke all on public.admin_roles from anon;
revoke all on public.admin_roles from authenticated;
grant select, insert, update, delete on public.admin_roles to authenticated;
grant all on public.admin_roles to service_role;

-- -----------------------------------------------------------------------------
-- 2. profiles.admin_role_id
--
-- role='admin' 이 "콘솔에 들어올 수 있는가", admin_role_id 가 "무엇을 할 수 있는가"다.
-- 둘을 나눈 이유: RLS 는 전자만 보면 되고(거친 문), 후자가 바뀌어도 정책을 고칠 일이 없다.
--
-- on delete set null — 역할을 지우면 그 역할을 쓰던 관리자는 "권한 없음"으로 남는다.
-- 계정을 지우거나 role 을 내리는 것보다 안전한 실패다(앱은 아무 모듈도 보여 주지 않는다).
-- 실제로는 멤버가 있는 역할의 삭제를 화면에서 막는다.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists admin_role_id uuid references public.admin_roles (id) on delete set null;

comment on column public.profiles.admin_role_id is
  '관리자 역할. role=''admin'' 인 프로필만 값을 가진다. 슈퍼어드민만 바꿀 수 있다(guard_profile_role).';

create index if not exists profiles_admin_role_idx
  on public.profiles (admin_role_id)
  where admin_role_id is not null;

-- 백필: 기존 관리자(부트스트랩 계정 포함)는 전부 슈퍼어드민이다. 다른 값으로 두면
-- 이 마이그레이션 직후 아무도 관리자 화면을 쓸 수 없다.
update public.profiles p
   set admin_role_id = r.id
  from public.admin_roles r
 where r.key = 'super_admin'
   and p.role = 'admin'
   and p.admin_role_id is null;

-- 관리자가 아닌 프로필에 역할이 남아 있으면 승격 경로가 흐려진다. 정리해 둔다.
update public.profiles
   set admin_role_id = null
 where role <> 'admin'
   and admin_role_id is not null;

-- -----------------------------------------------------------------------------
-- 3. admin_invites — 역할 · 만료
--
-- 초대 메일의 링크는 Supabase 가 자체 수명(기본 24시간)을 갖는다. `expires_at` 은
-- **허용 목록의 수명**이다. 만료된 초대는 승격 근거가 되지 않으므로, 오래전에 보낸
-- 초대 메일이 어딘가에서 되살아나도 관리자가 만들어지지 않는다.
-- -----------------------------------------------------------------------------
alter table public.admin_invites
  add column if not exists role_id uuid references public.admin_roles (id) on delete set null,
  add column if not exists expires_at timestamptz;

comment on column public.admin_invites.role_id is
  '초대받은 사람이 가입 시 받게 될 역할. handle_new_user() 가 profiles.admin_role_id 로 옮긴다.';
comment on column public.admin_invites.expires_at is
  '허용 목록의 수명. 지난 초대는 pending 이어도 승격 근거가 되지 않는다. null 이면 만료 없음(부트스트랩).';

-- 기존 pending/accepted 초대에는 역할이 없다. 승격은 곧 슈퍼어드민이었으므로 그대로 채운다.
update public.admin_invites i
   set role_id = r.id
  from public.admin_roles r
 where r.key = 'super_admin'
   and i.role_id is null;

-- -----------------------------------------------------------------------------
-- 4. is_super_admin()
--
-- SECURITY DEFINER 다 — `is_admin()` 과 같은 이유로 RLS 를 타지 않고 자기 프로필과
-- 역할을 확인해야 한다(INVOKER 로 두면 admin_roles 정책이 다시 이 함수를 부르는
-- 재귀가 생긴다). `current_user` 를 보지 않으므로 DEFINER 로 인한 가드 무력화
-- (20260908001000 의 사고)는 발생하지 않는다.
-- -----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.admin_roles r on r.id = p.admin_role_id
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and r.key = 'super_admin'
  );
$$;

comment on function public.is_super_admin() is
  '로그인 사용자가 슈퍼어드민인가. 역할(admin_roles) 관리와 관리자 초대·삭제의 권한 판정에 쓴다.';

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_super_admin() from anon;
grant execute on function public.is_super_admin() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. admin_roles RLS
--
-- 읽기는 모든 관리자에게 연다 — 목록 화면이 역할 이름을 그려야 하고, 역할을 감춘다고
-- 얻는 보안도 없다. 쓰기는 슈퍼어드민뿐이다.
-- -----------------------------------------------------------------------------
drop policy if exists admin_roles_select_admin on public.admin_roles;
create policy admin_roles_select_admin on public.admin_roles
  for select to authenticated
  using (public.is_admin());

drop policy if exists admin_roles_insert_super on public.admin_roles;
create policy admin_roles_insert_super on public.admin_roles
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists admin_roles_update_super on public.admin_roles;
create policy admin_roles_update_super on public.admin_roles
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists admin_roles_delete_super on public.admin_roles;
create policy admin_roles_delete_super on public.admin_roles
  for delete to authenticated
  using (public.is_super_admin() and not is_system);

-- -----------------------------------------------------------------------------
-- 6. 시스템 역할 보호 트리거
--
-- 정책만으로는 부족하다. `is_system` 을 false 로 바꾼 뒤 지우는 2단계 우회가 가능하고,
-- 서비스 롤 클라이언트는 정책을 통째로 지나간다. 슈퍼어드민 역할이 사라지면 콘솔에
-- 아무도 들어올 수 없고 복구에는 직접 SQL 이 필요하다 — 그래서 DB 에서 잠근다.
--
-- 마이그레이션(postgres/supabase_admin)만 빠져나갈 수 있다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_admin_roles()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if current_user not in ('postgres', 'supabase_admin') and old.is_system then
      raise exception '시스템 역할은 삭제할 수 없습니다.' using errcode = '42501';
    end if;

    return old;
  end if;

  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if old.is_system then
    raise exception '시스템 역할은 수정할 수 없습니다.' using errcode = '42501';
  end if;

  -- key 는 불변이고, 일반 역할이 스스로 시스템 역할로 승격할 수도 없다.
  new.key := old.key;
  new.is_system := old.is_system;
  new.created_at := old.created_at;

  return new;
end;
$$;

comment on function public.guard_admin_roles() is
  '시스템 역할(super_admin)의 수정·삭제를 막고, key/is_system 을 불변으로 고정한다.';

drop trigger if exists guard_admin_roles on public.admin_roles;
create trigger guard_admin_roles before update or delete on public.admin_roles
  for each row execute function public.guard_admin_roles();

-- -----------------------------------------------------------------------------
-- 7. guard_profile_role() 확장 — 역할 승격은 슈퍼어드민만
--
-- 20260908001700 의 정의를 그대로 옮기고 두 가지를 더한다.
--   * 일반 사용자는 admin_role_id 도 바꿀 수 없다(role 과 같은 취급).
--   * **관리자라도** 슈퍼어드민이 아니면 role · admin_role_id 를 바꿀 수 없다.
--     이 줄이 없으면 'editor' 역할의 관리자가 REST 로 자기 admin_role_id 를
--     슈퍼어드민으로 바꿔 권한 체계를 통째로 무력화할 수 있다.
--
-- ▲ SECURITY INVOKER 여야 한다. DEFINER 로 두면 `current_user` 가 호출자가 아니라
--   함수 소유자로 평가되어 첫 분기가 항상 참이 되고 가드가 통째로 사라진다
--   (20260908001000 · 20260908001700 참고).
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

  return new;
end;
$$;

comment on function public.guard_profile_role() is
  'SECURITY INVOKER 여야 한다. role·admin_role_id 는 슈퍼어드민(또는 서비스 롤)만 바꿀 수 있다.';

-- -----------------------------------------------------------------------------
-- 8. handle_new_user() — 초대의 역할까지 옮긴다
--
-- 20260908001700 의 정의를 유지하면서 세 가지만 바꾼다.
--   * 만료된 초대는 승격 근거가 아니다(`expires_at`).
--   * 초대의 `role_id` 를 프로필의 `admin_role_id` 로 옮긴다.
--   * 역할이 비어 있는 옛 초대는 슈퍼어드민으로 떨어뜨리지 않는다 — 권한 없는
--     관리자로 만들고 슈퍼어드민이 화면에서 역할을 지정하게 한다(안전한 실패).
--
-- inviteUserByEmail() 은 메일 발송 시점에 auth.users 행을 만든다. 따라서 이 트리거는
-- "초대를 보낸 순간" 돈다 — 초대 행 insert 가 메일 발송보다 먼저여야 한다
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
  resolved_admin_role_id uuid;
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
    select id, role_id
      into invite_id, resolved_admin_role_id
      from public.admin_invites
     where lower(email) = lower(new.email)
       and status = 'pending'
       and (expires_at is null or expires_at > now())
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

  insert into public.profiles (
    id, email, nickname, avatar_url, provider, provider_id, role, admin_role_id
  )
  values (
    new.id, new.email, candidate, resolved_avatar, resolved_provider, resolved_provider_id,
    resolved_role,
    case when resolved_role = 'admin' then resolved_admin_role_id else null end
  )
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
  'role 은 admin_invites 의 유효한 pending 행이 있을 때만 admin 이 되고, 역할(admin_role_id)도 그 초대에서 온다. 사용자 메타데이터는 절대 근거가 되지 않는다.';
