'use client'

import Link from 'next/link'

import { LogInGlyph } from '@/components/auth/auth-icons'
import { AuthDivider } from '@/components/auth/AuthDivider'
import { AuthInlineField } from '@/components/auth/AuthInlineField'
import {
  AUTH_ACCENT_LINK_CLASS,
  AUTH_ERROR_CLASS,
  AUTH_FORM_CLASS,
  AUTH_MUTED_LINK_CLASS,
  AUTH_SUBMIT_DARK_CLASS,
} from '@/components/auth/auth-scene-styles'
import { AuthSocialButtons } from '@/components/auth/AuthSocialButtons'
import { SignupPasswordFields } from '@/components/auth/SignupPasswordFields'
import { useSignupFlow } from '@/components/auth/use-signup-flow'
import {
  canCompleteSignup,
  canSendCode,
  canVerifyCode,
  isCodeLocked,
  isEmailLocked,
  passwordConfirmIssue,
  passwordIssue,
} from '@/lib/auth/signup-steps'
import { cn } from '@/lib/utils/cn'
import { OTP_LENGTH } from '@/lib/validation/email-auth'

/**
 * 회원가입 폼 — 이메일 인증번호 → 비밀번호(시안 2041:2365 / 2041:2473).
 *
 * 상태 기계는 `useSignupFlow`, 단계 판정은 `lib/auth/signup-steps.ts` 가 갖는다.
 * 화면 상태를 조작해도 가입이 완성되지 않는다 — 서버가 세션으로 다시 확인한다.
 */
export function SignupForm({ nextPath }: { nextPath: string }) {
  const flow = useSignupFlow()
  const { values, gate, feedback, notice } = flow

  const passwordError = feedback.fieldErrors?.password ?? passwordIssue(values.password)
  const confirmError =
    feedback.fieldErrors?.passwordConfirm ??
    passwordConfirmIssue(values.password, values.passwordConfirm)

  return (
    <div className={AUTH_FORM_CLASS}>
      <form
        onSubmit={(event) => {
          event.preventDefault()

          if (canCompleteSignup(gate)) flow.submit(nextPath)
        }}
        className="flex flex-col"
      >
        <AuthInlineField
          id="signup-email"
          label="이메일"
          value={values.email}
          onValueChange={flow.setEmail}
          placeholder="이메일 주소를 입력해주세요"
          readOnly={isEmailLocked(gate.step)}
          error={feedback.fieldErrors?.email}
          notice={notice?.slot === 'email' ? notice.text : null}
          inputProps={{ name: 'email', type: 'email', inputMode: 'email', autoComplete: 'email' }}
          action={{
            label: flow.cooldown > 0 ? `${flow.cooldown}초 후 재전송` : '인증번호 전송',
            disabled: !canSendCode(gate),
            onClick: flow.send,
            className: 'bg-ink',
          }}
          /* 시안(2041:2489)에서 첫 필드만 아래 간격이 19px 이다. */
          className="mb-[19px]"
        />

        <AuthInlineField
          id="signup-code"
          label="이메일 인증번호"
          value={values.code}
          onValueChange={flow.setCode}
          placeholder={`인증번호 ${OTP_LENGTH}자리`}
          readOnly={isCodeLocked(gate.step)}
          error={feedback.fieldErrors?.code}
          notice={notice?.slot === 'code' ? notice.text : null}
          inputProps={{
            name: 'code',
            type: 'text',
            inputMode: 'numeric',
            autoComplete: 'one-time-code',
            maxLength: OTP_LENGTH,
          }}
          action={{
            label: gate.step === 'verified' ? '인증 완료' : '인증하기',
            disabled: gate.step === 'verified' || !canVerifyCode(gate),
            onClick: flow.verify,
            className: 'bg-[#111]',
          }}
          className="mb-6"
        />

        <SignupPasswordFields
          password={values.password}
          passwordConfirm={values.passwordConfirm}
          onChange={flow.setPasswords}
          passwordError={passwordError ?? null}
          confirmError={confirmError ?? null}
        />

        {feedback.formError === undefined ? null : (
          <p role="alert" className={cn(AUTH_ERROR_CLASS, 'mt-6 mb-0 text-center')}>
            {feedback.formError}
          </p>
        )}

        <button
          type="submit"
          disabled={!canCompleteSignup(gate)}
          className={cn(AUTH_SUBMIT_DARK_CLASS, 'mt-6')}
        >
          {flow.isPending ? '처리 중…' : '가입하기'}
        </button>
      </form>

      <div className="mt-6 flex h-6 items-center justify-center gap-[10px]">
        <span className={AUTH_MUTED_LINK_CLASS}>계정이 이미 있으신가요?</span>
        <Link href="/login" className={AUTH_ACCENT_LINK_CLASS}>
          <LogInGlyph className="size-5" />
          로그인
        </Link>
      </div>

      <div className="mt-8">
        <AuthDivider tone="ink" />
      </div>

      <div className="mt-8">
        <AuthSocialButtons nextPath={nextPath} />
      </div>
    </div>
  )
}
