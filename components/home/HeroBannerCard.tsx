import Image from 'next/image'
import Link from 'next/link'

import { HeroVideoButton } from '@/components/home/HeroVideoButton'
import { Button } from '@/components/ui/Button'
import { ArrowRightIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils/cn'

import type { HeroBanner } from '@/types/domain'

type HeroBannerCardProps = {
  banner: HeroBanner
  className?: string
}

const DEFAULT_CTA_LABEL = '자세히 보기'

/**
 * 관리자 "사이트 설정 → 히어로 배너" 한 장을 홈 히어로에 얹는 카드.
 *
 * 자리: CTA 두 개 아래, 다음 섹션의 구름이 덮기 시작하는 곳 위. 1440 실측으로
 * 소년(x≤444)·버섯(x≥1119) 사이 x 470~1090 · y 440~590 이 캐릭터를 가리지 않는
 * 유일한 띠다. 그래서 폭을 xl 520 · lg 400 으로 묶고, 표면은 헤더·CTA 링과 같은
 * `.glass` 를 써 시안 위에 얹어도 이질감이 없게 한다.
 *
 * 폰(<lg)에서는 캐릭터가 히어로 하단 양옆에 작게 있어 카드가 겹친다. HeroSection 이
 * 배너가 있을 때 섹션을 240px 더 키워(캐릭터 레이어는 하단 고정) 카드 자리를 만든다.
 *
 * 유튜브 배너는 썸네일 + 재생 배지이고, 누르면 모달에서 재생한다(HeroVideoButton).
 */
export function HeroBannerCard({ banner, className }: HeroBannerCardProps) {
  const ctaLabel = banner.ctaLabel ?? DEFAULT_CTA_LABEL
  const isImageLink = banner.mediaType === 'image' && banner.linkUrl !== null

  const surface = cn(
    'glass rounded-panel flex w-full items-center gap-3 p-2.5 text-left sm:gap-4 sm:p-3',
    isImageLink && 'transition-[filter] hover:brightness-105',
    className,
  )

  const body = (
    <>
      <HeroBannerMedia banner={banner} />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink truncate text-[15px] leading-tight font-semibold sm:text-[17px]">
          {banner.title}
        </span>
        {banner.subtitle === null ? null : (
          <span className="text-ink-muted truncate text-[13px] leading-snug sm:text-[14px]">
            {banner.subtitle}
          </span>
        )}
      </span>

      {banner.linkUrl === null ? null : isImageLink ? (
        <span className="cta-dark rounded-pill hidden h-9 shrink-0 items-center px-4 text-[14px] font-semibold sm:inline-flex">
          {ctaLabel}
        </span>
      ) : (
        <Button
          href={banner.linkUrl}
          variant="dark"
          size="sm"
          prefetch={false}
          className="hidden h-9 shrink-0 text-[14px] sm:inline-flex"
        >
          {ctaLabel}
        </Button>
      )}
      {banner.linkUrl === null ? null : (
        <ArrowRightIcon className="text-ink size-5 shrink-0 sm:hidden" aria-hidden />
      )}
    </>
  )

  if (isImageLink && banner.linkUrl !== null) {
    return (
      <Link
        href={banner.linkUrl}
        prefetch={false}
        aria-label={`${banner.title} — ${ctaLabel}`}
        className={surface}
      >
        {body}
      </Link>
    )
  }

  return (
    <aside aria-label="히어로 배너" className={surface}>
      {body}
    </aside>
  )
}

const MEDIA_FRAME_CLASS =
  'relative block h-[54px] w-[96px] shrink-0 overflow-hidden rounded-[10px] bg-ink/10 sm:h-[81px] sm:w-[144px]'

function HeroBannerMedia({ banner }: { banner: HeroBanner }) {
  if (banner.mediaType === 'youtube' && banner.youtubeId !== null) {
    /* 포스터를 따로 올렸으면 그것을, 아니면 유튜브 기본 썸네일(hqdefault 는 모든
       영상에 존재한다 — maxresdefault 는 저해상도 업로드에 없다). */
    const poster = banner.imageUrl ?? `https://i.ytimg.com/vi/${banner.youtubeId}/hqdefault.jpg`

    return (
      <HeroVideoButton
        youtubeId={banner.youtubeId}
        title={banner.title}
        className={cn(MEDIA_FRAME_CLASS, 'group')}
      >
        <BannerImage src={poster} />
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-white/90 pl-0.5 sm:size-10">
            <svg viewBox="0 0 24 24" className="text-ink size-4 sm:size-5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </HeroVideoButton>
    )
  }

  return (
    <span className={MEDIA_FRAME_CLASS}>
      <BannerImage src={banner.imageUrl ?? ''} />
    </span>
  )
}

/* 주소는 Storage 공개 URL · 사이트 정적 경로 · 관리자가 붙인 외부 URL 이 섞인다.
   외부 호스트는 next.config 의 remotePatterns 밖이라 최적화를 거치면 런타임에서
   던지므로, 사이트 정적 경로가 아닌 것은 `unoptimized` 로 원본을 그대로 쓴다. */
function BannerImage({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="144px"
      unoptimized={!src.startsWith('/')}
      className="object-cover"
    />
  )
}
