-- =============================================================================
-- 20260910000100_coupons
-- 쿠폰 발급(관리자) · 쿠폰 등록(사용자) · 지급 처리(관리자).
--
--   관리자 ──코드 발급──▶ coupons ──사용자가 코드 입력(RPC)──▶ coupon_redemptions
--                                                                  │
--                                          관리자가 게임팀에 UID 전달 후 처리
--                                          pending ──▶ delivered / rejected
--
-- 이 마이그레이션이 다루는 것
--   1) public.coupons          — 코드·기간·한도. 정규화 코드(code_normalized)로 조회한다.
--   2) public.coupon_redemptions — 등록 이력. 회원이 파기돼도 MSW 식별자만으로 남는다.
--   3) RLS — 코드는 열거 불가(일반 사용자 select 없음), 등록 이력은 본인 것만.
--   4) public.redeem_coupon()  — 사용자 사이트 마이페이지의 쿠폰 등록 폼이 부르는 유일한 입구.
--   5) profiles.name · marketing_sms_opt_out · marketing_email_opt_out (마이페이지 시안 §4)
--   6) storage 버킷 `avatars` — 마이페이지 프로필 이미지 업로드
--   7) admin_roles 시드에 `coupons` 모듈 추가 (super_admin 은 write 를 유지해야 한다)
--
-- 감사 로그는 **관리자 액션이** 남긴다(coupon.create · coupon_redemption.status …).
-- RPC 는 사용자 행위라 audit_logs_insert_admin 정책을 통과할 수 없고, 통과시키려고
-- SECURITY DEFINER 로 밀어 넣으면 "관리자 행위 기록"이라는 이 테이블의 뜻이 흐려진다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. coupons
--
-- 코드는 대문자·하이픈만 쓴다(`GLZA-XXXX-XXXX`). 사용자는 소문자로 치거나 붙여넣기에
-- 공백이 섞인 채로 넣으므로, 조회 키는 원문(code)이 아니라 **정규화 값**이어야 한다.
-- 하이픈은 지우지 않는다 — 지우면 `GLZA-TEST-0001` 과 `GLZAT-EST0-001` 이 같은 코드가
-- 되어, 오타로 남의 쿠폰을 등록하는 길이 열린다.
--
-- code_normalized 는 생성 열이다. 트리거로만 맞추면 SQL 편집기에서 직접 넣은 행이
-- 규칙 밖에 남고, 그 행은 사용자 입력으로 영영 찾을 수 없다.
-- -----------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  code_normalized text generated always as (
    upper(regexp_replace(code, '[[:space:]]', '', 'g'))
  ) stored,
  name text not null,
  description text,
  reward_note text,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  per_user_limit integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_shape check (code ~ '^[A-Z0-9][A-Z0-9-]{3,31}$'),
  constraint coupons_name_length check (char_length(name) between 1 and 60),
  constraint coupons_description_length check (description is null or char_length(description) <= 300),
  constraint coupons_reward_note_length check (reward_note is null or char_length(reward_note) <= 200),
  constraint coupons_window check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint coupons_max_redemptions_positive check (max_redemptions is null or max_redemptions > 0),
  constraint coupons_per_user_limit_range check (per_user_limit between 1 and 100)
);

comment on table public.coupons is
  '관리자가 발급하는 쿠폰. 일반 사용자는 select 정책이 없어 코드를 열거할 수 없고, public.redeem_coupon() 으로만 닿는다.';
comment on column public.coupons.code is
  '표기용 원문. 대문자·숫자·하이픈만 허용한다(4~32자). 화면과 안내 메일에 이 값을 그대로 쓴다.';
comment on column public.coupons.code_normalized is
  '조회 키. 대문자 + 공백 제거. 하이픈은 남긴다 — 지우면 서로 다른 코드가 한 값으로 뭉쳐 오타 등록이 통과한다.';
comment on column public.coupons.reward_note is
  '지급 내용(자유 문구). 게임 내 지급은 운영팀 수작업이라 DB 가 품목을 모형화하지 않는다.';
