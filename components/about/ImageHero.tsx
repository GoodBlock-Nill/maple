import Image from 'next/image'
import Link from 'next/link'

import { HeroMediaFrame } from '@/components/about/HeroMediaFrame'

/**
 * 소개 페이지 상단 영역의 **이미지 배너** 버전.
 *
 * 관리자 "사이트 설정 → 히어로 배너"에서 유형을 이미지로 고르면 영상 히어로
 * (VideoHero) 대신 같은 프레임(HeroMediaFrame)을 쓴다. 배경은 시안 히어로 배경
 * 그대로이고, 상자 안에 이미지를 채운다.
 * 재생 버튼은 없고, 링크가 있으면 상자 전체가 링크다.
 */
type ImageHeroProps = {
  src: string
  alt: string
  href: string | null
}

export function ImageHero({ src, alt, href }: ImageHeroProps) {
  /* Storage 공개 URL 이나 외부 주소는 next.config 의 remotePatterns 밖일 수 있어
     최적화를 거치지 않는다(거치면 런타임에서 던진다). 사이트 정적 경로만 최적화. */
  const isExternal = !src.startsWith('/')

  const image = (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      sizes="(min-width: 1024px) 804px, 100vw"
      unoptimized={isExternal}
      className="object-cover object-center"
    />
  )

  return (
    <HeroMediaFrame>
      {href === null ? (
        image
      ) : (
        <Link href={href} prefetch={false} aria-label={alt} className="absolute inset-0 block">
          {image}
        </Link>
      )}
    </HeroMediaFrame>
  )
}
