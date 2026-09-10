'use client'

import { useState, useTransition } from 'react'

import { CheckboxOnGlyph } from '@/components/account/mypage-icons'
import {
  MYPAGE_CARD_CLASS,
  MYPAGE_CARD_TITLE_CLASS,
  MYPAGE_ERROR_CLASS,
  MYPAGE_LABEL_CLASS,
} from '@/components/account/mypage-styles'
import { updateMarketingAction } from '@/lib/actions/profile-actions'
import { cn } from '@/lib/utils/cn'

import type { MarketingChannel } from '@/lib/validation/account'

const ROWS: readonly { channel: MarketingChannel; label: string }[] = [
  { channel: 'sms', label: 'SMS 수신거부' },
  { channel: 'email', label: '이메일 수신거부' },
]

const SAVED_MESSAGE = '저장됨'

/** 입력과 같은 표면(h56 · #fafafa · border #d5d9df · radius 12) 위의 체크 행. */
const ROW_CLASS =
  'border-field-line bg-field focus-within:outline-focus flex h-14 w-full cursor-pointer items-center ' +
  'gap-5 rounded-[12px] border pl-[23px] focus-within:outline-2'

type MarketingCardProps = {
  smsOptOut: boolean
  emailOptOut: boolean
}

/**
 * "마케팅 수신 설정" 카드 — SMS · 이메일 수신거부(시안 §4.3).
 *
 * 저장 버튼이 없다. 체크하는 순간 서버 액션이 돌고, 화면은 낙관적으로 먼저 바뀐다
 * (실패하면 되돌리고 사유를 남긴다) — 토글 하나 때문에 "저장" 을 한 번 더 누르게
 * 하면 사용자는 바꾼 줄 알고 떠난다.
 *
 * 값의 뜻은 **수신거부**다(컬럼 이름과 같다). 체크 = 받지 않음.
 */
export function MarketingCard({ smsOptOut, emailOptOut }: MarketingCardProps) {
  const [values, setValues] = useState<Record<MarketingChannel, boolean>>({
    sms: smsOptOut,
    email: emailOptOut,
  })
  const [savedChannel, setSavedChannel] = useState<MarketingChannel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggle = (channel: MarketingChannel, nextValue: boolean) => {
    const previous = values[channel]

    setValues((current) => ({ ...current, [channel]: nextValue }))
    setSavedChannel(null)
    setError(null)

    startTransition(async () => {
      const result = await updateMarketingAction(channel, nextValue)

      if (result.ok) {
        setSavedChannel(channel)
      } else {
        setValues((current) => ({ ...current, [channel]: previous }))
        setError(result.message)
      }
    })
  }

  return (
    <section aria-labelledby="marketing-heading" className={MYPAGE_CARD_CLASS}>
      <h2 id="marketing-heading" className={MYPAGE_CARD_TITLE_CLASS}>
        마케팅 수신 설정
      </h2>

      <div className="flex flex-col">
        <span className={MYPAGE_LABEL_CLASS}>현재상태</span>

        <div className="mt-[10px] flex flex-col gap-[10px]">
          {ROWS.map((row) => (
            <label key={row.channel} className={ROW_CLASS}>
              <input
                type="checkbox"
                checked={values[row.channel]}
                onChange={(event) => toggle(row.channel, event.target.checked)}
                className="sr-only"
              />
              {values[row.channel] ? (
                <CheckboxOnGlyph className="size-5 shrink-0" />
              ) : (
                <span
                  aria-hidden
                  className="size-5 shrink-0 rounded-[2.5px] border border-[#767676] bg-white"
                />
              )}
              <span className="text-ink text-ui font-medium tracking-[-0.1px]">{row.label}</span>

              {savedChannel === row.channel ? (
                <span role="status" className="text-ink-muted mr-6 ml-auto text-[14px]">
                  {SAVED_MESSAGE}
                </span>
              ) : null}
            </label>
          ))}
        </div>

        {error === null ? null : (
          <p role="alert" className={cn(MYPAGE_ERROR_CLASS, 'mt-[10px]')}>
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
