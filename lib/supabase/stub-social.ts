import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { stubNicknameFor } from '@/lib/validation/auth'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { SocialProvider } from '@/lib/validation/auth'

/**
 * 간편로그인 **스텁** 세션 발급.
 *
 * TODO(auth): 개발팀이 실 OAuth(구글·카카오·네이버)를 연동하면 이 모듈을 통째로
 * 교체한다. 지금은 버튼을 누르면 곧바로 로그인되는 임시 구현이다.
 *
 * 두 가지 경로를 순서대로 시도한다.
 *
 *  1) 익명 로그인(`signInAnonymously`) — 테스터마다 독립된 계정이 생겨 가장 깔끔하다.
 *     프로젝트 설정(`enable_anonymous_sign_ins`)이 켜져 있어야 한다.
 *  2) 제공자별 데모 계정 — 익명 로그인이 꺼져 있을 때의 폴백. 서비스 롤로 계정을
 *     찾거나 만들고, **비밀번호 없이** 매직링크 토큰을 발급해 세션으로 바꾼다.
 *
 * 세션 쿠키는 항상 쿠키를 아는 서버 클라이언트(`client`)가 심는다. 서비스 롤
 * 클라이언트는 세션을 만들지 않는다(브라우저에 전달할 쿠키가 없다).
 */

export type StubSignInResult =
  { ok: true; userId: string; isAnonymous: boolean } | { ok: false; message: string }

/** 폴백 데모 계정의 주소. 실제로 메일을 보내지 않으므로 예약 TLD(.local)를 쓴다. */
export function stubDemoEmail(provider: SocialProvider): string {
  return `demo-${provider}@stub.maple.local`
}

/** 토큰·키가 로그에 남지 않도록 메시지만 남긴다. */
function logFailure(step: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)

  console.error(`[stub-social] ${step} 실패: ${message}`)
}

export async function signInWithStubProvider(
  client: TypedSupabaseClient,
  provider: SocialProvider,
): Promise<StubSignInResult> {
  const anonymous = await signInAnonymouslyAs(client, provider)

  if (anonymous !== null) {
    return anonymous
  }

  return signInAsDemoUser(client, provider)
}

/** 1순위: 익명 로그인. 기능이 꺼져 있으면 null 을 돌려 폴백으로 넘긴다. */
async function signInAnonymouslyAs(
  client: TypedSupabaseClient,
  provider: SocialProvider,
): Promise<StubSignInResult | null> {
  const { data, error } = await client.auth.signInAnonymously({
    /* handle_new_user() 트리거가 이 값을 읽어 프로필 닉네임·제공자를 채운다.
       role 은 절대 싣지 않는다 — 실으면 스스로 관리자가 될 수 있다. */
    options: { data: { provider, nickname: stubNicknameFor(provider) } },
  })

  if (error === null && data.user !== null) {
    return { ok: true, userId: data.user.id, isAnonymous: true }
  }

  if (error !== null) {
    logFailure('익명 로그인', error)
  }

  return null
}

/** 2순위: 제공자별 데모 계정으로 로그인한다. */
async function signInAsDemoUser(
  client: TypedSupabaseClient,
  provider: SocialProvider,
): Promise<StubSignInResult> {
  const admin = createAdminClient()
  const email = stubDemoEmail(provider)

  const userId = await findOrCreateDemoUser(admin, provider, email)

  if (userId === null) {
    return { ok: false, message: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  if (await startSessionWithMagicLink(client, admin, email)) {
    return { ok: true, userId, isAnonymous: false }
  }

  if (await startSessionWithTemporaryPassword(client, admin, userId, email)) {
    return { ok: true, userId, isAnonymous: false }
  }

  return { ok: false, message: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
}

async function findOrCreateDemoUser(
  admin: TypedSupabaseClient,
  provider: SocialProvider,
  email: string,
): Promise<string | null> {
  /* auth.users 를 이메일로 직접 조회하는 관리자 API 가 없어서(listUsers 는 전량
     페이지네이션이다) 트리거가 만든 profiles.email 을 조회 키로 쓴다. */
  const existing = await admin.from('profiles').select('id').eq('email', email).maybeSingle()

  if (existing.data !== null) {
    return existing.data.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { provider, nickname: stubNicknameFor(provider) },
  })

  if (error === null && data.user !== null) {
    return data.user.id
  }

  logFailure('데모 계정 생성', error)

  // 동시 요청이 먼저 만들었을 수 있다. 한 번 더 조회해 본다.
  const retry = await admin.from('profiles').select('id').eq('email', email).maybeSingle()

  return retry.data?.id ?? null
}

/** 비밀번호 없이 세션을 만드는 정공법. 발급한 토큰은 로그에 남기지 않는다. */
async function startSessionWithMagicLink(
  client: TypedSupabaseClient,
  admin: TypedSupabaseClient,
  email: string,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })

  if (error !== null) {
    logFailure('매직링크 발급', error)

    return false
  }

  const tokenHash = data.properties?.hashed_token

  if (typeof tokenHash !== 'string' || tokenHash === '') {
    logFailure('매직링크 발급', new Error('hashed_token 이 비어 있습니다.'))

    return false
  }

  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })

  if (verified.error !== null) {
    logFailure('매직링크 검증', verified.error)

    return false
  }

  return true
}

/**
 * 최후의 폴백.
 *
 * 매직링크 발급이 메일 발송 빈도 제한에 걸리는 프로젝트가 있어서, 그때는 임시
 * 비밀번호를 새로 심고 곧바로 로그인한다. 비밀번호는 매번 폐기되며 어디에도
 * 저장하지 않는다.
 */
async function startSessionWithTemporaryPassword(
  client: TypedSupabaseClient,
  admin: TypedSupabaseClient,
  userId: string,
  email: string,
): Promise<boolean> {
  const password = `${crypto.randomUUID()}${crypto.randomUUID()}`
  const updated = await admin.auth.admin.updateUserById(userId, { password })

  if (updated.error !== null) {
    logFailure('임시 비밀번호 설정', updated.error)

    return false
  }

  const signedIn = await client.auth.signInWithPassword({ email, password })

  if (signedIn.error !== null) {
    logFailure('임시 비밀번호 로그인', signedIn.error)

    return false
  }

  return true
}

/**
 * 프로필에 "어떤 버튼으로 들어왔는지"를 남긴다.
 *
 * 익명 계정에는 이메일이 없어 provider 만으로는 구분이 안 되므로 uid 를 붙여
 * `stub:<uid>` 형태로 저장한다(= provider_id 유니크 제약을 만족한다).
 * 서비스 롤로 쓰는 이유: 사용자 정책(profiles_update_self)으로도 가능하지만,
 * 트리거가 막 만든 행과의 경합을 피하려면 RLS 밖에서 한 번에 끝내는 편이 안전하다.
 */
export async function markStubProvider(userId: string, provider: SocialProvider): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ provider, provider_id: `stub:${userId}` })
    .eq('id', userId)

  if (error !== null) {
    logFailure('프로필 제공자 기록', error)
  }
}
