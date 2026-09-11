import Link from 'next/link'

import {
  MYPAGE_LEGACY_CARD_CLASS,
  MYPAGE_LEGACY_CARD_TITLE_CLASS,
  MYPAGE_LEGACY_HELP_CLASS,
} from '@/components/account/mypage-styles'
import { BOARD_PILL_CLASS } from '@/components/board/board-styles'
import { INQUIRY_STATUS_MAP, resolveInquiryStatus } from '@/lib/constants/inquiry-status'
import { MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'
import { formatDateIso } from '@/lib/utils/format-date'
import { formatInquiryNo } from '@/lib/utils/inquiry-no'

import type { InquirySummary, ListResult } from '@/types/domain'

/** 시안 실측 컬럼 폭(합계 850). */
const COLUMNS = [
  /* '번호'는 화면에서 센 순번이 아니라 **접수번호**다(2026-09-11). 순번을 적으면
     '더보기'로 페이지가 늘어날 때마다 같은 문의가 다른 번호로 보인다. */
  { key: 'no', label: '접수번호', width: 88 },
  { key: 'category', label: '문의 유형', width: 121 },
  { key: 'title', label: '문의 제목', width: 323 },
  { key: 'date', label: '문의 날짜', width: 197 },
  /* 시안 헤더는 "문의 유형"이 두 번 적혀 있다(오탈자). 마지막 열은 상태다. */
  { key: 'status', label: '상태', width: 121 },
] as const

const CELL_CLASS = 'text-ink text-ui px-2 text-center font-medium'

type InquiryTableProps = {
  list: ListResult<InquirySummary>
}

/**
 * "문의 내역" 카드 — 내 1:1 문의 표(시안 §6).
 *
 * 데이터는 고객지원의 `/support/inquiries` 와 같은 조회(`getMyInquiries`)를 쓰고,
 * 상세도 그대로 그쪽으로 보낸다 — 같은 글을 두 벌로 그리면 답변·첨부·취소 흐름이
 * 갈린다. 여기서는 시안의 표 모양만 새로 입힌다.
 *
 * 행 전체가 상세로 가는 링크다. 제목 셀의 링크를 행 전체로 늘려(`after:inset-0`)
 * 셀마다 링크를 두지 않는다 — 스크린 리더가 한 행에서 링크 다섯 개를 읽지 않도록.
 *
 * 10건이 넘으면 표를 무한정 늘리는 대신 기존 "내 문의 내역" 화면으로 보낸다.
 * 그쪽에 이미 누적 "더보기"와 검색·취소 동작이 있다.
 */
export function InquiryTable({ list }: InquiryTableProps) {
  return (
    <section aria-labelledby="inquiries-heading" className={MYPAGE_LEGACY_CARD_CLASS}>
      <h2 id="inquiries-heading" className={MYPAGE_LEGACY_CARD_TITLE_CLASS}>
        문의 내역
      </h2>

      {list.items.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className={MYPAGE_LEGACY_HELP_CLASS}>아직 문의 내역이 없습니다.</p>
          <Link href="/support" className={BOARD_PILL_CLASS}>
            1:1 문의하기
          </Link>
        </div>
      ) : (
        <>
          {/* 표는 850 고정이다. 좁은 화면에서는 줄이지 않고 가로로 스크롤한다 —
              열을 접으면 "번호·유형·제목·날짜·상태"라는 표의 뜻이 사라진다. */}
          <div className="scrollbar-hidden -mx-1 overflow-x-auto px-1">
            <div className="border-line-soft shadow-top3 min-w-[850px] overflow-hidden rounded-[20px] border">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {COLUMNS.map((column) => (
                    <col key={column.key} style={{ width: column.width }} />
                  ))}
                </colgroup>

                <thead>
                  {/* 시안 실측: 머리 행은 아래 선을 포함해 47px 이다. */}
                  <tr className="bg-tray border-field-line h-[47px] border-b">
                    {COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="text-ui px-2 text-center font-medium text-[#727272]"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {list.items.map((inquiry) => {
                    const status = resolveInquiryStatus(inquiry.status, inquiry.cancelledAt)
                    /* 시안의 배지는 "답변완료"(어두운 알약) 하나뿐이다. 나머지
                       상태는 고객지원 목록과 같은 색 규칙을 그대로 쓴다 — 한
                       화면에서만 다른 색을 쓰면 상태의 뜻이 갈린다. */
                    const badgeClass =
                      status === INQUIRY_STATUS_MAP.answered
                        ? 'bg-ink text-white'
                        : status.className

                    /* 시안 실측 행 피치는 53(행 52 + 아래 선 1)이다. 마지막 행의
                       선은 표 테두리와 겹치므로 지운다. */
                    return (
                      <tr
                        key={inquiry.id}
                        className="border-field-line relative h-[53px] border-b transition-colors last:border-b-0 hover:bg-black/[0.02]"
                      >
                        <td className={cn(CELL_CLASS, 'tabular-nums')}>
                          {formatInquiryNo(inquiry.inquiryNo)}
                        </td>
                        <td className={cn(CELL_CLASS, 'truncate')}>{inquiry.category}</td>
                        <td className={CELL_CLASS}>
                          <Link
                            href={`${MY_INQUIRIES_PATH}/${inquiry.id}`}
                            className="focus-visible:outline-focus block truncate after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                          >
                            {inquiry.title}
                          </Link>
                        </td>
                        <td className={CELL_CLASS}>{formatDateIso(inquiry.createdAt)}</td>
                        <td className={CELL_CLASS}>
                          <span
                            className={cn(
                              'inline-flex items-center justify-center rounded-[5px] px-[10px] py-[5px] text-[15px] leading-none font-medium whitespace-nowrap sm:text-[17px]',
                              badgeClass,
                            )}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {list.hasMore ? (
            <div className="flex justify-center">
              <Link href={MY_INQUIRIES_PATH} className={BOARD_PILL_CLASS}>
                더보기({list.shown}/{list.total})
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
