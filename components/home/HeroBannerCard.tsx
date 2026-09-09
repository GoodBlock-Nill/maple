import Image from 'next/image'
import Link from 'next/link'

import { HeroVideoButton } from '@/components/home/HeroVideoButton'
import { cn } from '@/lib/utils/cn'

import type { HeroBanner } from '@/types/domain'

type HeroBannerCardProps = {
  banner: HeroBanner
  className?: string
}

const DEFAULT_CTA_LABEL = '자세히 보기'

/**
 * 관리자 "사이트 설정 → 히어로 배너" 한 장을 홈 히어로에 얹는 미디어 카드.
 *
 * 제목·부제는 화면에 그리지 않는다(제품 결정 2026-09-09) — 관리자 목록의 식별자이자
 * 이미지 대체 텍스트·접근성 라벨로만 쓴다. 카드는 이미지(또는 유튜브 썸네일) 그
 * 자체다.
 *
 * 자리: CTA 두 개 아래, 다음 섹션의 구름이 덮기 시작하는 곳 위. 1440 실측으로
 * 소년(x≤444)·버섯(x≥1119) 사이 x 470~1090 · y 440~590 이 캐릭터를 가리지 않는
 * 유일한 띠다. 그래서 폭을 xl 520 · lg 380 으로 묶고 비율 52:14(≈3.7:1)로 높이를
 * 정한다(xl 140px → 하단 580, 구름 시작 597 안쪽). 테두리는 헤더·CTA 링과 같은
 * `.glass` 를 얇게 둘러 시안 위에 얹어도 이질감이 없게 한다.
 *
 * 폰(<lg)에서는 캐릭터가 히어로 하단 양옆에 작게 있어 카드가 겹친다. HeroSection 이
 * 배너가 있을 때 섹션을 240px 더 키워(캐릭터 레이어는 하단 고정) 카드 자리를 만든다.
 *
 * 유튜브 배너는 썸네일 + 재생 배지이고, 누르면 모달에서 재생한다(HeroVideoButton).
 * 링크가 있으면 이미지 배너는 카드 전체가 링크, 유튜브 배너는 우하단 pill 이 링크다.
 */
export function HeroBannerCard({ banner, className }: HeroBannerCardProps) {
  const ctaLabel = banner.ctaLabel ?? DEFAULT_CTA_LABEL
  const frame = cn(
    'glass relative block aspect-[52/14] w-full overflow-hidden rounded-panel p-1.5',
    className,
  )

  if (banner.mediaType === 'youtube' && banner.youtubeId !== null) {
    /* 포스터를 따로 올렸으면 그것을, 아니면 유튜브 기본 썸네일(hqdefault 는 모든
       영상에 존재한다 — maxresdefault 는 저해상도 업로드에 없다). */
    const poster = banner.imageUrl ?? `https://i.ytimg.com/vi/${banner.youtubeId}/hqdefault.jpg`

    return (
      <aside aria-label="히어로 배너" className={frame}>
        <HeroVideoButton
          youtubeId={banner.youtubeId}
          title={banner.title}
          className="group bg-ink/10 relative block size-full overflow-hidden rounded-[14px]"
        >
          <BannerImage src={poster} alt="" />
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-white/90 pl-1 shadow-[0_2px_8px_rgb(0_0_0/0.25)] sm:size-12">
              <svg viewBox="0 0 24 24" className="text-ink size-6" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </HeroVideoButton>

        {banner.linkUrl === null ? null : (
          <Link
            href={banner.linkUrl}
            prefetch={false}
            className="cta-dark rounded-pill absolute right-4 bottom-4 inline-flex h-8 items-center px-3.5 text-[13px] font-semibold hover:brightness-125"
          >
            {ctaLabel}
          </Link>
        )}
      </aside>
    )
  }

  const image = (
    <span className="bg-ink/10 relative block size-full overflow-hidden rounded-[14px]">
      <BannerImage src={banner.imageUrl ?? ''} alt={banner.title} />
    </span>
  )

  if (banner.linkUrl === null) {
    return (
      <aside aria-label="히어로 배너" className={frame}>
        {image}
      </aside>
    )
  }

  return (
    <Link
      href={banner.linkUrl}
      prefetch={false}
      aria-label={`${banner.title} — ${ctaLabel}`}
      className={cn(frame, 'transition-[filter] hover:brightness-105')}
    >
      {image}
    </Link>
  )
}

/* 주소는 Storage 공개 URL · 사이트 정적 경로 · 관리자가 붙인 외부 URL 이 섞인다.
   외부 호스트는 next.config 의 remotePatterns 밖이라 최적화를 거치면 런타임에서
   던지므로, 사이트 정적 경로가 아닌 것은 `unoptimized` 로 원본을 그대로 쓴다. */
function BannerImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(min-width: 1280px) 520px, (min-width: 1024px) 380px, 100vw"
      unoptimized={!src.startsWith('/')}
      className="object-cover"
    />
  )
}
