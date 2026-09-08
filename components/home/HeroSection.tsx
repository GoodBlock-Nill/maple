import Image from 'next/image'

import { HeroCharacterLayer } from '@/components/home/HeroCharacterLayer'
import { HeroCtaGroup } from '@/components/home/HeroCtaGroup'
import { SITE_HEADLINE, SITE_TAGLINE } from '@/lib/constants/site'

/**
 * 히어로. 하늘·맵이 합성된 배경 1장 위에 캐릭터 GIF 레이어와 텍스트를 올린다.
 * 헤더가 위에 겹치므로 섹션은 페이지 최상단에서 시작한다.
 *
 * 1280 이상에서 높이를 시안 비율(760/1440)로 고정하는 이유: 760px 로 묶어두면
 * `object-cover` 가 넓은 화면에서 배경을 위아래로 잘라내고, 그 배경에 맞춰 확대한
 * 캐릭터(예: y=78 의 열기구)가 섹션 밖으로 밀려 잘린다. 비율을 유지하면 배경과
 * 캐릭터가 같은 배율로 커져 어디도 잘리지 않는다(1440 에서는 정확히 760).
 * 1280 아래에서는 시안보다 글자가 상대적으로 커져 캐릭터와 겹치므로, 기존 고정
 * 높이를 두고 캐릭터 레이어만 폭에 비례해 줄여 아래쪽에 붙인다.
 */
export function HeroSection() {
  return (
    <section className="relative isolate h-[560px] w-full overflow-hidden sm:h-[680px] lg:h-[760px] xl:h-[calc(100vw*0.5277778)]">
      <Image
        src="/images/home/hero-bg-v2.jpg"
        alt=""
        fill
        sizes="100vw"
        preload
        className="-z-10 object-cover object-center"
      />

      <HeroCharacterLayer />

      {/* 세로 리듬은 시안 렌더(home.png)와 글리프 단위로 맞춘 값이다. 서브카피와
          CTA 는 줄 높이가 서로 달라 일괄 gap 대신 각자 margin 을 갖는다.
          높이가 비율로 움직이는 1280 이상에서는 상단 여백도 같은 비율(220/1440)로
          따라가야 시안의 구도가 유지된다. */}
      <div className="relative mx-auto flex max-w-[1140px] flex-col items-center px-6 pt-[140px] text-center sm:px-[50px] sm:pt-[186px] lg:pt-[220px] xl:pt-[calc(100vw*0.1527778)]">
        <h1 className="text-ink text-[clamp(34px,6vw,64px)] leading-[1.17] font-semibold tracking-[-0.01em] text-balance">
          {SITE_HEADLINE}
        </h1>
        <p className="text-ink-muted mt-2.5 max-w-[640px] text-[clamp(16px,1.8vw,22px)] leading-[1.4] font-semibold">
          {SITE_TAGLINE}
        </p>
        <HeroCtaGroup className="mt-[25px]" />
      </div>
    </section>
  )
}
