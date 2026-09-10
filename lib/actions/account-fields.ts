import { uniqueViolationConstraint } from '@/lib/actions/pg-error'
import { FEATURES } from '@/lib/constants/features'

/**
 * 온보딩·마이페이지가 함께 쓰는 프로필 쓰기 규칙.
 *
 * `'use server'` 파일은 **async 함수만** 내보낼 수 있어서(Next 16), 두 서버 액션
 * 모듈(`auth-actions` · `profile-actions`)이 공유해야 하는 동기 헬퍼는 여기에 둔다.
 */

/** 닉네임 유니크 충돌 문구. */
export const NICKNAME_TAKEN_MESSAGE = '이미 사용 중인 닉네임입니다.'

/**
 * 월드 UID·프로필 코드는 한 계정에만 연결된다(`profiles_msw_uid_key` ·
 * `profiles_msw_profile_code_key`, 20260909000400). 다른 계정에 이미 걸려 있으면
 * 사용자가 스스로 풀 수 없으므로 고객지원으로 안내한다 — 탈퇴 대기 중인 옛 계정이
 * 붙잡고 있는 경우가 대표적이다.
 */
export const MSW_UID_TAKEN_MESSAGE =
  '이미 다른 계정에 연결된 월드 계정 UID입니다. 고객지원에 문의해 주세요.'
export const MSW_PROFILE_CODE_TAKEN_MESSAGE = '이미 다른 계정에 연결된 프로필 코드입니다.'

/**
 * 메이플스토리 월드 UID·프로필 코드를 DB 업데이트 payload 에 실을지 정한다.
 *
 * `FEATURES.mswAccountFields` 가 꺼져 있으면 입력칸이 없어 값 자체가 신뢰할 수
 * 없다(빈 문자열이거나 옛 값). 기존 컬럼 값을 덮어쓰지 않도록 아예 payload 에서
 * 뺀다 — 컬럼과 마이그레이션은 그대로 둔 채 "쓰지만 않는" 방식으로 비활성화한다.
 *
 * 스키마(`onboardingSchema`/`updateAccountSchema`)는 플래그가 켜졌을 때만
 * `mswUidSchema`/`mswProfileCodeSchema`(필수)를 쓰므로, 이 분기 안에서는 두 값이
 * 항상 채워져 있다 — 그 사실을 타입에 반영하기 위해 단언한다.
 */
export function mswAccountFieldsForWrite(data: {
  mswUid?: string
  mswProfileCode?: string
}): { msw_uid: string; msw_profile_code: string } | Record<string, never> {
  if (!FEATURES.mswAccountFields) {
    return {}
  }

  return { msw_uid: data.mswUid as string, msw_profile_code: data.mswProfileCode as string }
}

/**
 * 닉네임/월드 계정 유니크 충돌을 제약 이름으로 갈라 필드별 메시지를 붙인다.
 * 제약 이름을 읽지 못하면(드라이버가 detail 을 지운 경우) 가장 흔한 원인인
 * 닉네임 쪽으로 안내한다.
 */
export function accountUniqueViolationFieldErrors(error: unknown): Record<string, string> | null {
  const constraint = uniqueViolationConstraint(error)

  if (constraint === null || constraint.includes('nickname')) {
    return { nickname: NICKNAME_TAKEN_MESSAGE }
  }

  if (constraint.includes('msw_profile_code')) {
    return { mswProfileCode: MSW_PROFILE_CODE_TAKEN_MESSAGE }
  }

  if (constraint.includes('msw_uid')) {
    return { mswUid: MSW_UID_TAKEN_MESSAGE }
  }

  return null
}
