/**
 * `public.my_coupon_redemptions()` 의 경계를 실제 원격 DB 에 대고 확인한다.
 *
 * 단위 테스트는 Supabase 클라이언트를 목으로 대체하므로 "SECURITY DEFINER 함수가
 * 남의 행을 내보내지 않는가"는 검증하지 못한다. 여기서는 임시 사용자 두 명을 실제로
 * 만들어 각자 자기 등록만 보이는지, 코드가 DB 에서 마스킹되어 나오는지,
 * `coupons` 테이블은 여전히 열리지 않는지를 본다.
 *
 *   node --env-file=.env.local tests/manual/coupon-history-rpc-check.mjs
 *
 * 키는 환경 변수에서만 읽고 출력에도 남기지 않는다. 만든 계정·등록 이력은 끝에서 지우고,
 * 잠시 켠 샘플 쿠폰(GLZA-TEST-0001)도 원래의 비활성 상태로 되돌린다.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const SAMPLE_CODE = 'GLZA-TEST-0001'

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 매직링크로 세션을 얻은 사용자 클라이언트를 만든다. */
async function createUserClient(label) {
  const email = `coupon-rpc-${label}-${crypto.randomUUID()}@stub.glzaworld.local`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nickname: `쿠폰검사${label}`, provider: 'kakao' },
  })

  if (createError) {
    throw new Error(`사용자 생성 실패(${label}): ${createError.message}`)
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError) {
    throw new Error(`매직링크 실패(${label}): ${linkError.message}`)
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error: otpError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })

  if (otpError) {
    throw new Error(`세션 발급 실패(${label}): ${otpError.message}`)
  }

  return { id: created.user.id, client }
}

function randomDigits(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
}

async function main() {
  const { data: coupon } = await admin
    .from('coupons')
    .select('id, is_active')
    .eq('code', SAMPLE_CODE)
    .maybeSingle()

  if (!coupon) {
    console.error(`샘플 쿠폰 ${SAMPLE_CODE} 가 없습니다.`)
    process.exit(1)
  }

  const wasActive = coupon.is_active
  await admin.from('coupons').update({ is_active: true }).eq('id', coupon.id)

  const alice = await createUserClient('a')
  const bob = await createUserClient('b')

  try {
    // 앨리스만 등록한다.
    const { data: redeemed } = await alice.client.rpc('redeem_coupon', {
      p_code: SAMPLE_CODE,
      p_msw_uid: `2012${randomDigits(13)}`,
      p_msw_profile_code: `#rpc${Math.random().toString(36).slice(2, 7)}`,
    })

    record('redeem_coupon 이 성공한다', redeemed?.ok === true, redeemed?.code)

    const { data: mine, error: mineError } = await alice.client.rpc('my_coupon_redemptions')

    record('본인 등록 1건이 보인다', !mineError && mine?.length === 1, mineError?.message)
    record(
      '쿠폰 이름·보상 안내가 실린다(coupons 정책 없이)',
      mine?.[0]?.coupon_name === '클라이언트 연동 테스트 쿠폰' && Boolean(mine?.[0]?.reward_note),
      mine?.[0]?.coupon_name,
    )
    record(
      '코드가 DB 에서 마스킹된다(****-****-0001)',
      mine?.[0]?.code_masked === '****-****-0001',
      mine?.[0]?.code_masked,
    )
    record('처리 전에는 processed_at 이 비어 있다', mine?.[0]?.processed_at === null)

    const { data: others, error: othersError } = await bob.client.rpc('my_coupon_redemptions')

    record(
      '남의 등록 이력은 보이지 않는다',
      !othersError && Array.isArray(others) && others.length === 0,
      othersError?.message ?? `${others?.length ?? '?'}건`,
    )

    // 관리자가 거절 처리하면 사유가 실려 나온다(지급 완료 메모는 실리지 않는다).
    await admin
      .from('coupon_redemptions')
      .update({
        status: 'rejected',
        admin_note: 'UID 계정을 찾을 수 없습니다.',
        processed_at: new Date().toISOString(),
      })
      .eq('id', redeemed.redemption_id)

    const { data: afterReject } = await alice.client.rpc('my_coupon_redemptions')

    record(
      '거절 사유가 사용자에게 전달된다',
      afterReject?.[0]?.status === 'rejected' &&
        afterReject?.[0]?.admin_note === 'UID 계정을 찾을 수 없습니다.',
      afterReject?.[0]?.admin_note,
    )

    await admin
      .from('coupon_redemptions')
      .update({ status: 'delivered', admin_note: '게임팀 확인 완료' })
      .eq('id', redeemed.redemption_id)

    const { data: afterDeliver } = await alice.client.rpc('my_coupon_redemptions')

    record(
      '지급 완료 건의 운영 메모는 나가지 않는다',
      afterDeliver?.[0]?.status === 'delivered' && afterDeliver?.[0]?.admin_note === null,
      String(afterDeliver?.[0]?.admin_note),
    )

    // 원문 코드는 여전히 닿을 수 없다.
    const { data: couponRows, error: couponError } = await alice.client
      .from('coupons')
      .select('code')

    record(
      'coupons 테이블은 여전히 열거되지 않는다',
      couponError !== null || (couponRows?.length ?? 0) === 0,
      couponError?.message ?? `${couponRows?.length ?? '?'}행`,
    )

    // 비로그인(anon)은 함수 자체를 실행할 수 없다.
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error: anonError } = await anon.rpc('my_coupon_redemptions')

    record('anon 은 함수를 실행할 수 없다', anonError !== null, anonError?.message)
  } finally {
    await admin.from('coupon_redemptions').delete().eq('user_id', alice.id)
    await admin.from('coupons').update({ is_active: wasActive }).eq('id', coupon.id)
    await admin.auth.admin.deleteUser(alice.id)
    await admin.auth.admin.deleteUser(bob.id)
  }

  const failed = results.filter((result) => !result.ok)
  console.log(`\n${results.length - failed.length}/${results.length} PASS`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
