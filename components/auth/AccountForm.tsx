'use client'

import { useActionState } from 'react'

import { AUTH_FIELD_CLASS } from '@/components/auth/auth-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Input } from '@/components/ui/Input'
import { updateAccount } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { FEATURES } from '@/lib/constants/features'
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@/lib/validation/auth'

type AccountFormProps = {
  /** 서버 컴포넌트(계정 페이지)가 조회해 내려준 현재 값. */
  defaultNickname: string
  defaultMswUid: string
  defaultMswProfileCode: string
}

/**
 * "내 정보" 화면의 편집 폼 — 닉네임 + 메이플스토리 월드 계정(UID·프로필 코드).
 *
 * 온보딩 폼과 같은 검증 규칙을 쓰지만 리다이렉트하지 않는다 — 성공해도 같은
 * 화면에 머물며 상단 알림으로 결과를 보여준다(`updateAccount` 가 헤더 등은
 * `refresh()` 로 따로 갱신한다).
 */
export function AccountForm({
  defaultNickname,
  defaultMswUid,
  defaultMswProfileCode,
}: AccountFormProps) {
  const [state, formAction] = useActionState(updateAccount, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormFeedback state={state} />

      <Input
        label="닉네임"
        name="nickname"
        type="text"
        required
        defaultValue={defaultNickname}
        minLength={NICKNAME_MIN_LENGTH}
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder={`${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자`}
        hint="한글·영문·숫자·밑줄만 쓸 수 있고, 게시판에는 앞 3글자만 노출됩니다."
        error={state.fieldErrors?.nickname}
        className={AUTH_FIELD_CLASS}
      />

      {/* 오너 요청: UID·프로필 코드 입력은 지우지 않고 플래그로만 숨긴다.
          추후 재활성화 시 NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS 만 켜면 된다. */}
      {FEATURES.mswAccountFields ? (
        <>
          <Input
            label="메이플스토리 월드 계정 UID"
            name="mswUid"
            type="text"
            inputMode="numeric"
            required
            defaultValue={defaultMswUid}
            placeholder="예: 20123000000000000"
            hint={
              'UID는 "메이플스토리 월드 클라이언트 - 설정 - 계정" 에서 확인할 수 있습니다. ex) 20123000000000000'
            }
            error={state.fieldErrors?.mswUid}
            className={AUTH_FIELD_CLASS}
          />

          <Input
            label="메이플스토리 월드 프로필 코드"
            name="mswProfileCode"
            type="text"
            required
            defaultValue={defaultMswProfileCode}
            placeholder="예: #abcd1"
            hint={
              '프로필 코드는 "메이플스토리 월드 클라이언트 - 더보기 - 프로필 편집" 에서 확인할 수 있습니다. ex) #abcd1'
            }
            error={state.fieldErrors?.mswProfileCode}
            className={AUTH_FIELD_CLASS}
          />
        </>
      ) : null}

      <SubmitButton pendingLabel="저장 중…" className="w-full">
        저장
      </SubmitButton>
    </form>
  )
}
