import Image from 'next/image'
import Link from 'next/link'

/**
 * 소개 페이지 상단 영역의 **이미지 배너** 버전.
 *
 * 관리자 "사이트 설정 → 히어로 배너"에서 유형을 이미지로 고르면 영상 히어로
 * (VideoHero) 대신 이 컴포넌트가 같은 자리·같은 크기(데스크톱 763px · 모바일 16:9)를
 * 채운다. 재생 버튼은 없고, 링크가 있으면 영역 전체가 링크다. 위에 얹히는 캐릭터
 * 행·풀숲 오버레이(HeroCharacters)는 그대로 유지된다.
 */
type ImageHeroProps = {
  src: string
  alt: string
  href: string | null
}

const FRAME_CLASS =
  'relative block aspect-video w-full overflow-hidden bg-[#0e0e14] lg:aspect-auto lg:h-[calc(var(--about-w,1440px)*0.5298611)]'

export function ImageHero({ src, alt, href }: ImageHeroProps) {
  const image = (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      sizes="100vw"
      /* Storage 공개 URL 이나 외부 주소는 next.config 의 remotePatterns 밖일 수 있어
         최적화를 거치지 않는다(거치면 런타임에서 던진다). 사이트 정적 경로만 최적화. */
      unoptimized={!src.startsWith('/')}
      className="object-cover object-center"
    />
  )

  if (href === null) {
    return <div className={FRAME_CLASS}>{image}</div>
  }

  return (
    <Link href={href} prefetch={false} aria-label={alt} className={FRAME_CLASS}>
      {image}
    </Link>
  )
}
