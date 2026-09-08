-- =============================================================================
-- 20260908000200_profiles
-- auth.users 1:1 프로필. 닉네임/권한 등 서비스 도메인 값을 담는다.
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nickname text not null,
  avatar_url text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'auth.users 와 1:1 로 대응하는 서비스 프로필.';
comment on column public.profiles.role is
  '관리자 승격은 서비스 롤(또는 DB 콘솔)로만 수행한다. 클라이언트 update 는 RLS 로 차단된다.';
comment on column public.profiles.nickname is
  '화면에는 maskNickname() 을 거쳐 노출되지만 원본은 검색·중복확인을 위해 그대로 저장한다.';

-- 닉네임 중복 확인과 작성자 검색에 쓰인다.
create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
create index if not exists profiles_role_idx on public.profiles (role);
