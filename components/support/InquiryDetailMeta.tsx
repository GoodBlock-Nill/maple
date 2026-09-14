import { ChevronRightSmallIcon } from '@/components/support/support-icons'
import { inquiryKindLabel } from '@/lib/constants/inquiry-kind'
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
 * 상세의 메타 줄(종류 · 등록일 · 카테고리 · 계정 ID · 접수번호).
 *
 * PC 는 세로선으로 끊은 한 줄이고 접수번호만 오른쪽 끝에 선다. 폰은 라벨 60 폭의
 * 목록이다 — 한 줄로 두면 계정 ID 가 접혀 "마스킹된 값의 일부"처럼 읽힌다.
 * 접수번호가 폰에서만 이 목록에 끼는 이유는 제목 줄 오른쪽에 자리가 없기 때문이다.
 *
 * 종류를 맨 앞에 두는 이유는 목록(`InquiryRow`)의 알약과 같은 순서이기 때문이다 —
 * 목록에서 종류를 보고 들어온 사용자가 상세에서 같은 값을 같은 자리에서 찾는다.
 */
export function InquiryDetailMeta({ inquiry }: InquiryDetailMetaProps) {
  const category = (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {inquiry.category}
      <ChevronRightSmallIcon className="text-line-soft size-3.5 shrink-0" />
      {inquiry.type}
    </span>
  )
  const accountId = maskAccountId(inquiry.accountId)
  const createdAt = formatDateLong(inquiry.createdAt)
  const kind = inquiryKindLabel(inquiry.kind)

  return (
    <>
      <div className="hidden items-start justify-between gap-4 lg:flex">
        {/* 항목이 넷(종류가 늘었다)이라 카테고리·유형이 긴 문의에서는 698 폭을
            넘는다. 줄바꿈을 열어 **항목 단위로** 접히게 한다 — 막아 두면 값 하나가
            "2026.09.14 / 10:45" 처럼 가운데서 잘려 두 값처럼 읽힌다. */}
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <DesktopItem label="종류" value={kind} size="sm" />
          <Divider />
          <DesktopItem label="등록일" value={createdAt} size="md" />
          <Divider />
          <DesktopItem label="카테고리" value={category} size="sm" />
          <Divider />
          <DesktopItem label="계정 ID" value={accountId} size="md" />
        </dl>
        <span className="mt-0.5 shrink-0 text-[13px] leading-[18px] font-medium text-[#727272] tabular-nums">
          <span className="sr-only">접수번호 </span>
          {formatInquiryNoLabel(inquiry.inquiryNo)}
        </span>
      </div>

      <dl className="flex flex-col gap-1 text-[13px] leading-[18px] font-medium lg:hidden">
        <MobileItem label="종류" value={kind} />
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
          ? 'flex items-center gap-2 text-[15px] leading-[22px] font-medium whitespace-nowrap'
          : 'flex items-center gap-2 text-[14px] leading-[20px] font-medium whitespace-nowrap'
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