comment on column public.coupons.max_redemptions is
  '전체 등록 한도. null 이면 무제한. 거절(rejected)된 등록은 한도를 소모하지 않는다.';
comment on column public.coupons.per_user_limit is
  '한 회원이 이 쿠폰을 등록할 수 있는 횟수. 기본 1.';
comment on column public.coupons.is_active is
  '비활성 쿠폰은 등록 시 invalid_code 로 떨어진다 — "있지만 꺼져 있다"를 알려 주면 코드 존재 여부가 새어 나간다.';

create unique index if not exists coupons_code_normalized_key
  on public.coupons (code_normalized);

create index if not exists coupons_created_at_idx
  on public.coupons (created_at desc);

drop trigger if exists set_coupons_updated_at on public.coupons;
create trigger set_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. coupon_redemptions
--
-- user_id 는 `on delete set null` 이다. 개인정보가 파기된 뒤에도 "이 UID 로 지급했다"는
-- 사실은 남아야 한다 — 게임팀과의 대사(對査)가 그 근거로 이뤄진다. 닉네임은 스냅샷으로
-- 함께 둔다(파기 후 프로필을 되짚을 수 없다).
--
-- coupon_id 는 `on delete restrict` 다. 등록 이력이 있는 쿠폰은 지울 수 없고, 화면도
-- 같은 규칙(0건일 때만 삭제)으로 막는다. 두 겹으로 두는 이유는 REST 직접 호출 때문이다.
-- -----------------------------------------------------------------------------
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  user_id uuid references public.profiles (id) on delete set null,
  nickname_snapshot text,
  msw_uid text not null,
  msw_profile_code text not null,
  status text not null default 'pending',
  admin_note text,
  processed_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint coupon_redemptions_status_check check (status in ('pending', 'delivered', 'rejected')),
  constraint coupon_redemptions_admin_note_length check (admin_note is null or char_length(admin_note) <= 300),
  constraint coupon_redemptions_msw_uid_shape check (msw_uid ~ '^[0-9]{10,20}$'),
  constraint coupon_redemptions_msw_profile_code_shape check (msw_profile_code ~ '^#[a-z0-9]{4,10}$')
);

comment on table public.coupon_redemptions is
  '쿠폰 등록 이력. insert 는 public.redeem_coupon() 만 한다(authenticated 에 insert 권한을 주지 않는다).';
comment on column public.coupon_redemptions.user_id is
  '등록한 회원. 파기·탈퇴로 프로필이 사라져도 행은 남는다(on delete set null) — 지급 근거는 MSW UID 다.';
comment on column public.coupon_redemptions.nickname_snapshot is
  '등록 시점의 닉네임. 파기 후에는 이 값이 화면의 유일한 근거다.';
comment on column public.coupon_redemptions.status is
  'pending(접수) → delivered(지급 완료) | rejected(거절). 되돌리는 전이는 없다.';

create index if not exists coupon_redemptions_coupon_idx
  on public.coupon_redemptions (coupon_id, created_at desc);
create index if not exists coupon_redemptions_user_idx
  on public.coupon_redemptions (user_id)
  where user_id is not null;
create index if not exists coupon_redemptions_status_idx
  on public.coupon_redemptions (status);
create index if not exists coupon_redemptions_created_idx
  on public.coupon_redemptions (created_at desc);

-- -----------------------------------------------------------------------------
-- 3. 권한 + RLS
--
-- Supabase 의 `alter default privileges … grant all on tables to anon, authenticated`
-- 때문에 새 테이블은 만들자마자 두 롤에 전권이 붙는다. 회수하고 필요한 것만 다시 준다
-- (권한 + 정책, 두 겹). **정책은 권한을 주지 않는다** — 20260908002000 의 사고.
-- -----------------------------------------------------------------------------
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

revoke all on public.coupons from anon;
revoke all on public.coupons from authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant all on public.coupons to service_role;

-- insert 를 주지 않는다. 등록은 redeem_coupon()(SECURITY DEFINER, 소유자 postgres)만 한다 —
-- 권한 자체가 없으면 정책 실수 하나로 임의 등록이 열리는 일이 없다.
revoke all on public.coupon_redemptions from anon;
revoke all on public.coupon_redemptions from authenticated;
grant select, update on public.coupon_redemptions to authenticated;
grant all on public.coupon_redemptions to service_role;

