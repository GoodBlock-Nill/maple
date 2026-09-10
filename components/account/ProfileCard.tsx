'use client'

import { useActionState, useState } from 'react'

import { AccountField } from '@/components/account/AccountField'
import { AvatarUploader } from '@/components/account/AvatarUploader'
import {
  MYPAGE_CARD_CLASS,
  MYPAGE_CARD_TITLE_CLASS,
  MYPAGE_SUBMIT_CLASS,
} from '@/components/account/mypage-styles'
import { AUTH_INPUT_CLASS } from '@/components/auth/auth-scene-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { updateProfileAction } from '@/lib/actions/profile-actions'
import { FEATURES } from '@/lib/constants/features'
import { cn } from '@/lib/utils/cn'
import { NAME_MAX_LENGTH } from '@/lib/validation/account'
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@/lib/validation/auth'

const EMPTY_EMAIL = '-'

const INPUT_CLASS = cn(AUTH_INPUT_CLASS, 'pr-[23px]')

type ProfileCardProps = {
  name: string
  nickname: string
  /** 간편로그인 계정은 제공자 이메일. 없으면 "-" 로 그린다. */
  email: string | null
  avatarUrl: string | null
  mswUid: string
  mswProfileCode: string
}

/**
 * "프로필" 카드 — 아바타 · 이름 · 닉네임 · 이메일(읽기 전용).
 *
 * 시안에는 저장 버튼이 없지만(스펙 §4.1) 폼은 제출 수단이 있어야 한다. 비밀번호
 * 카드와 같은 135×56 버튼을 카드 맨 아래에 둔다 — 시안과의 유일한 차이이며,
 * 그만큼(88px) 아래 요소가 밀린다.
 *
 * 이메일은 바꿀 수 없다. 로그인 수단 자체라 변경은 별도 인증 절차(메일 확인)가
 * 필요하고, 시안에도 그 흐름이 없다.
 */
export function ProfileCard({
  name,
  nickname,
  email,
  avatarUrl,
  mswUid,
  mswProfileCode,
}: ProfileCardProps) {
  const [state, formAction] = useActionState(updateProfileAction, EMPTY_FORM_STATE)

  return (
    <section aria-labelledby="profile-heading" className={MYPAGE_CARD_CLASS}>
      <h2 id="profile-heading" className={MYPAGE_CARD_TITLE_CLASS}>
        프로필
      </h2>

      <AvatarUploader avatarUrl={avatarUrl} />

      <form action={formAction} className="flex flex-col gap-8">
        <FormFeedback state={state} />

        <ProfileFields
          name={name}
          nickname={nickname}
          mswUid={mswUid}
          mswProfileCode={mswProfileCode}
          fieldErrors={state.fieldErrors}
        />

        <AccountField label="이메일" htmlFor="profile-email">
          <input
            id="profile-email"
            type="text"
            readOnly
            aria-readonly
            value={email ?? EMPTY_EMAIL}
            className={INPUT_CLASS}
          />
        </AccountField>

        <button type="submit" className={MYPAGE_SUBMIT_CLASS}>
          저장
        </button>
      </form>
    </section>
  )
}

type ProfileFieldsProps = {
  name: string
  nickname: string
  mswUid: string
  mswProfileCode: string
  fieldErrors?: Record<string, string>
}

/**
 * 편집 가능한 칸들.
 *
 * 제어 컴포넌트인 이유는 React 19 의 폼 자동 초기화 때문이다 — `<form action>` 은
 * 액션이 끝나면 폼을 비우는데, 그대로 두면 "이미 사용 중인 닉네임입니다" 를 본
 * 순간 방금 친 이름까지 저장된 값으로 되돌아간다.
 */
function ProfileFields({
  name,
  nickname,
  mswUid,
  mswProfileCode,
  fieldErrors,
}: ProfileFieldsProps) {
  const [nameValue, setNameValue] = useState(name)
  const [nicknameValue, setNicknameValue] = useState(nickname)
  const [uidValue, setUidValue] = useState(mswUid)
  const [codeValue, setCodeValue] = useState(mswProfileCode)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        <AccountField
          label="이름"
          htmlFor="profile-name"
          error={fieldErrors?.name}
          className="sm:flex-1"
        >
          <input
            id="profile-name"
            name="name"
            type="text"
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="name"
            placeholder="이름을 입력하세요."
            aria-invalid={fieldErrors?.name === undefined ? undefined : true}
            className={INPUT_CLASS}
          />
        </AccountField>

        <AccountField
          label="닉네임"
          htmlFor="profile-nickname"
          error={fieldErrors?.nickname}
          className="sm:flex-1"
        >
          <input
            id="profile-nickname"
            name="nickname"
            type="text"
            required
            value={nicknameValue}
            onChange={(event) => setNicknameValue(event.target.value)}
            minLength={NICKNAME_MIN_LENGTH}
            maxLength={NICKNAME_MAX_LENGTH}
            autoComplete="nickname"
            placeholder={`${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자`}
            aria-invalid={fieldErrors?.nickname === undefined ? undefined : true}
            className={INPUT_CLASS}
          />
        </AccountField>
      </div>

      {/* 오너 요청: UID·프로필 코드 입력은 지우지 않고 플래그로만 숨긴다.
          추후 재활성화 시 NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS 만 켜면 된다. */}
      {FEATURES.mswAccountFields ? (
        <>
          <AccountField
            label="글자월드 계정 UID"
            htmlFor="profile-msw-uid"
            help="계정 UID는 “글자월드 - 설정 - 계정 정보” 를 통해서 확인할 수 있습니다."
            error={fieldErrors?.mswUid}
          >
            <input
              id="profile-msw-uid"
              name="mswUid"
              type="text"
              inputMode="numeric"
              required
              value={uidValue}
              onChange={(event) => setUidValue(event.target.value)}
              placeholder="예: 20123456789000000"
              aria-describedby="profile-msw-uid-help"
              aria-invalid={fieldErrors?.mswUid === undefined ? undefined : true}
              className={INPUT_CLASS}
            />
          </AccountField>

          <AccountField
            label="글자월드 프로필 코드"
            htmlFor="profile-msw-code"
            help="프로필 코드는 “글자월드 - 프로필 편집” 를 통해서 확인할 수 있습니다."
            error={fieldErrors?.mswProfileCode}
          >
            <input
              id="profile-msw-code"
              name="mswProfileCode"
              type="text"
              required
              value={codeValue}
              onChange={(event) => setCodeValue(event.target.value)}
              placeholder="예: #abcd0"
              aria-describedby="profile-msw-code-help"
              aria-invalid={fieldErrors?.mswProfileCode === undefined ? undefined : true}
              className={INPUT_CLASS}
            />
          </AccountField>
        </>
      ) : null}
    </div>
  )
}
