import Link from 'next/link'

import { cn } from '@/lib/utils/cn'
import {
  COUPON_PENDING_PROCESSED_TEXT,
  COUPON_REJECTED_FALLBACK_REASON,
  COUPON_STATUS_HINT,
} from '@/lib/utils/coupon-result'
import { formatDateLong } from '@/lib/utils/format-date'

import type { CouponRedemption } from '@/lib/constants/coupons'

/**
 * 한 건을 펼쳤을 때 나오는 속내용 — 표(데스크톱)와 카드(폰)가 같은 것을 쓴다.
 *
 * 접힌 줄에는 "무엇을 · 언제 · 어떻게 됐나"만 둔다. 여기 있는 값들은 그다음에
 * 필요해지는 것들이다.
 *   보상 안내  — 무엇을 받는지. 쿠폰 이름만으로는 알 수 없다.
 *   등록 계정  — "왜 안 왔지"의 첫 번째 원인은 늘 UID 오타다.
 *   처리일     — 지급 완료·거절이 언제 적혔는지.
 *   거절 사유  — 거절 건에만. 사유 없이 '거절'만 남기면 물어볼 곳이 없다.
 */

const SUPPORT_PATH = '/support'

/* 폰(1열)에서는 항목 사이가 항목 안(라벨↔값)보다 넓어야 짝이 읽힌다. 2열이 되는
   sm 이상에서는 라벨과 값이 같은 줄에 서므로 여백을 되돌린다. */
const TERM_CLASS = 'text-ui-sm text-ink-muted mt-2 font-medium first:mt-0 sm:mt-0'
const VALUE_CLASS = 'text-ui-sm text-ink'

export function CouponHistoryDetail({ item }: { item: CouponRedemption }) {
  const processed =
    item.processedAt === null ? COUPON_PENDING_PROCESSED_TEXT : formatDateLong(item.processedAt)

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-left sm:grid-cols-[max-content_1fr] sm:gap-y-3">
      <dt className={TERM_CLASS}>보상 안내</dt>
      <dd className={VALUE_CLASS}>{item.rewardNote ?? '쿠폰에 적힌 보상이 지급됩니다.'}</dd>

      <dt className={TERM_CLASS}>등록 계정</dt>
      <dd className={VALUE_CLASS}>
        UID {item.mswUid} · 프로필 코드 {item.mswProfileCode}
      </dd>

      <dt className={TERM_CLASS}>처리일</dt>
      <dd className={VALUE_CLASS}>
        {processed}
        <span className="text-ink-muted ml-2">{COUPON_STATUS_HINT[item.status]}</span>
      </dd>

      {item.status === 'rejected' ? (
        <>
          <dt className={cn(TERM_CLASS, 'text-[#c84545]')}>거절 사유</dt>
          <dd className={VALUE_CLASS}>
            {item.adminNote ?? COUPON_REJECTED_FALLBACK_REASON}{' '}
            <Link
              href={SUPPORT_PATH}
              className="text-focus underline underline-offset-[3px] hover:opacity-80"
            >
              고객지원에 문의
            </Link>
          </dd>
        </>
      ) : null}
    </dl>
  )
}
