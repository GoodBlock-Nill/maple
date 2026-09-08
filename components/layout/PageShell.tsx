import Image from 'next/image'

import { PAGE_HERO } from '@/components/layout/page-hero'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { filterExistingAssets, hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'

import type { PageHeroConfig, PageVariant } from '@/components/layout/page-hero'
import type { CSSProperties, ReactNode } from 'react'

/**
 * 서브 페이지 공용 셸.
 *
 * 상단 배경 밴드가 떠 있는 글래스 헤더 뒤까지 올라오고, 마스코트는 1440 기준
 * 절대 좌표로 배치된다(좁은 화면에서는 숨김). 본문은 1200 컨테이너다.
 */
type PageShellProps = {
  variant: PageVariant
  title: string
  /** 제목 아래에 얹히는 모달 등, 컨테이너 밖에 두어야 하는 노드. */
  overlay?: ReactNode
  children: ReactNode
}

export function PageShell({ variant, title, overlay, children }: PageShellProps) {
  const hero = PAGE_HERO[variant]
  const contentStyle = { '--content-top': `${hero.contentTop}px` } as CSSProperties

  return (
    <>
      <div className="bg-page-sub relative isolate overflow-x-clip">
        <PageHeroBackdrop hero={hero} />

        <div
          style={contentStyle}
          className="relative mx-auto w-full max-w-[1200px] px-4 pt-[190px] xl:px-0 xl:pt-[var(--content-top)]"
        >
          {/* 시안의 letter-spacing −3.6px 는 Figma 쪽 서체 기준값이다. Pretendard 로
              같은 렌더 폭을 얻으려면 트래킹을 0 으로 둬야 한다(실측 대조). */}
          <h1 className="text-ink text-center text-[clamp(36px,5vw,64px)] leading-[1.17] font-semibold">
            {title}
          </h1>
          <div className="mt-10 flex flex-col xl:mt-[52px]">{children}</div>
        </div>
      </div>

      {overlay}

      <SiteFooter variant={variant} />
    </>
  )
}

type PageHeroBackdropProps = {
  hero: PageHeroConfig
}

function PageHeroBackdrop({ hero }: PageHeroBackdropProps) {
  const { band } = hero
  /**
   * `-z-10` 이 밴드 컨테이너를 스태킹 컨텍스트로 만들어 mix-blend 의 격리
   * 경계가 된다. 곱연산 대상이 될 바탕색은 컨테이너가 직접 칠해야 한다.
   */
  const bandStyle = {
    '--band-height': `${band.height}px`,
    backgroundColor: band.blend ? 'var(--color-page-sub)' : undefined,
  } as CSSProperties

  return (
    <>
      <div
        aria-hidden
        style={bandStyle}
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[var(--band-height)] overflow-hidden"
      >
        {band.fallback ? (
          /* TODO(asset): 상단 배경이 아직 없을 때 대신 깔리는 그라데이션. */
          <div className="absolute inset-0" style={{ backgroundImage: band.fallback }} />
        ) : null}
        {hasPublicAsset(band.src) ? (
          <Image
            src={band.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className={cn('object-cover object-top', band.blend && 'mix-blend-multiply')}
          />
        ) : null}
        {/* 밴드 하단을 페이지 바탕색으로 녹여 이음매를 지운다. */}
        <div className="to-page-sub absolute inset-x-0 bottom-0 h-[100px] bg-gradient-to-b from-transparent" />
      </div>

      {/* 마스코트는 밴드 밖으로 삐져나오므로 클리핑되지 않는 별도 레이어에 둔다. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -z-10 hidden h-0 w-[1440px] -translate-x-1/2 lg:block"
      >
        {/* TODO(asset): 아직 내려받지 못한 장식은 조용히 건너뛴다. */}
        {filterExistingAssets(hero.mascots).map((mascot) => (
          <Image
            key={mascot.src}
            src={mascot.src}
            alt=""
            width={mascot.width}
            height={mascot.height}
            unoptimized={mascot.animated}
            priority
            style={{ left: mascot.left, top: mascot.top, width: mascot.width }}
            className="absolute max-w-none"
          />
        ))}
      </div>
    </>
  )
}
