'use client'

import { useState, useTransition } from 'react'

import { CheckOnGlyph } from '@/components/account/mypage-icons'
import {
  MYPAGE_CONSENT_BOX_CLASS,
  MYPAGE_ERROR_CLASS,
  MYPAGE_SECTION_TITLE_CLASS,
} from '@/components/account/mypage-styles'
import { NoticeDialog } from '@/components/ui/NoticeDialog'
import { updateMarketingConsentAction } from '@/lib/actions/profile-actions'
import { cn } from '@/lib/utils/cn'

const HEADING_ID = 'marketing-heading'
const CHECKBOX_LABEL = '마케팅 정보 수신 동의'
export const MARKETING_AGREED_DIALOG_TITLE = '마케팅 정보 수신에 동의되었습니다.'

type MarketingConsentBoxProps = {
  /** DB 값은 수신거부 두 칸이다. 화면은 "동의"(둘 다 false) 하나로 합친다. */
  smsOptOut: boolean
  emailOptOut: boolean
}

/**
 * "마케팅 수신 설정"(시안 §3.2) — 카드 밖, 체크박스 하나짜리 900×56 박스.
 *
 * 저장 버튼이 없다. 체크하는 순간 서버 액션이 돌고 화면은 낙관적으로 먼저 바뀐다
 * (실패하면 되돌리고 사유를 남긴다) — 토글 하나 때문에 "저장"을 한 번 더 누르게
 * 하면 사용자는 바꾼 줄 알고 떠난다.
 *
 * **동의로 바뀔 때만** 모달을 띄운다. 해제는 조용히 저장한다 — 끄는 동작까지
 * 모달로 막으면 두 번 누르게 된다.
 */
export function MarketingConsentBox({ smsOptOut, emailOptOut }: MarketingConsentBoxProps) {
  /* 한 칸이라도 수신거부가 남아 있으면 "동의하지 않음"으로 본다(안전한 쪽). */
  const [agreed, setAgreed] = useState(!smsOptOut && !emailOptOut)
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggle = (next: boolean) => {
    setAgreed(next)
    setError(null)

    startTransition(async () => {
      const result = await updateMarketingConsentAction(next)

      if (result.ok) {
        if (next) {
          setDialogOpen(true)
        }

        return
      }

      setAgreed(!next)
      setError(result.message)
    })
  }

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-6">
      <h2 id={HEADING_ID} className={MYPAGE_SECTION_TITLE_CLASS}>
        마케팅 수신 설정
      </h2>

      <label className={MYPAGE_CONSENT_BOX_CLASS}>
        <input
          type="checkbox"
          name="marketingAgreed"
          checked={agreed}
          onChange={(event) => toggle(event.target.checked)}
          className="sr-only"
        />
        {agreed ? (
          <CheckOnGlyph className="text-ink size-[18px] shrink-0 sm:size-[22px]" />
        ) : (
          <span
            aria-hidden
            className="size-[18px] shrink-0 rounded-[4px] border border-[#e5e5ec] bg-white sm:size-[22px]"
          />
        )}
        <span className="text-ink text-[15px] font-medium sm:text-[16px]">{CHECKBOX_LABEL}</span>
      </label>

      {error === null ? null : (
        <p role="alert" className={cn(MYPAGE_ERROR_CLASS, 'mt-0')}>
          {error}
        </p>
      )}

      <NoticeDialog
        open={isDialogOpen}
        title={MARKETING_AGREED_DIALOG_TITLE}
        onClose={() => setDialogOpen(false)}
      />
    </section>
  )
}
