import Image from 'next/image'

import { CategoryCardGrid } from '@/components/home/CategoryCardGrid'

const HEADING_ID = 'news-community-heading'

/**
 * 히어로 하단과 164px 겹치는 카드 섹션.
 * 레이어(아래→위): mid-under → 카드 → 제목 → mid-over → 마스코트 GIF.
 * 하단 숲(mid-over)이 푸터 상단 70px 위로 이어져야 하므로 섹션을 z-10 으로 올리고
 * 아래쪽으로 70px 겹치게(-mb) 둔다.
 * xl 이상은 1440×1102 좌표계를 그대로 사용하고, 그 아래는 흐름 레이아웃으로 폴백한다.
 */
export function NewsCommunitySection() {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="relative isolate z-10 -mt-[80px] overflow-hidden bg-[#9bd4f8] sm:-mt-[120px] xl:-mt-[164px] xl:-mb-[70px] xl:h-[1102px] xl:bg-transparent"
    >
      <Image
        src="/images/home/mid-under.png"
        alt=""
        width={1440}
        height={1102}
        sizes="100vw"
        className="absolute inset-x-0 top-0 z-0 h-auto w-full xl:inset-0 xl:h-full xl:object-cover"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pt-[130px] pb-[200px] sm:pt-[180px] sm:pb-[280px] xl:h-full xl:px-0 xl:pt-0 xl:pb-0">
        <h2
          id={HEADING_ID}
          className="text-ink text-center text-[clamp(32px,5vw,64px)] leading-none font-semibold tracking-[-0.02em] uppercase xl:absolute xl:inset-x-0 xl:top-[280px]"
        >
          NEWS &amp; COMMUNITY
        </h2>
        <CategoryCardGrid className="mt-12 xl:mt-0" />
      </div>

      <Image
        src="/images/home/mid-over.png"
        alt=""
        width={1440}
        height={1102}
        sizes="100vw"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-auto w-full xl:inset-0 xl:h-full xl:object-cover"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 mx-auto hidden w-full max-w-[1440px] xl:block"
      >
        <Image
          src="/images/home/slime.gif"
          alt=""
          width={170}
          height={176}
          unoptimized
          className="absolute top-[721px] left-[1301px]"
        />
        {/* duck.gif 는 150×150 정사각 캔버스 안에 오리 4마리가 좌하단으로 몰려 있다.
            시안의 오리 크기(폭 240)에 맞추려면 캔버스를 379px로 키워야 하고,
            그만큼 투명 여백이 위로 밀려나므로 top 이 음수가 된다. */}
        <Image
          src="/images/home/duck.gif"
          alt=""
          width={379}
          height={379}
          unoptimized
          className="absolute top-[-60px] left-[1064px]"
        />
      </div>
    </section>
  )
}