-- 코드는 열거 대상이 아니다. 일반 사용자용 select 정책을 두지 않는 것이 곧 방어다.
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists coupon_redemptions_select_own on public.coupon_redemptions;
create policy coupon_redemptions_select_own on public.coupon_redemptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists coupon_redemptions_select_admin on public.coupon_redemptions;
create policy coupon_redemptions_select_admin on public.coupon_redemptions
  for select to authenticated
  using (public.is_admin());

drop policy if exists coupon_redemptions_update_admin on public.coupon_redemptions;
create policy coupon_redemptions_update_admin on public.coupon_redemptions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. redeem_coupon(p_code, p_msw_uid, p_msw_profile_code)
--
-- 사용자 사이트 마이페이지(시안 §5)의 쿠폰 등록 폼이 부르는 유일한 입구다.
--
-- SECURITY DEFINER 인 이유가 셋이다.
--   * 쿠폰 테이블에 사용자 select 정책이 없다(코드 열거 차단). 함수 안에서만 읽는다.
--   * coupon_redemptions 에 authenticated insert 권한이 없다.
--   * 전체 한도 판정과 insert 사이의 경합을 `for update` 로 직렬화해야 한다.
--
-- **예외를 던지지 않는다.** PostgREST 는 예외를 4xx/5xx 로 바꿔 원문 메시지를 그대로
-- 실어 보낸다(제약명·컬럼명 노출). 성공/실패 모두 200 + jsonb 로 돌려주고, 화면은
-- `code` 로 문구를 고른다.
--
-- 결과 코드
--   ok:true  → { ok, redemption_id, coupon_name, reward_note }
--   ok:false → code ∈ unauthorized · withdrawn · suspended · invalid_code
--                    · invalid_msw_uid · invalid_msw_profile_code
--                    · msw_uid_taken · msw_profile_code_taken
--                    · not_started · expired · limit_reached · already_redeemed
--
-- 없는 코드와 꺼진 코드를 모두 `invalid_code` 로 묶는 것은 의도다. "비활성 쿠폰입니다"는
-- 코드의 존재를 알려 주는 문장이고, 그러면 무작위 대입으로 코드 목록을 만들 수 있다.
-- -----------------------------------------------------------------------------
create or replace function public.redeem_coupon(
  p_code text,
  p_msw_uid text,
  p_msw_profile_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_coupon public.coupons%rowtype;
  v_code text;
  v_uid text;
  v_profile_code text;
  v_used integer;
  v_mine integer;
  v_redemption_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  select * into v_profile from public.profiles where id = v_user_id;

  if not found or v_profile.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'withdrawn');
  end if;

  -- is_suspended() 는 SECURITY INVOKER 라 DEFINER 문맥에서 auth.uid() 판정이 흐려진다.
  -- 같은 규칙(suspended_until > now())을 이미 읽어 둔 행에서 직접 본다.
  if v_profile.suspended_until is not null and v_profile.suspended_until > now() then
    return jsonb_build_object('ok', false, 'code', 'suspended');
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]]', '', 'g'));
  v_uid := btrim(coalesce(p_msw_uid, ''));
  -- 프로필 코드는 저장 규칙이 소문자다(20260908001500 의 CHECK 와 같은 정규식).
  v_profile_code := lower(btrim(coalesce(p_msw_profile_code, '')));

  if v_code = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_code');
  end if;

  if v_uid !~ '^[0-9]{10,20}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_msw_uid');
  end if;

  if v_profile_code !~ '^#[a-z0-9]{4,10}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_msw_profile_code');
  end if;

  /* 월드 계정 중복 불가(20260909000400 §2). 남이 쓰는 값이면 프로필에 채우지도, 등록하지도
     않는다 — 여기서 통과시키면 한 UID 로 여러 계정이 같은 쿠폰을 받는 길이 열린다. */
  if exists (
    select 1 from public.profiles
    where msw_uid = v_uid and id <> v_user_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'msw_uid_taken');
  end if;

  if exists (
    select 1 from public.profiles
    where lower(msw_profile_code) = v_profile_code and id <> v_user_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'msw_profile_code_taken');
  end if;

  /* 같은 코드에 대한 동시 등록을 직렬화한다. 잠그지 않으면 마지막 한 장을 두 사람이
     동시에 통과해 max_redemptions 를 넘긴다. */
  select * into v_coupon
    from public.coupons
   where code_normalized = v_code
     for update;

  if not found or not v_coupon.is_active then
    return jsonb_build_object('ok', false, 'code', 'invalid_code');
  end if;

  if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
    return jsonb_build_object('ok', false, 'code', 'not_started');
  end if;

  if v_coupon.ends_at is not null and now() >= v_coupon.ends_at then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  -- 거절된 등록은 한도를 소모하지 않는다. 운영자가 잘못 온 신청을 거절했는데 그만큼
  -- 수량이 줄어들면, 정상 신청자가 "품절"을 만나고 그 이유를 설명할 수 없다.
  if v_coupon.max_redemptions is not null then
    select count(*) into v_used
      from public.coupon_redemptions
     where coupon_id = v_coupon.id
       and status <> 'rejected';

    if v_used >= v_coupon.max_redemptions then
      return jsonb_build_object('ok', false, 'code', 'limit_reached');
    end if;
  end if;

  select count(*) into v_mine
    from public.coupon_redemptions
   where coupon_id = v_coupon.id
     and user_id = v_user_id
     and status <> 'rejected';

  if v_mine >= v_coupon.per_user_limit then
    return jsonb_build_object('ok', false, 'code', 'already_redeemed');
  end if;

  /* 비어 있는 칸만 채운다. 이미 다른 값이 있으면 덮어쓰지 않는다 — 계정 연동은
     "내 정보"에서 바꾸는 일이고, 쿠폰 등록 폼이 조용히 바꾸면 랭킹 연동이 틀어진다.
     guard_profile_role() 은 SECURITY INVOKER 라 current_user(=함수 소유자 postgres)
     로 첫 분기를 통과한다. */
  if v_profile.msw_uid is null or v_profile.msw_profile_code is null then
    update public.profiles
       set msw_uid = coalesce(msw_uid, v_uid),
           msw_profile_code = coalesce(msw_profile_code, v_profile_code)
     where id = v_user_id;
  end if;

  insert into public.coupon_redemptions (
    coupon_id, user_id, nickname_snapshot, msw_uid, msw_profile_code
  )
  values (
    v_coupon.id, v_user_id, v_profile.nickname, v_uid, v_profile_code
  )
  returning id into v_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'coupon_name', v_coupon.name,
    'reward_note', v_coupon.reward_note
  );
