'use client'

import { useActionState, useState } from 'react'

import { AccountField } from '@/components/account/AccountField'
import {
  MYPAGE_FIELD_WIDTH_CLASS,
  MYPAGE_INPUT_CLASS,
  MYPAGE_NOTICE_CLASS,
  MYPAGE_PILL_BUTTON_CLASS,
} from '@/components/account/mypage-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { updateNicknameAction } from '@/lib/actions/profile-actions'
import { cn } from '@/lib/utils/cn'
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@/lib/validation/auth'

const FIELD_ID = 'account-nickname'

type NicknameFieldProps = {
  nickname: string
}

/**
 * 닉네임 인라인 변경(시안 §3.1) — 입력 413×54 + gap 12 + "변경하기" 99×54.
 *
 * 입력이 제어 컴포넌트인 이유는 React 19 의 폼 자동 초기화 때문이다 —
 * `<form action>` 은 액션이 끝나면 폼을 비우는데, 그대로 두면 "이미 사용 중인
 * 닉네임입니다" 를 본 순간 방금 친 이름이 저장된 값으로 되돌아간다.
 *
 * 성공은 입력 아래 한 줄로 알린다(모달은 마케팅 동의·계정 연동에만 있다).
 */
export function NicknameField({ nickname }: NicknameFieldProps) {
  const [state, formAction, isPending] = useActionState(updateNicknameAction, EMPTY_FORM_STATE)
  const [value, setValue] = useState(nickname)

  return (
    <form action={formAction} className="flex flex-col">
      <AccountField label="닉네임" htmlFor={FIELD_ID} error={state.fieldErrors?.nickname}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id={FIELD_ID}
            name="nickname"
            type="text"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            minLength={NICKNAME_MIN_LENGTH}
            maxLength={NICKNAME_MAX_LENGTH}
            autoComplete="nickname"
            aria-invalid={state.fieldErrors?.nickname === undefined ? undefined : true}
            className={cn(MYPAGE_INPUT_CLASS, MYPAGE_FIELD_WIDTH_CLASS)}
          />

          <button
            type="submit"
            disabled={isPending}
            className={cn(MYPAGE_PILL_BUTTON_CLASS, 'w-[99px] self-start sm:self-auto')}
          >
            변경하기
          </button>
        </div>
      </AccountField>

      {state.formError === undefined ? null : (
        <div className="mt-[10px]">
          <FormFeedback state={state} />
        </div>
      )}

      {state.message === undefined ? null : (
        <p role="status" className={MYPAGE_NOTICE_CLASS}>
          {state.message}
        </p>
      )}
    </form>
  )
}
