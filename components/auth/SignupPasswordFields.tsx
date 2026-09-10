'use client'

import { AuthField } from '@/components/auth/AuthField'
import { PasswordInput } from '@/components/auth/PasswordInput'

type SignupPasswordFieldsProps = {
  password: string
  passwordConfirm: string
  onChange: (patch: { password?: string; passwordConfirm?: string }) => void
  passwordError: string | null
  confirmError: string | null
}

/**
 * 회원가입의 비밀번호 두 칸.
 *
 * 시안은 라벨 하나("비밀번호") 아래 입력 두 개를 8px 간격으로 둔다. 두 번째
 * 칸에는 라벨이 없지만 스크린 리더에는 필요하므로 시각적으로만 숨긴다.
 * 규칙 안내는 평소에 띄우지 않고 규칙을 어겼을 때만 오류 자리에 나온다.
 */
export function SignupPasswordFields({
  password,
  passwordConfirm,
  onChange,
  passwordError,
  confirmError,
}: SignupPasswordFieldsProps) {
  return (
    <>
      <AuthField label="비밀번호" htmlFor="signup-password" error={passwordError}>
        <PasswordInput
          id="signup-password"
          name="password"
          value={password}
          onValueChange={(value) => onChange({ password: value })}
          placeholder="비밀번호"
          autoComplete="new-password"
          clearable
          invalid={passwordError !== null}
        />
      </AuthField>

      <AuthField
        label="비밀번호 재입력"
        htmlFor="signup-password-confirm"
        hideLabel
        error={confirmError}
        className="mt-2"
      >
        <PasswordInput
          id="signup-password-confirm"
          name="passwordConfirm"
          value={passwordConfirm}
          onValueChange={(value) => onChange({ passwordConfirm: value })}
          placeholder="비밀번호 재입력"
          autoComplete="new-password"
          invalid={confirmError !== null}
        />
      </AuthField>
    </>
  )
}
