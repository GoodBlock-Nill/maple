import { ChevronRightSmallIcon } from '@/components/support/support-icons'
import { formatDateLong } from '@/lib/utils/format-date'
import { formatInquiryNoLabel } from '@/lib/utils/inquiry-no'
import { maskAccountId } from '@/lib/utils/mask'

import type { InquiryDetail } from '@/types/domain'
import type { ReactNode } from 'react'

type InquiryDetailMetaProps = {
  inquiry: InquiryDetail
}

const LABEL_CLASS = 'text-[#727272]'

/**
 * 상세의 메타 줄(등록일 · 카테고리 · 계정 ID · 접수번호).
 *
 * PC 는 세로선으로 끊은 한 줄이고 접수번호만 오른쪽 끝에 선다. 폰은 라벨 60 폭의
 * 네 줄이다 — 한 줄로 두면 계정 ID 가 접혀 "마스킹된 값의 일부"처럼 읽힌다.
 * 접수번호가 폰에서만 이 목록에 끼는 이유는 제목 줄 오른쪽에 자리가 없기 때문이다.
 */
export function InquiryDetailMeta({ inquiry }: InquiryDetailMetaProps) {
  const category = (
    <span className="flex items-center gap-1">
      {inquiry.category}
      <ChevronRightSmallIcon className="text-line-soft size-3.5 shrink-0" />
      {inquiry.type}
    </span>
  )
  const accountId = maskAccountId(inquiry.accountId)
  const createdAt = formatDateLong(inquiry.createdAt)

  return (
    <>
      <div className="hidden items-center justify-between gap-4 lg:flex">
        <dl className="flex items-center gap-4">
          <DesktopItem label="등록일" value={createdAt} size="md" />
          <Divider />
          <DesktopItem label="카테고리" value={category} size="sm" />
          <Divider />
          <DesktopItem label="계정 ID" value={accountId} size="md" />
        </dl>
        <span className="shrink-0 text-[13px] leading-[18px] font-medium text-[#727272] tabular-nums">
          <span className="sr-only">접수번호 </span>
          {formatInquiryNoLabel(inquiry.inquiryNo)}
        </span>
      </div>

      <dl className="flex flex-col gap-1 text-[13px] leading-[18px] font-medium lg:hidden">
        <MobileItem label="접수번호" value={String(inquiry.inquiryNo)} />
        <MobileItem label="등록일" value={createdAt} />
        <MobileItem label="카테고리" value={category} />
        <MobileItem label="계정 ID" value={accountId} />
      </dl>
    </>
  )
}

function Divider() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-[#d9d9d9]" />
}

type ItemProps = {
  label: string
  value: ReactNode
  /** 시안 실측 — 날짜·계정 ID 는 15/22, 카테고리만 14/20 이다. */
  size?: 'sm' | 'md'
}

function DesktopItem({ label, value, size = 'md' }: ItemProps) {
  return (
    <div
      className={
        size === 'md'
          ? 'flex items-center gap-2 text-[15px] leading-[22px] font-medium'
          : 'flex items-center gap-2 text-[14px] leading-[20px] font-medium'
      }
    >
      <dt className={LABEL_CLASS}>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

function MobileItem({ label, value }: ItemProps) {
  return (
    <div className="flex items-start gap-2">
      <dt className={`${LABEL_CLASS} w-[60px] shrink-0`}>{label}</dt>
      <dd className="text-ink min-w-0">{value}</dd>
    </div>
  )
}
