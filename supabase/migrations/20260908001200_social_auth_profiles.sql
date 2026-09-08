-- =============================================================================
-- 20260908001200_social_auth_profiles
-- 간편로그인(구글·카카오·네이버) 전환.
--
--  * profiles 에 제공자 식별자와 동의 시각을 추가한다.
--  * handle_new_user() 가 소셜/익명 가입자의 메타데이터를 읽도록 고친다.
--  * 사용자가 제공자 식별자·이메일을 임의로 바꾸지 못하게 가드를 넓힌다.
--
-- 이메일·비밀번호 가입은 더 이상 쓰지 않는다. 기존 계정은 아래 백필로
-- "가입 시점에 약관에 동의한 것"으로 처리해 글쓰기가 막히지 않게 한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 컬럼 추가
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists provider          text,
  add column if not exists provider_id       text,
  add column if not exists avatar_url        text,
  add column if not exists terms_agreed_at   timestamptz,
  add column if not exists privacy_agreed_at timestamptz,
  add column if not exists age_confirmed_at  timestamptz;

comment on column public.profiles.provider is
  '가입에 사용한 인증 제공자. google | kakao | naver | email | anonymous.';
comment on column public.profiles.provider_id is
  '제공자가 발급한 회원 식별자. 스텁 로그인은 stub:<uid> 를 쓴다.';
comment on column public.profiles.terms_agreed_at is
  '이용약관 동의 시각. 세 동의 시각이 모두 있어야 글쓰기·댓글·문의가 열린다.';
comment on column public.profiles.age_confirmed_at is
  '만 14세 이상 확인 시각. 개인정보처리방침 제11조상 만 14세 미만은 가입할 수 없다.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_provider_check'
  ) then
    alter table public.profiles
      add constraint profiles_provider_check
      check (provider is null or provider in ('google', 'kakao', 'naver', 'email', 'anonymous'));
  end if;
end $$;

-- 같은 제공자의 같은 계정이 두 프로필로 갈라지지 않게 막는다.
-- provider_id 가 null 인 행(이메일 가입 등)은 유니크 판정에서 서로 구분된다.
create unique index if not exists profiles_provider_identity_key
  on public.profiles (provider, provider_id);

-- -----------------------------------------------------------------------------
-- 2. 기존 행 백필
-- 이메일 가입자는 가입 절차에서 약관에 동의했으므로 가입 시각을 동의 시각으로 본다.
-- 백필하지 않으면 기존 계정이 전부 온보딩으로 튕겨 글쓰기가 막힌다.
-- -----------------------------------------------------------------------------
update public.profiles
   set provider          = coalesce(provider, 'email'),
       terms_agreed_at   = coalesce(terms_agreed_at, created_at),
       privacy_agreed_at = coalesce(privacy_agreed_at, created_at),
       age_confirmed_at  = coalesce(age_confirmed_at, created_at)
 where provider is null
    or terms_agreed_at is null
    or privacy_agreed_at is null
    or age_confirmed_at is null;

-- -----------------------------------------------------------------------------
-- 3. handle_new_user()
-- 소셜 로그인은 제공자마다 메타데이터 키가 다르다.
--   * Supabase 는 OAuth 제공자를 raw_app_meta_data->>'provider' 에 넣는다.
--   * 구글: full_name / name / picture · avatar_url
--   * 카카오: name / user_name (kakao_account.profile.nickname 이 평탄화된 값)
--   * 네이버: nickname / profile_image
--   * 익명 로그인: 이메일이 없다. options.data 로 넘긴 값만 있다.
-- role 은 여전히 절대 메타데이터에서 읽지 않는다(권한 상승 방지).
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

  insert into public.profiles (id, email, nickname, avatar_url, provider, provider_id)
  values (new.id, new.email, candidate, resolved_avatar, resolved_provider, resolved_provider_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. 프로필 가드 확장
-- profiles_update_self 정책은 "본인 행"까지만 판별한다. 사용자가 바꿀 수 있는 것은
-- 닉네임 · 아바타 · 동의 시각뿐이고, 신원(이메일 · 제공자 식별자)과 권한은 고정한다.
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
  new.email := old.email;
  new.provider := old.provider;
  new.provider_id := old.provider_id;

  return new;
end;
$$;
