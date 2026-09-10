-- =============================================================================
-- 20260910000200_my_coupon_redemptions
-- 마이페이지 "쿠폰 등록 내역" 이 읽는 단 하나의 입구.
--
--   사용자 ──rpc('my_coupon_redemptions')──▶ 내 등록 이력 + 쿠폰 이름/보상 안내
--
-- 왜 RPC 인가
--   `coupons` 에는 일반 사용자 select 정책이 **없다**(20260910000100 §3). 코드를
--   열거할 수 있게 되면 무작위 대입으로 남의 쿠폰을 등록하는 길이 열리기 때문이다.
--   그런데 등록 내역 화면은 "무엇을 등록했고 무엇을 받는가"(name · reward_note)를
--   말해 주어야 뜻이 있다. 정책을 여는 대신, **내가 이미 등록한 쿠폰의 행만**
--   골라 내보내는 SECURITY DEFINER 함수를 둔다 — 열람 범위가 coupon_redemptions
--   의 내 행 집합으로 못 박히므로 코드 목록은 여전히 만들 수 없다.
--
-- 이 마이그레이션이 다루는 것
--   1) public.mask_coupon_code(text) — 하이픈은 남기고 뒤 4자리 영숫자만 보인다.
--   2) public.my_coupon_redemptions() — auth.uid() 의 등록 이력(최신순).
--
-- `coupons` 에 select 정책을 추가하지 않는다. 이 파일이 그 결정의 두 번째 기록이다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. mask_coupon_code(p_code)
--
-- `GLZA-TEST-0001` → `****-****-0001`.
--
-- 하이픈을 지우지 않는 이유는 코드 자체의 규칙(20260910000100 §1)과 같다 — 자리
-- 구분이 사라지면 사용자가 "내가 등록한 그 코드"를 알아볼 근거가 줄어든다. 반대로
-- 뒤 4자리보다 더 보여 주면 마스킹의 뜻이 없다(코드는 4~32자라 절반이 노출된다).
--
-- 화면(TypeScript)에도 같은 규칙의 거울(`maskCouponCode`)이 있지만, **기준은 여기**
-- 다. 마스킹은 값이 브라우저에 닿기 전에 끝나야 한다 — 클라이언트에서 가리는 것은
-- 개발자 도구를 여는 순간 없는 것이 된다.
-- -----------------------------------------------------------------------------
create or replace function public.mask_coupon_code(p_code text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_out text := '';
  v_char text;
  v_kept integer := 0;
  i integer;
begin
  if p_code is null or btrim(p_code) = '' then
    return null;
  end if;

  -- 뒤에서부터 읽는다. 영숫자는 4개까지만 원문으로 남기고 나머지는 '*',
  -- 하이픈 같은 구분자는 자리 그대로 둔다.
  for i in reverse length(p_code)..1 loop
    v_char := substr(p_code, i, 1);

    if v_char ~ '[A-Za-z0-9]' then
      if v_kept < 4 then
        v_kept := v_kept + 1;
      else
        v_char := '*';
      end if;
    end if;

    v_out := v_char || v_out;
  end loop;

  return v_out;
end;
$$;

comment on function public.mask_coupon_code(text) is
  '쿠폰 코드 표기용 마스킹. 구분자(하이픈)는 남기고 마지막 영숫자 4자만 보인다: GLZA-TEST-0001 → ****-****-0001.';

revoke all on function public.mask_coupon_code(text) from public;
revoke all on function public.mask_coupon_code(text) from anon;
grant execute on function public.mask_coupon_code(text) to authenticated;
grant execute on function public.mask_coupon_code(text) to service_role;

-- -----------------------------------------------------------------------------
-- 2. my_coupon_redemptions()
--
-- SECURITY DEFINER (= security invoker false). 소유자 권한으로 `coupons` 를 읽지만
-- where 절이 auth.uid() 로 못 박혀 있어 남의 행에는 닿지 않는다. 로그인하지 않았으면
-- auth.uid() 가 null 이고 `r.user_id = null` 은 참이 되지 않으므로 0건이다
-- (`user_id` 가 null 인 파기 행도 같은 이유로 새어 나가지 않는다).
--
-- admin_note 는 **거절일 때만** 내보낸다. 지급 완료 건의 메모는 운영 기록(처리자
-- 메모)이라 사용자에게 보일 이유가 없고, 거절 건의 메모는 반대로 "왜 못 받았나"에
-- 답하는 유일한 문장이다. 관리자 화면의 안내 문구도 이 규칙에 맞춰 두었다.
--
-- 정렬은 함수가 소유한다. 최신순이 이 목록의 뜻이고(방금 등록한 것이 맨 위),
-- 호출자가 뒤집을 수 있게 두면 화면마다 다른 순서가 생긴다.
-- -----------------------------------------------------------------------------
create or replace function public.my_coupon_redemptions()
returns table (
  id uuid,
  coupon_name text,
  reward_note text,
  code_masked text,
  msw_uid text,
  msw_profile_code text,
  status text,
  admin_note text,
  created_at timestamptz,
  processed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    c.name,
    c.reward_note,
    public.mask_coupon_code(c.code),
    r.msw_uid,
    r.msw_profile_code,
    r.status,
    case when r.status = 'rejected' then r.admin_note end,
    r.created_at,
    r.processed_at
  from public.coupon_redemptions r
  join public.coupons c on c.id = r.coupon_id
  where r.user_id = (select auth.uid())
  order by r.created_at desc, r.id desc;
$$;

comment on function public.my_coupon_redemptions() is
  'SECURITY DEFINER · authenticated 전용. auth.uid() 의 쿠폰 등록 이력을 최신순으로 돌려준다. coupons 에 select 정책을 열지 않고 쿠폰 이름·보상 안내를 보여 주기 위한 유일한 통로이며, 코드는 마스킹(****-****-0001)해서 나간다. admin_note 는 거절 건에만 실린다.';

revoke all on function public.my_coupon_redemptions() from public;
revoke all on function public.my_coupon_redemptions() from anon;
grant execute on function public.my_coupon_redemptions() to authenticated;
grant execute on function public.my_coupon_redemptions() to service_role;
