-- =============================================================================
-- 20260908001500_profiles_msw
-- "내 정보"·온보딩에서 받는 메이플스토리 월드 계정 연동 정보.
--
--  * msw_uid            — 클라이언트 "설정 - 계정"에 보이는 숫자 UID.
--  * msw_profile_code   — 클라이언트 "더보기 - 프로필 편집"에 보이는 "#" 코드.
--
-- 둘 다 값 자체는 민감 정보가 아니지만(공개 프로필 식별자), 형식이 틀리면
-- 다른 화면(랭킹 연동 등)에서 조용히 실패하므로 DB 단에서도 CHECK 로 막는다.
-- 규칙은 lib/validation/auth.ts 의 정규식과 반드시 같아야 한다.
--
-- 소유자 갱신은 별도 정책이 필요 없다 — profiles_update_self 는 행 단위(본인
-- id) 정책이라 새 컬럼도 그대로 덮인다. guard_profile_role() 트리거는 role·id·
-- created_at·email·provider·provider_id 만 고정하므로 이 두 컬럼은 손대지 않는다.
-- =============================================================================

alter table public.profiles
  add column if not exists msw_uid          text,
  add column if not exists msw_profile_code text;

comment on column public.profiles.msw_uid is
  '메이플스토리 월드 계정 UID. 클라이언트 설정 - 계정에서 확인. 숫자 10~20자.';
comment on column public.profiles.msw_profile_code is
  '메이플스토리 월드 프로필 코드. 클라이언트 더보기 - 프로필 편집에서 확인. "#" + 영문 소문자·숫자 4~10자.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_msw_uid_check'
  ) then
    alter table public.profiles
      add constraint profiles_msw_uid_check
      check (msw_uid is null or msw_uid ~ '^[0-9]{10,20}$');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_msw_profile_code_check'
  ) then
    alter table public.profiles
      add constraint profiles_msw_profile_code_check
      check (msw_profile_code is null or msw_profile_code ~ '^#[a-z0-9]{4,10}$');
  end if;
end $$;

-- 같은 계정을 두 프로필이 대신 쓰지 못하게 막는다. null(아직 입력 전)은
-- 유니크 판정에서 서로 구분되므로 온보딩 전 사용자끼리는 충돌하지 않는다.
create unique index if not exists profiles_msw_uid_key
  on public.profiles (msw_uid)
  where msw_uid is not null;