end;
$$;

comment on function public.redeem_coupon(text, text, text) is
  'SECURITY DEFINER · authenticated 전용. 쿠폰 코드를 정규화해 등록한다. 예외를 던지지 않고 { ok, code | redemption_id, coupon_name, reward_note } 를 돌려준다. 실패 코드: unauthorized · withdrawn · suspended · invalid_code · invalid_msw_uid · invalid_msw_profile_code · msw_uid_taken · msw_profile_code_taken · not_started · expired · limit_reached · already_redeemed.';

revoke all on function public.redeem_coupon(text, text, text) from public;
revoke all on function public.redeem_coupon(text, text, text) from anon;
grant execute on function public.redeem_coupon(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. profiles — 마이페이지 시안이 요구하는 세 칸
--
-- guard_profile_role()(20260909000400)은 **블랙리스트**다. 일반 사용자 분기가 되돌리는
-- 컬럼은 role · admin_role_id · id · created_at · email · provider · provider_id ·
-- suspended_until · suspension_reason · purged_at(+ deleted_at 는 별도 규칙)뿐이라,
-- 새 컬럼 셋은 그대로 통과한다. 정책도 행 단위(profiles_update_self: id = auth.uid())라
-- 컬럼 목록이 없다. 따라서 트리거·정책을 고칠 것이 없다 — 이 주석이 그 확인 기록이다.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists name text,
  add column if not exists marketing_sms_opt_out boolean not null default false,
  add column if not exists marketing_email_opt_out boolean not null default false;

comment on column public.profiles.name is
  '실명(선택). 쿠폰 지급·경품 배송 확인용으로 마이페이지에서 본인이 입력한다. 20자 이하.';
comment on column public.profiles.marketing_sms_opt_out is
  'true 면 마케팅 SMS 수신거부. 기본값 false(수신)이며 값을 바꾸는 주체는 본인이다.';
comment on column public.profiles.marketing_email_opt_out is
  'true 면 마케팅 이메일 수신거부. 기본값 false(수신).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_name_length') then
    alter table public.profiles
      add constraint profiles_name_length
      check (name is null or char_length(name) <= 20);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. storage 버킷 `avatars`
