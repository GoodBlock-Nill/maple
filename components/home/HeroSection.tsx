import Image from 'next/image'

import { HeroCtaGroup } from '@/components/home/HeroCtaGroup'
import { SITE_HEADLINE, SITE_TAGLINE } from '@/lib/constants/site'

/**
 * 히어로. 하늘·맵·캐릭터가 모두 합성된 배경 1장 위에 텍스트와 CTA만 올린다.
 * 헤더가 위에 겹치므로 섹션은 페이지 최상단에서 시작한다.
 */
export function HeroSection() {
  return (
    <section className="relative isolate h-[560px] w-full overflow-hidden sm:h-[680px] lg:h-[760px]">
      <Image
        src="/images/home/hero-bg.jpg"
        alt=""
        fill
        sizes="100vw"
        preload
        className="-z-10 object-cover object-center"
      />

      <div className="mx-auto flex max-w-[1140px] flex-col items-center gap-4 px-6 pt-[140px] text-center sm:px-[50px] sm:pt-[186px] lg:pt-[220px]">
        <h1 className="text-ink text-[clamp(34px,6vw,64px)] leading-[1.17] font-semibold tracking-[-0.01em] text-balance">
          {SITE_HEADLINE}
        </h1>
        <p className="text-ink-muted max-w-[640px] text-[clamp(16px,1.8vw,22px)] leading-[1.4] font-semibold">
          {SITE_TAGLINE}
        </p>
        <HeroCtaGroup />
      </div>
    </section>
  )
}
