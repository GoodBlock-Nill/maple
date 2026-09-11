'use client'

import { useActionState, useState } from 'react'

import { AccountField } from '@/components/account/AccountField'
import {
  MYPAGE_CARD_BODY_CLASS,
  MYPAGE_CARD_CLASS,
  MYPAGE_FIELD_WIDTH_CLASS,
  MYPAGE_HINT_CLASS,
  MYPAGE_INPUT_CLASS,
  MYPAGE_PILL_BUTTON_CLASS,
} from '@/components/account/mypage-styles'
import { MyPageTabBar } from '@/components/account/MyPageTabBar'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { NoticeDialog } from '@/components/ui/NoticeDialog'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { updateMswLinkAction } from '@/lib/actions/profile-actions'
import { cn } from '@/lib/utils/cn'

import type { FormState } from '@/lib/actions/form-state'

const UID_FIELD_ID = 'account-msw-uid'
const CODE_FIELD_ID = 'account-msw-code'

export const MSW_LINK_COMING_SOON_NOTICE = '월드 계정 연동은 준비 중입니다.'
export const MSW_LINKED_DIALOG_TITLE = '계정이 연동되었습니다'

const UID_HELP = 'UID 확인: 메이플스토리 월드 > 설정 > 계정'
const CODE_HELP = '프로필 코드 확인: 메이플스토리 월드 > 더보기 > 프로필 편집'

type MswLinkCardProps = {
  activeHref: string
  mswUid: string
  mswProfileCode: string
  /** `FEATURES.mswAccountFields`. 꺼져 있으면 입력·버튼이 비활성이다. */
  enabled: boolean
}

/**
 * "계정 연동" 카드(시안 §4) — 글자월드 UID · 프로필 코드.
 *
 * 플래그가 꺼져 있는 동안에는 화면을 지우지 않고 **비활성**으로 남긴다(오너 요청과
 * 같은 방식). 사이드바의 "준비중" 배지와 카드 상단 안내가 같은 사실을 말한다.
 *
 * 성공하면 모달 하나로 알린다 — 저장된 값은 그대로 남으므로 인라인 문구보다
 * "연동됐다"는 사실이 분명하다.
 */
export function MswLinkCard({ activeHref, mswUid, mswProfileCode, enabled }: MswLinkCardProps) {
  const [state, formAction, isPending] = useActionState(updateMswLinkAction, EMPTY_FORM_STATE)
  const [uid, setUid] = useState(mswUid)
  const [code, setCode] = useState(mswProfileCode)
  /* 성공 모달은 **상태에서 파생**한다 — effect 로 열면 렌더가 한 번 더 돌고
     (react-hooks/set-state-in-effect), 닫은 뒤 다시 열리는 사고도 생긴다.
     닫을 때 그 결과를 "이미 본 것"으로 적어 두면 같은 제출에서는 다시 열리지 않고,
     다음 제출은 새 객체라 자동으로 다시 열린다. */
  const [seenState, setSeenState] = useState<FormState | null>(null)
  const isDialogOpen = state.message !== undefined && state !== seenState

  return (
    <section aria-label="계정 연동" className={MYPAGE_CARD_CLASS}>
      <MyPageTabBar activeHref={activeHref} />

      <form action={formAction} className={cn(MYPAGE_CARD_BODY_CLASS, 'flex flex-col gap-8')}>
        {enabled ? null : (
          <p className={cn(MYPAGE_HINT_CLASS, 'text-[14px]')}>{MSW_LINK_COMING_SOON_NOTICE}</p>
        )}

        {state.formError === undefined ? null : <FormFeedback state={state} />}

        <AccountField
          label="글자월드 계정 UID"
          htmlFor={UID_FIELD_ID}
          help={UID_HELP}
          error={state.fieldErrors?.mswUid}
        >
          <input
            id={UID_FIELD_ID}
            name="mswUid"
            type="text"
            inputMode="numeric"
            required
            disabled={!enabled}
            value={uid}
            onChange={(event) => setUid(event.target.value)}
            placeholder="예: 20123456789000000"
            aria-describedby={`${UID_FIELD_ID}-help`}
            aria-invalid={state.fieldErrors?.mswUid === undefined ? undefined : true}
            className={cn(MYPAGE_INPUT_CLASS, MYPAGE_FIELD_WIDTH_CLASS)}
          />
        </AccountField>

        <AccountField
          label="글자월드 프로필 코드"
          htmlFor={CODE_FIELD_ID}
          help={CODE_HELP}
          error={state.fieldErrors?.mswProfileCode}
        >
          <input
            id={CODE_FIELD_ID}
            name="mswProfileCode"
            type="text"
            required
            disabled={!enabled}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="예: #abcd0"
            aria-describedby={`${CODE_FIELD_ID}-help`}
            aria-invalid={state.fieldErrors?.mswProfileCode === undefined ? undefined : true}
            className={cn(MYPAGE_INPUT_CLASS, MYPAGE_FIELD_WIDTH_CLASS)}
          />
        </AccountField>

        <button
          type="submit"
          disabled={!enabled || isPending}
          className={cn(MYPAGE_PILL_BUTTON_CLASS, 'w-[183px] self-start')}
        >
          계정 연동하기
        </button>
      </form>

      <NoticeDialog
        open={isDialogOpen}
        title={MSW_LINKED_DIALOG_TITLE}
        onClose={() => setSeenState(state)}
      />
    </section>
  )
}
