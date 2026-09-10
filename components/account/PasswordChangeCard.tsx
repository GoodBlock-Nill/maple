'use client'

import { useActionState, useState } from 'react'

import { AccountField } from '@/components/account/AccountField'
import {
  MYPAGE_CARD_CLASS,
  MYPAGE_CARD_TITLE_CLASS,
  MYPAGE_ERROR_CLASS,
  MYPAGE_HINT_CLASS,
  MYPAGE_SUBMIT_CLASS,
} from '@/components/account/mypage-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { changePasswordAction } from '@/lib/actions/password-actions'

import type { ChangePasswordState } from '@/lib/actions/password-actions'

const SOCIAL_NOTICE = '간편로그인 계정은 비밀번호가 없습니다.'

const EMPTY_STATE: ChangePasswordState = EMPTY_FORM_STATE

type PasswordChangeCardProps = {
  /** 이메일·비밀번호 계정일 때만 입력칸을 그린다. */
  hasPassword: boolean
}

/**
 * "비밀번호 변경" 카드 — 현재 비밀번호 + 새 비밀번호 2칸(시안 §4.2).
 *
 * 간편로그인 계정에서도 **카드는 남기고** 안내 한 줄만 그린다. 통째로 숨기면
 * 카드가 둘뿐인 화면이 되어 시안의 리듬(프로필 → 비밀번호 → 마케팅)이 무너지고,
 * 사용자는 "비밀번호 변경이 어디 갔지"를 스스로 알아내야 한다.
 */
export function PasswordChangeCard({ hasPassword }: PasswordChangeCardProps) {
  const [state, formAction] = useActionState(changePasswordAction, EMPTY_STATE)

  return (
    <section aria-labelledby="password-heading" className={MYPAGE_CARD_CLASS}>
      <h2 id="password-heading" className={MYPAGE_CARD_TITLE_CLASS}>
        비밀번호 변경
      </h2>

      {hasPassword ? (
        <form action={formAction} className="flex flex-col gap-8">
          <FormFeedback state={state} />

          {/* 성공하면 입력 세 칸을 새로 마운트해 비운다 — effect 로 setState 를
              부르지 않고도 "제출 뒤 초기화"가 된다. */}
          <PasswordFields key={state.changedAt ?? 0} fieldErrors={state.fieldErrors} />

          <button type="submit" className={MYPAGE_SUBMIT_CLASS}>
            비밀번호 변경
          </button>
        </form>
      ) : (
        <p className={MYPAGE_HINT_CLASS}>{SOCIAL_NOTICE}</p>
      )}
    </section>
  )
}

type PasswordFieldsProps = {
  fieldErrors?: Record<string, string>
}

/**
 * 입력 세 칸. 눈(표시 전환)·지우기 아이콘이 값을 알아야 해서 제어 컴포넌트다.
 *
 * 상태를 카드가 아니라 여기에 두는 이유는 초기화 때문이다 — 부모가 `key` 만 바꾸면
 * 세 값이 한 번에 비워진다(브라우저 자동완성이 남긴 값도 함께 사라진다).
 */
function PasswordFields({ fieldErrors }: PasswordFieldsProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  return (
    <div className="flex flex-col gap-8">
      <AccountField
        label="현재 비밀번호"
        htmlFor="current-password"
        error={fieldErrors?.currentPassword}
      >
        <PasswordInput
          id="current-password"
          name="currentPassword"
          value={current}
          onValueChange={setCurrent}
          placeholder="기존 비밀번호"
          autoComplete="current-password"
          invalid={fieldErrors?.currentPassword !== undefined}
        />
      </AccountField>

      <AccountField label="새 비밀번호" htmlFor="new-password" error={fieldErrors?.password}>
        <div className="flex flex-col gap-[10px]">
          <PasswordInput
            id="new-password"
            name="password"
            value={next}
            onValueChange={setNext}
            placeholder="새 비밀번호"
            autoComplete="new-password"
            clearable
            invalid={fieldErrors?.password !== undefined}
          />

          {/* 시안에는 두 번째 칸의 라벨이 없다. 보이지 않아도 이름은 있어야 한다. */}
          <label htmlFor="new-password-confirm" className="sr-only">
            새 비밀번호 확인
          </label>
          <PasswordInput
            id="new-password-confirm"
            name="passwordConfirm"
            value={confirm}
            onValueChange={setConfirm}
            placeholder="새 비밀번호 확인"
            autoComplete="new-password"
            invalid={fieldErrors?.passwordConfirm !== undefined}
          />

          {fieldErrors?.passwordConfirm === undefined ? null : (
            <p role="alert" className={MYPAGE_ERROR_CLASS}>
              {fieldErrors.passwordConfirm}
            </p>
          )}
        </div>
      </AccountField>
    </div>
  )
}
