'use client'

import { useActionState, useState } from 'react'

import { AccountField } from '@/components/account/AccountField'
import { CouponHighlightContext } from '@/components/account/coupon-highlight'
import {
  MYPAGE_CARD_CLASS,
  MYPAGE_CARD_TITLE_CLASS,
  MYPAGE_SUBMIT_CLASS,
} from '@/components/account/mypage-styles'
import { AUTH_INPUT_CLASS } from '@/components/auth/auth-scene-styles'
import { redeemCouponAction } from '@/lib/actions/coupon-actions'
import { cn } from '@/lib/utils/cn'

import type { RedeemCouponState } from '@/lib/actions/coupon-actions'
import type { ReactNode } from 'react'

const EMPTY_STATE: RedeemCouponState = {}

const UID_HELP = '계정 UID는 “글자월드 - 설정 - 계정 정보” 를 통해서 확인할 수 있습니다.'
const CODE_HELP = '프로필 코드는 “글자월드 - 프로필 편집” 를 통해서 확인할 수 있습니다.'

const INPUT_CLASS = cn(AUTH_INPUT_CLASS, 'pr-[23px]')

type CouponFormProps = {
  /** 프로필에 저장된 값이 있으면 미리 채운다(수정 가능). */
  defaultMswUid: string
  defaultMswProfileCode: string
  /** 아래에 이어 붙는 "쿠폰 등록 내역" 카드. 서버에서 그려 넘긴다. */
  children?: ReactNode
}

/**
 * "쿠폰 등록" 카드(시안 §5).
 *
 * 입력 세 칸은 제어 컴포넌트다. React 19 는 `<form action>` 이 끝나면 폼을 자동으로
 * 초기화하는데, 그대로 두면 **오류가 났을 때도** 사용자가 친 값이 통째로 사라진다
 * (코드 한 글자 틀렸다고 UID 까지 다시 입력하게 된다).
 *
 * 성공했을 때만 비운다 — `key` 로 입력 묶음을 새로 마운트하면 코드 칸은 비고,
 * UID·프로필 코드는 갱신된 프로필 값(RPC 가 첫 등록 때 채운다)으로 다시 채워진다.
 *
 * `children`(등록 내역 카드)은 이 카드 **밖**에 그린다. 성공 직후 방금 만들어진
 * 줄을 짚어야 해서 액션 결과의 `redemptionId` 를 컨텍스트로 내려보내는데, 그 값을
 * 아는 곳이 여기뿐이라 두 카드를 한 컴포넌트가 감싼다.
 */
export function CouponForm({ defaultMswUid, defaultMswProfileCode, children }: CouponFormProps) {
  const [state, formAction] = useActionState(redeemCouponAction, EMPTY_STATE)

  return (
    <CouponHighlightContext value={state.redemptionId ?? null}>
      <section aria-labelledby="coupon-heading" className={MYPAGE_CARD_CLASS}>
        <h2 id="coupon-heading" className={MYPAGE_CARD_TITLE_CLASS}>
          쿠폰 등록
        </h2>

        {state.formError === undefined ? null : (
          <p
            role="alert"
            className="border-badge-red/40 text-badge-red rounded-[10px] border bg-white/70 px-4 py-3 text-[15px]"
          >
            {state.formError}
          </p>
        )}

        {state.message === undefined ? null : (
          <p
            role="status"
            className="border-line-soft text-ink rounded-[10px] border bg-white/70 px-4 py-3 text-[15px]"
          >
            {state.message}
            {state.couponName === undefined ? null : (
              <span className="text-ink-muted block">등록한 쿠폰: {state.couponName}</span>
            )}
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-8">
          <CouponFields
            key={state.successAt ?? 0}
            defaultMswUid={defaultMswUid}
            defaultMswProfileCode={defaultMswProfileCode}
            fieldErrors={state.fieldErrors}
          />

          <button type="submit" className={MYPAGE_SUBMIT_CLASS}>
            쿠폰 등록
          </button>
        </form>
      </section>

      {children}
    </CouponHighlightContext>
  )
}

type CouponFieldsProps = {
  defaultMswUid: string
  defaultMswProfileCode: string
  fieldErrors?: Record<string, string>
}

function CouponFields({ defaultMswUid, defaultMswProfileCode, fieldErrors }: CouponFieldsProps) {
  const [code, setCode] = useState('')
  const [mswUid, setMswUid] = useState(defaultMswUid)
  const [mswProfileCode, setMswProfileCode] = useState(defaultMswProfileCode)

  return (
    <div className="flex flex-col gap-8">
      <AccountField label="쿠폰 코드" htmlFor="coupon-code" error={fieldErrors?.code}>
        <input
          id="coupon-code"
          name="code"
          type="text"
          required
          autoComplete="off"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="쿠폰의 코드번호를 입력하세요."
          aria-invalid={fieldErrors?.code === undefined ? undefined : true}
          className={cn(INPUT_CLASS, 'uppercase')}
        />
      </AccountField>

      <AccountField
        label="글자월드 계정 UID"
        htmlFor="coupon-msw-uid"
        help={UID_HELP}
        error={fieldErrors?.mswUid}
      >
        <input
          id="coupon-msw-uid"
          name="mswUid"
          type="text"
          inputMode="numeric"
          required
          value={mswUid}
          onChange={(event) => setMswUid(event.target.value)}
          placeholder="예: 20123456789000000"
          aria-describedby="coupon-msw-uid-help"
          aria-invalid={fieldErrors?.mswUid === undefined ? undefined : true}
          className={INPUT_CLASS}
        />
      </AccountField>

      <AccountField
        label="글자월드 프로필 코드"
        htmlFor="coupon-msw-code"
        help={CODE_HELP}
        error={fieldErrors?.mswProfileCode}
      >
        <input
          id="coupon-msw-code"
          name="mswProfileCode"
          type="text"
          required
          value={mswProfileCode}
          onChange={(event) => setMswProfileCode(event.target.value)}
          placeholder="예: #abcd0"
          aria-describedby="coupon-msw-code-help"
          aria-invalid={fieldErrors?.mswProfileCode === undefined ? undefined : true}
          className={INPUT_CLASS}
        />
      </AccountField>
    </div>
  )
}
