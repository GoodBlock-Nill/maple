import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

import type { SVGProps } from 'react'

/**
 * 정지 계정 안내 배너.
 *
 * 서버 컴포넌트(글쓰기 화면)와 클라이언트 컴포넌트(댓글 폼 · 신고 다이얼로그 ·
 * 좋아요 버튼)가 같은 문구를 써야 하므로 훅 없는 순수 표시 컴포넌트로 둔다
 * (`'use client'` 를 붙이지 않는다 — 부르는 쪽의 경계를 그대로 따른다).
 *
 * 문구 자체는 `lib/utils/suspension.ts` 의 `describeSuspension()` 이 만든다. 여기서
 * 기간·사유를 다시 조립하지 않는다. 그래야 폼 오류(서버 액션이 돌려주는 문자열)와
 * 이 배너가 언제나 같은 말을 한다.
 *
 * **본인 상태만** 그린다. 남의 정지 여부는 애초에 조회되지 않는다
 * (`profiles_select_self`).
 */

const SUPPORT_PATH = '/support'

type SuspensionNoticeProps = {
  /** `describeSuspension()` 결과. 예) "정지된 계정입니다 (2026-09-11까지 · 사유: 도배)" */
  message: string
  /** 좁은 자리(좋아요 버튼 아래 · 신고 다이얼로그)에서 두 번째 줄을 한 줄로 줄인다. */
  compact?: boolean
  className?: string
}

function SuspendedIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  )
}

export function SuspensionNotice({ message, compact = false, className }: SuspensionNoticeProps) {
  return (
    <div
      data-testid="suspension-notice"
      className={cn(
        'flex items-start gap-2.5 rounded-[10px] border border-[#fecdd3] bg-[#fff1f2] text-[#b91c1c]',
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5',
        className,
      )}
    >
      <SuspendedIcon className={cn('mt-0.5 shrink-0', compact ? 'size-4' : 'size-5')} />

      <div className={cn('flex flex-col gap-1', compact ? 'text-[14px]' : 'text-[15px]')}>
        <p className="font-semibold">{message}</p>
        <p className="leading-[1.6] text-[#b91c1c]/85">
          {compact ? null : '정지 기간에는 글쓰기 · 댓글 · 신고 · 좋아요를 이용할 수 없습니다. '}
          문의는{' '}
          <Link
            href={SUPPORT_PATH}
            className="focus-visible:outline-focus underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            고객지원
          </Link>
          에서 접수해 주세요.
        </p>
      </div>
    </div>
  )
}
