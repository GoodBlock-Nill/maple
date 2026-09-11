'use client'

import { useState } from 'react'

import { FormError } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { pinIndicator } from '@/lib/utils/news-pin'
import { NEWS_PUBLISH_MODES, type NewsPublishMode } from '@/lib/validation/news'

/**
 * 발행 설정 — 상태 · 예약 시각 · 상단 고정.
 *
 * 예약 입력은 "예약 발행"을 골랐을 때만 **마운트한다**. 숨기기만 하면 폼이 값을
 * 계속 전송해, 임시저장으로 바꿔 저장한 뒤 다시 열었을 때 지난 예약 시각이 되살아난다.
 */

const MODE_LABEL: Record<NewsPublishMode, string> = {
  draft: '임시저장',
  now: '즉시 발행',
  schedule: '예약 발행',
}

const MODE_HINT: Record<NewsPublishMode, string> = {
  draft: '사용자 사이트에 보이지 않습니다.',
  now: '저장과 동시에 공개됩니다.',
  schedule: '지정한 시각이 지나면 자동으로 공개됩니다.',
}

type NewsPublishFieldsProps = {
  defaultMode: NewsPublishMode
  /** `2026-09-08T17:30` 형태(한국 시간). */
  defaultScheduledAt: string
  defaultPinned: boolean
  /** 이 글을 뺀, 지금 고정된 다른 글 수(`getPinnedNewsSummary()`). */
  pinnedCount: number
  scheduleError?: string
  /** 저장 시도 후 서버가 돌려준 한도 초과 안내(`checkPinLimit`). */
  pinError?: string
}

export function NewsPublishFields({
  defaultMode,
  defaultScheduledAt,
  defaultPinned,
  pinnedCount,
  scheduleError,
  pinError,
}: NewsPublishFieldsProps) {
  const [mode, setMode] = useState<NewsPublishMode>(defaultMode)
  const [pinned, setPinned] = useState(defaultPinned)
  const indicator = pinIndicator(pinnedCount, pinned)

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-ink mb-1 text-[13px] font-semibold">발행 설정</legend>

      <div className="flex flex-col gap-2">
        {NEWS_PUBLISH_MODES.map((value) => (
          <label key={value} className="flex items-start gap-2 text-[13px]">
            <input
              type="radio"
              name="publishMode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="accent-accent mt-0.5 size-4"
            />
            <span className="flex flex-col">
              <span className="text-ink font-semibold">{MODE_LABEL[value]}</span>
              <span className="text-muted text-[12px]">{MODE_HINT[value]}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'schedule' && (
        <Input
          type="datetime-local"
          name="scheduledAt"
          label="예약 시각"
          hint="한국 시간(KST) 기준입니다."
          defaultValue={defaultScheduledAt}
          error={scheduleError}
          required
        />
      )}

      <label
        className="border-line flex items-center gap-2 border-t pt-3 text-[13px] has-disabled:opacity-60"
        title={
          indicator.disabled ? `상단 고정은 최대 ${indicator.limit}개까지 가능합니다.` : undefined
        }
      >
        <input
          type="checkbox"
          name="isPinned"
          checked={pinned}
          disabled={indicator.disabled}
          onChange={(event) => setPinned(event.target.checked)}
          className="accent-accent size-4 disabled:cursor-not-allowed"
        />
        <span className="text-ink font-semibold">상단 고정</span>
        <span className="text-muted text-[12px]">
          목록 맨 위에 먼저 보여 줍니다. 고정 {indicator.count}/{indicator.limit}
        </span>
      </label>

      <FormError message={pinError} />
    </fieldset>
  )
}
