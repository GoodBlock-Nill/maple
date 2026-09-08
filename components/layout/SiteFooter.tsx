import Image from 'next/image'
import Link from 'next/link'

import { FOOTER_CONFIG } from '@/components/layout/footer-variants'
import { Logo } from '@/components/layout/Logo'
import {
  CONTACT_EMAIL,
  FOOTER_MENU_LINKS,
  IP_NOTICE,
  POLICY_LINKS,
  SITE_NAME,
  SITE_TAGLINE,
  SNS_LINKS,
} from '@/lib/constants/site'
import { hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'

import type { FooterVariant } from '@/components/layout/footer-variants'
import type { NavItem } from '@/lib/constants/site'
import type { CSSProperties } from 'react'

type SiteFooterProps = {
  /** 페이지별 배경 일러스트·마스코트·패널 위치만 바뀐다. 내용은 동일. */
  variant?: FooterVariant
}

/**
 * 페이지 배경 위에 떠 있는 1300×353 글래스 패널. 우측 상단에 마스코트가 걸친다.
 * 가변 수치(섹션 높이·패널 오프셋·마스코트 좌표)는 Tailwind 동적 클래스 대신
 * CSS 변수로 넘겨 반응형 분기(`xl:`)를 그대로 쓴다.
 */
export function SiteFooter({ variant = 'home' }: SiteFooterProps) {
  const config = FOOTER_CONFIG[variant]
  const { mascot } = config
  const style = {
    '--footer-height': `${config.height}px`,
    '--footer-panel-top': `${config.panelTop}px`,
    '--mascot-left': `${mascot.left}px`,
    '--mascot-top': `${mascot.top}px`,
    '--mascot-width': `${mascot.width}px`,
    '--mascot-mobile-width': `${mascot.mobileWidth}px`,
  } as CSSProperties

  return (
    <footer style={style} className="relative isolate overflow-hidden" data-variant={variant}>
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{ backgroundColor: config.backgroundColor }}
      />
      {/* TODO(asset): 배경 일러스트가 아직 없으면 backgroundColor 만 남는다. */}
      {hasPublicAsset(config.background) ? (
        <Image
          src={config.background}
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
      ) : null}
      {config.needsGrassPatch ? (
        /* 배경 JPG 상단 ~150px 는 원본 PNG의 투명 영역이 흰색으로 구워진 자리다.
           초원색을 곱연산해 잔디 실루엣만 남기고 앞 섹션의 숲과 자연스럽게 잇는다. */
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[190px] bg-[linear-gradient(180deg,#7cc45f_0px,#7cc45f_80px,#5fb44b_140px,#ffffff_190px)] mix-blend-multiply"
        />
      ) : null}

      <div className="relative mx-auto w-full max-w-[1440px] px-4 pt-16 pb-12 xl:h-[var(--footer-height)] xl:px-0 xl:pt-[var(--footer-panel-top)] xl:pb-[70px]">
        {hasPublicAsset(mascot.src) ? (
          <Image
            src={mascot.src}
            alt=""
            width={mascot.width}
            height={mascot.height}
            unoptimized
            aria-hidden
            className="drop-shadow-mascot relative z-20 -mb-8 ml-auto block w-[var(--mascot-mobile-width)] xl:absolute xl:top-[var(--mascot-top)] xl:left-[var(--mascot-left)] xl:mb-0 xl:w-[var(--mascot-width)]"
          />
        ) : null}

        <div
          className={cn(
            config.panelClass,
            'footer-ink rounded-panel mx-auto w-full max-w-[1300px] px-6 py-8 sm:px-10',
            'xl:min-h-[353px] xl:px-[150px] xl:py-10',
          )}
        >
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-[100px]">
            <div className="flex w-full max-w-[309px] flex-col items-start">
              <Logo width={109} height={40} />
              <p className="mt-5 text-[18px] leading-[25px] text-white">{SITE_TAGLINE}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rounded-pill text-ink hover:bg-sheet mt-10 inline-flex bg-white px-10 py-[15px] text-[18px] leading-none font-semibold transition-colors"
              >
                {CONTACT_EMAIL}
              </a>
            </div>

            <FooterColumn title="Menu" links={FOOTER_MENU_LINKS} />
            <FooterColumn title="Legal" links={POLICY_LINKS} />
          </div>

          <hr className="mx-auto mt-6 w-full max-w-[992px] border-0 border-t border-white/40" />

          <div className="mx-auto mt-4 flex w-full max-w-[992px] flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <p className="text-ink-soft text-[16px] font-medium">
              Copyright © {SITE_NAME}. All rights reserved.
            </p>
            <SnsList />
          </div>

          {/* IP 고지는 Legal 열(280px)에서 넘쳐 읽기 어려웠다. 저작권 줄 아래
              전폭 12px 한 줄로 내리고 패널은 min-h 로 늘어나게 둔다. */}
          <p className="text-ink-soft mx-auto mt-4 w-full max-w-[992px] text-[12px] leading-[1.6]">
            {IP_NOTICE}
          </p>
        </div>
      </div>
    </footer>
  )
}

type FooterColumnProps = {
  title: string
  links: readonly NavItem[]
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <nav aria-label={title}>
      <p className="text-[20px] leading-none font-medium text-white">{title}</p>
      <ul className="mt-3 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="rounded-pill text-ink-soft text-[16px] whitespace-nowrap transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SnsList() {
  return (
    <ul className="flex items-center gap-1.5">
      {SNS_LINKS.map((sns) => (
        <li key={sns.href}>
          <Link
            href={sns.href}
            aria-label={sns.label}
            className="flex size-8 items-center justify-center overflow-hidden rounded-[7px] bg-[#edf1f4] transition-opacity hover:opacity-80"
          >
            <Image
              src={sns.icon}
              alt=""
              width={Math.round(sns.width)}
              height={Math.round(sns.height)}
              style={{ width: sns.width, height: sns.height }}
              className={sns.hasOwnPlate ? 'size-8' : undefined}
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}
