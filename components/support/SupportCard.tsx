import Image from 'next/image'
import Link from 'next/link'

import { SUPPORT_CARD_CLASS } from '@/components/support/support-styles'
import { SUPPORT_DESCRIPTION, SUPPORT_HEADING, SUPPORT_MENU } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'

import type { SupportMenuItem } from '@/lib/constants/support'
import type { ReactNode } from 'react'

type SupportCardProps = {
  /** 현재 활성 메뉴 경로. */
  activeHref: string
  /** 좌 컬럼 제목·설명. 기본값은 시안의 "1:1 문의하기" 카피다. */
  heading?: string
  description?: string
  children: ReactNode
}

/**
 * 고객지원 공통 카드. 좌측 메뉴 + 세로 구분선 + 우측 슬롯.
 * 모바일에서는 구분선을 가로로 눕히고 메뉴가 위로 올라간다.
 */
export function SupportCard({
  activeHref,
  heading = SUPPORT_HEADING,
  description = SUPPORT_DESCRIPTION,
  children,
}: SupportCardProps) {
  return (
    /* 세로 리듬은 시안 렌더(support.png)와 글리프 단위로 맞춘 값이다. */
    <div
      className={cn(
        SUPPORT_CARD_CLASS,
        'mt-6 flex flex-col gap-8 lg:mt-[2px] lg:flex-row lg:gap-6',
      )}
    >
      <div className="flex w-full flex-col gap-8 lg:max-w-[525px] lg:gap-7">
        <div className="flex flex-col gap-2 lg:gap-1">
          <h2 className="font-ui text-ink text-[clamp(24px,3vw,30px)] leading-none font-medium">
            {heading}
          </h2>
          <p className="text-ink-muted text-prose leading-relaxed">{description}</p>
        </div>

        <nav aria-label="고객지원 메뉴">
          <ul className="flex flex-col gap-2.5">
            {SUPPORT_MENU.map((item) => (
              <li key={item.href}>
                <SupportMenuLink item={item} isActive={item.href === activeHref} />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div
        aria-hidden
        className="bg-line h-px w-full shrink-0 lg:h-auto lg:min-h-[667px] lg:w-px"
      />

      <div className="w-full lg:max-w-[561px]">{children}</div>
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
        'flex items-center gap-2.5 rounded-[10px] border p-2.5 transition-colors',
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
      <span className="text-ink text-label-lg font-medium">{item.label}</span>
    </Link>
  )
}
