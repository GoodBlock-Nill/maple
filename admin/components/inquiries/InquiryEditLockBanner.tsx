'use client'

import { useState } from 'react'

import { PencilIcon } from '@/components/inquiries/inquiry-icons'
import { Button } from '@/components/ui'
import { lockActivityLabel } from '@/lib/validation/inquiry-assignment'

import type { InquiryLockHolder } from '@/components/inquiries/use-inquiry-edit-lock'

/**
 * "OOO 관리자가 답변을 작성하고 있습니다" 배너.
 *
 * 잠금은 강제력이 없으므로 **길을 막지 않고 한 단계만 둔다** — 상대가 자리를 떴을
 * 수도 있고(만료 전), 급한 문의를 대신 처리해야 할 수도 있다. 대신 가로채기는
 * 감사 로그에 남는다.
 *
 * "n분 전 활동"을 함께 적는 이유: 닉네임만 보여 주면 "지금 쓰고 있는지, 아침에 열어
 * 두고 간 것인지" 알 수 없어 운영자가 판단할 근거가 없다.
 */
export function InquiryEditLockBanner({
  holder,
  onTakeOver,
}: {
  holder: InquiryLockHolder
  onTakeOver: () => Promise<void>
}) {
  const [isPending, setPending] = useState(false)

  return (
    <div
      data-testid="inquiry-edit-lock"
      role="status"
      className="rounded-card border-warn/25 bg-warn-soft flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
    >
      <p className="text-ink flex items-center gap-1.5 text-[13px]">
        <PencilIcon className="text-warn" />
        <span>
          <strong className="font-semibold">{holder.nickname}</strong> 관리자가 답변을 작성하고
          있습니다 <span className="text-muted">({lockActivityLabel(holder.at)})</span>
        </span>
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setPending(true)
          void onTakeOver().finally(() => setPending(false))
        }}
      >
        {isPending ? '가져오는 중…' : '그래도 이어서 작성'}
      </Button>
    </div>
  )
}

/**
 * "그사이 스레드가 바뀌었습니다" 안내.
 *
 * 저장 버튼을 누른 뒤에야 충돌을 알려 주면, 운영자는 이미 긴 답변을 다 쓴 뒤다.
 * 폴링이 먼저 알아채면 여기서 미리 말해 준다 — 초안은 그대로 두고 스레드만 새로
 * 받아 오는 버튼 하나를 함께 둔다(`router.refresh()` 는 클라이언트 상태를 지우지 않는다).
 */
export function InquiryThreadStaleBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div
      data-testid="inquiry-thread-stale"
      role="status"
      className="rounded-card border-accent/25 bg-accent-soft flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
    >
      <p className="text-ink text-[13px]">
        다른 운영자가 이 문의를 처리했습니다. 최신 내용을 확인한 뒤 이어서 작성해 주세요.
      </p>
      <Button variant="secondary" size="sm" onClick={onRefresh}>
        최신 내용 보기
      </Button>
    </div>
  )
}
