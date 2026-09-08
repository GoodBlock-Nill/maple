import Image from 'next/image'

import {
  HERO_CHARACTERS,
  HERO_FRAME_HEIGHT,
  HERO_FRAME_WIDTH,
} from '@/components/about/hero-characters'

const STAGE_SRC = '/images/about/hero-stage.png'

/**
 * 히어로 위에 겹치는 캐릭터 무대.
 *
 * 프레임(1440×1017)을 `aspect-ratio` 로 잡고 자식을 % 로 배치해 뷰포트가
 * 좁아져도 구성이 그대로 축소된다 — 어느 폭에서도 캐릭터가 잘리지 않는다.
 * 예외는 시안에서도 프레임을 넘는 오른쪽 버섯뿐이라 컨테이너만 클리핑한다.
 */
export function HeroCharacters() {
  return (
    <div className="relative aspect-[1440/1017] w-full overflow-hidden">
      <Image
        src={STAGE_SRC}
        alt=""
        width={HERO_FRAME_WIDTH}
        height={HERO_FRAME_HEIGHT}
        priority
        className="absolute inset-0 h-full w-full max-w-none"
      />

      {HERO_CHARACTERS.map((character) => (
        <Image
          key={character.src}
          src={character.src}
          alt=""
          width={character.naturalWidth}
          height={character.naturalHeight}
          unoptimized
          priority
          style={{
            left: character.left,
            top: character.top,
            width: character.width,
            height: character.height,
            transform: character.isFlipped ? 'scaleX(-1)' : undefined,
          }}
          className="absolute max-w-none"
        />
      ))}
    </div>
  )
}
