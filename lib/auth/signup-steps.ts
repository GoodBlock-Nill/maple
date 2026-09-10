import {
  isStrongPassword,
  OTP_LENGTH,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_RULE_MESSAGE,
} from '@/lib/validation/email-auth'

/**
 * 회원가입 화면의 단계 판정 — 순수 함수만 담는다.
 *
 *   email ──인증번호 전송──▶ code ──인증하기──▶ verified ──가입하기──▶ (온보딩)
 *     ▲                                            │
 *     └────────────── 이메일 다시 입력 ─────────────┘
 *
 * 폼 컴포넌트에 조건을 흩어 두면 "버튼은 켜지는데 서버가 반려하는" 상태를 눈으로만
 * 확인하게 된다. 판정을 여기 모아 두고 컴포넌트는 값만 넘긴다(테스트도 여기서 한다).
 */

export type SignupStep = 'email' | 'code' | 'verified'

/** 재전송 대기(초). `supabase/config.toml` 의 `[auth.email] max_frequency = "1m0s"` 와 같다. */
export const RESEND_COOLDOWN_SECONDS = 60

export type SignupValues = {
  email: string
  code: string
  password: string
  passwordConfirm: string
}

export type SignupGateInput = SignupValues & {
  step: SignupStep
  /** 서버 액션이 진행 중인 동안은 모든 버튼을 잠근다(이중 제출 방지). */
  isPending: boolean
  /** 재전송까지 남은 초. 0 이면 곧바로 보낼 수 있다. */
  cooldown: number
}

/** 이메일이 형식상 그럴듯한지. 정식 검증은 서버(zod)가 한다 — 여기서는 버튼 활성 판정용이다. */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim()

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed)
}

/** 입력값에서 숫자만 남긴다. 붙여넣기에 섞인 공백·하이픈을 사용자가 지우게 하지 않는다. */
export function normalizeOtpInput(value: string): string {
  return value.replace(/\D/gu, '').slice(0, OTP_LENGTH)
}

export function canSendCode(input: SignupGateInput): boolean {
  return (
    !input.isPending &&
    input.step !== 'verified' &&
    input.cooldown <= 0 &&
    looksLikeEmail(input.email)
  )
}

export function canVerifyCode(input: SignupGateInput): boolean {
  return (
    !input.isPending && input.step === 'code' && normalizeOtpInput(input.code).length === OTP_LENGTH
  )
}

export function canCompleteSignup(input: SignupGateInput): boolean {
  return (
    !input.isPending &&
    input.step === 'verified' &&
    isStrongPassword(input.password) &&
    input.password === input.passwordConfirm
  )
}

/** 인증이 끝난 뒤에는 이메일·인증번호를 잠근다 — 세션이 이미 그 주소로 발급됐다. */
export function isEmailLocked(step: SignupStep): boolean {
  return step === 'verified'
}

export function isCodeLocked(step: SignupStep): boolean {
  return step === 'verified'
}

/**
 * 비밀번호 오류 문구. **입력이 있고 규칙을 어겼을 때만** 돌려준다.
 * 빈 칸에 미리 빨간 글씨를 띄우면 아직 아무것도 하지 않은 사람을 나무라는 화면이 된다.
 */
export function passwordIssue(password: string): string | null {
  if (password === '' || isStrongPassword(password)) {
    return null
  }

  return PASSWORD_RULE_MESSAGE
}

export function passwordConfirmIssue(password: string, passwordConfirm: string): string | null {
  if (passwordConfirm === '' || password === passwordConfirm) {
    return null
  }

  return PASSWORD_MISMATCH_MESSAGE
}
