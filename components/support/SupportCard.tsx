import Image from 'next/image'
import Link from 'next/link'

import { SupportTabs } from '@/components/support/SupportTabs'
import { SUPPORT_CARD_CLASS } from '@/components/support/support-styles'
import { SUPPORT_MENU } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'

import type { SupportMenuItem } from '@/lib/constants/support'
import type { ReactNode } from 'react'

type SupportCardProps = {
  /** 현재 활성 메뉴 경로. */
  activeHref: string
  children: ReactNode
}

/**
 * 고객지원 공통 카드(시안 v2).
 *
 * PC 는 좌측 메뉴 374 · 세로 구분선 · 우측 콘텐츠 698 이고, 폰에서는 메뉴가
 * **세그먼트 탭 3개**로 바뀐다 — 374 짜리 메뉴를 세로로 쌓으면 카드 첫 화면이
 * 전부 내비게이션이 되어 정작 문의 폼이 접히기 때문이다.
 *
 * 좌 열 위의 제목·설명 문단은 시안 v2 에서 없어졌다(카드가 바로 메뉴부터 선다).
 */
export function SupportCard({ activeHref, children }: SupportCardProps) {
  return (
    /* 세로 리듬은 시안 렌더 기준(제목 y≈352 · 카드 top 462)이라 그대로 둔다. */
    <div className={cn(SUPPORT_CARD_CLASS, 'mt-6 lg:mt-[2px] lg:flex lg:items-stretch')}>
      <SupportTabs activeHref={activeHref} />

      <nav aria-label="고객지원 메뉴" className="hidden shrink-0 lg:block lg:w-[374px]">
        <ul className="flex flex-col gap-2.5 pt-3">
          {SUPPORT_MENU.map((item) => (
            <li key={item.href}>
              <SupportMenuLink item={item} isActive={item.href === activeHref} />
            </li>
          ))}
        </ul>
      </nav>

      {/* 구분선은 카드 콘텐츠 높이에 맞춰 늘어난다(시안 667 이 최소 높이다). */}
      <div
        aria-hidden
        className="bg-line-soft hidden w-px shrink-0 lg:mr-12 lg:ml-4 lg:block lg:min-h-[667px]"
      />

      <div className="w-full min-w-0 lg:max-w-[698px] lg:flex-1">{children}</div>
    </div>
  )
}

type SupportMenuLinkProps = {
  item: SupportMenuItem
  isActive: boolean
}

function SupportMenuLink({ item, isActive }: SupportMenuLinkProps) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex h-[68px] items-center gap-2.5 rounded-[10px] border p-2.5 transition-colors',
        isActive
          ? 'border-line-soft bg-page-sub shadow-chip'
          : 'hover:border-line-soft border-transparent',
      )}
    >
      <span className="relative block size-12 shrink-0">
        {item.hasOwnPlate ? (
          /* SVG 가 48×48 흰 박스와 그림자를 (7,5) 오프셋으로 직접 그린다. */
          <Image
            src={item.icon}
            alt=""
            width={item.width}
            height={item.height}
            aria-hidden
            className="absolute -top-[5px] -left-[7px] max-w-none"
          />
        ) : (
          <span className="border-line-soft absolute inset-0 flex items-center justify-center rounded-[5px] border bg-white shadow-[0_2px_7px_rgba(0,0,0,0.25)]">
            <Image src={item.icon} alt="" width={item.width} height={item.height} aria-hidden />
          </span>
        )}
      </span>
      <span className="text-ink text-[18px] leading-[26px] font-medium tracking-[-0.45px]">
        {item.label}
      </span>
    </Link>
  )
}
