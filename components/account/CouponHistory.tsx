'use client'

import { useState } from 'react'

import { useCouponHighlight } from '@/components/account/coupon-highlight'
import { CouponHistoryCards } from '@/components/account/CouponHistoryCards'
import { CouponHistoryTable } from '@/components/account/CouponHistoryTable'
import { CouponStatusBadge } from '@/components/account/CouponStatusBadge'
import {
  MYPAGE_CARD_CLASS,
  MYPAGE_CARD_TITLE_CLASS,
  MYPAGE_HELP_CLASS,
} from '@/components/account/mypage-styles'
import { BOARD_PILL_CLASS } from '@/components/board/board-styles'
import { COUPON_HISTORY_PAGE } from '@/lib/constants/coupons'
import { COUPON_DELIVERY_NOTICE, COUPON_STATUS_HINT } from '@/lib/utils/coupon-result'

import type { CouponHistory as CouponHistoryModel } from '@/lib/constants/coupons'
import type { CouponRedemptionStatus } from '@/lib/utils/coupon-result'

/**
 * "쿠폰 등록 내역" 카드 — 등록 폼 바로 아래에 선다(시안 §5 의 선택 항목을 카드로 승격).
 *
 * 이 카드가 답해야 하는 질문은 셋이다.
 *   1. 방금 등록한 것이 들어갔나  → 성공 직후 새 줄이 맨 위에서 잠깐 강조된다.
 *   2. 언제 받나                 → 머리의 안내 한 줄과 상태 범례.
 *   3. 왜 못 받았나              → 거절 건을 펼치면 사유와 고객지원 링크가 있다.
 *
 * 클라이언트 컴포넌트인 이유는 펼침·더보기·강조 셋뿐이다. 데이터는 서버가 RPC 로
 * 읽어 props 로 넘긴다 — 브라우저에는 이미 마스킹된 값만 온다.
 */

const STATUS_ORDER: readonly CouponRedemptionStatus[] = ['pending', 'delivered', 'rejected']

const EMPTY_TITLE = '아직 등록한 쿠폰이 없습니다.'
const EMPTY_BODY =
  '쿠폰 코드는 공지사항·이벤트·방송에서 나눠 드립니다. 받은 코드를 위 “쿠폰 등록”에 입력하면 이 자리에 내역이 쌓이고, 처리 상태를 확인할 수 있습니다.'
const FAILED_TEXT = '지금은 등록 내역을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.'

/** 폼의 첫 칸으로 시선을 돌린다. 빈 목록에서 할 수 있는 유일한 다음 행동이다. */
function focusCouponCodeField(): void {
  const field = document.getElementById('coupon-code')

  field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  field?.focus({ preventScroll: true })
}

export function CouponHistory({ history }: { history: CouponHistoryModel }) {
  const highlightId = useCouponHighlight()
  const [openId, setOpenId] = useState<string | null>(null)
  const [seenHighlight, setSeenHighlight] = useState<string | null>(null)
  const [isExpanded, setExpanded] = useState(false)

  /* 방금 등록한 줄은 펼친 채로 보여 준다 — "대기 중"이라는 낱말만으로는 언제 받는지
     알 수 없고, 그 설명이 접혀 있으면 바로 문의가 된다. 렌더 중 상태 조정이라
     추가 렌더 한 번으로 끝난다(useEffect 로 미루면 한 프레임 늦게 열린다). */
  if (highlightId !== null && highlightId !== seenHighlight) {
    setSeenHighlight(highlightId)
    setOpenId(highlightId)
  }

  const total = history.items.length
  const visible = isExpanded ? history.items : history.items.slice(0, COUPON_HISTORY_PAGE)
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id))

  return (
    <section aria-labelledby="coupon-history-heading" className={MYPAGE_CARD_CLASS}>
      <h2 id="coupon-history-heading" className={MYPAGE_CARD_TITLE_CLASS}>
        쿠폰 등록 내역
      </h2>

      <div className="flex flex-col gap-5">
        <p className={MYPAGE_HELP_CLASS}>{COUPON_DELIVERY_NOTICE}</p>

        {history.failed ? (
          <p role="status" className={MYPAGE_HELP_CLASS}>
            {FAILED_TEXT}
          </p>
        ) : total === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-ink text-ui font-medium">{EMPTY_TITLE}</p>
            <p className={MYPAGE_HELP_CLASS}>{EMPTY_BODY}</p>
            <button type="button" onClick={focusCouponCodeField} className={BOARD_PILL_CLASS}>
              쿠폰 코드 입력하기
            </button>
          </div>
        ) : (
          <>
            <StatusLegend />

            <CouponHistoryTable
              items={visible}
              openId={openId}
              onToggle={toggle}
              highlightId={highlightId}
            />
            <CouponHistoryCards
              items={visible}
              openId={openId}
              onToggle={toggle}
              highlightId={highlightId}
            />

            {isExpanded || total <= COUPON_HISTORY_PAGE ? null : (
              <div className="flex justify-center">
                {/* 이미 다 받아 온 목록이라 서버를 다시 부르지 않는다. */}
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className={BOARD_PILL_CLASS}
                >
                  더보기({COUPON_HISTORY_PAGE}/{total})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** 상태 세 개의 뜻을 한 줄로 펼친다. 배지 색만으로는 무엇도 설명되지 않는다. */
function StatusLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {STATUS_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-2">
          <CouponStatusBadge status={status} size="sm" />
          <span className={MYPAGE_HELP_CLASS}>{COUPON_STATUS_HINT[status]}</span>
        </li>
      ))}
    </ul>
  )
}