--
-- 20260908000800 의 `post-images` 와 같은 형태다 — 공개 읽기 + 경로 첫 세그먼트를
-- 업로더 uid 로 강제. 접두사 규칙이 있어야 "남의 파일 덮어쓰기"를 이름 충돌만으로
-- 막을 수 있고, 파기 배치가 접두사 하나로 정리할 수 있다.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  10485760, -- 10MiB. 시안의 "10MB 이하" 안내와 맞춘다.
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 삭제에 관리자를 함께 넣는 것은 `post-images` 와 같은 이유다 — 부적절한 이미지를
-- 운영자가 내릴 수 있어야 한다. 사용자 범위는 여전히 자기 접두사뿐이다.
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

-- -----------------------------------------------------------------------------
-- 7. admin_roles 시드에 `coupons` 모듈 추가
--
-- `admin/lib/auth/permissions.ts` 의 ADMIN_MODULES 와 키가 같아야 한다. 새 모듈은
-- 값이 없으면 `none` 으로 읽히므로(닫힘 실패), 여기서 채우지 않으면 **슈퍼어드민도**
-- 쿠폰 화면을 열 수 없다.
-- -----------------------------------------------------------------------------
update public.admin_roles
   set permissions = permissions || jsonb_build_object('coupons', 'write')
 where key = 'super_admin';

update public.admin_roles
   set permissions = permissions || jsonb_build_object('coupons', 'none')
 where key = 'editor'
   and not (permissions ? 'coupons');

-- -----------------------------------------------------------------------------
-- 8. purge_withdrawn_profiles() 확장 — 새로 생긴 개인정보(name)도 지운다
--
-- 20260909000400 §7 의 정의를 그대로 옮기고 `name = null` 한 줄을 더한다. 이름은
-- 본인이 적은 실명이라 파기 대상이다. 여기서 빠뜨리면 "파기했는데 실명이 남은" 행이
-- 생기고, 그 사실은 아무 화면에도 드러나지 않는다.
--
-- 수신거부 두 칸(marketing_*)은 지우지 않는다. 사람을 식별하지 못하는 불리언이고,
-- default 로 되돌리면 '수신 동의'로 바뀌어 파기 전보다 넓은 상태가 된다.
--
-- ▲ 관리자 콘솔의 즉시 파기(`admin/lib/actions/member-lifecycle-actions.ts`
--   `purgeProfile()`)가 같은 컬럼 목록을 들고 있다. 한쪽만 고치면 어긋난다
--   (DEVELOPER-GUIDE §10-11 · admin/tests/unit/member-lifecycle-actions.test.ts).
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
           name = null,
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
  'SECURITY DEFINER · service_role 전용. deleted_at 이 기준 기간을 넘긴 프로필의 개인정보(이메일 · 닉네임 · 이름 · 아바타 · 공급자 ID · 월드 계정 · 제재)를 지우고(행은 익명화해 유지) member.purge 를 남긴다. 처리한 id 를 돌려주며, auth.users 삭제는 호출자(Edge Function purge-withdrawn)가 한다.';

revoke all on function public.purge_withdrawn_profiles(interval) from public;
revoke all on function public.purge_withdrawn_profiles(interval) from anon;
revoke all on function public.purge_withdrawn_profiles(interval) from authenticated;
grant execute on function public.purge_withdrawn_profiles(interval) to service_role;
