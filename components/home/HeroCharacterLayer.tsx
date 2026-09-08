import Image from 'next/image'

import { HERO_CHARACTERS, heroCharacterStyle } from '@/components/home/hero-characters'
import { cn } from '@/lib/utils/cn'

/**
 * 히어로 배경 위에 얹히는 캐릭터 GIF 레이어.
 *
 * 레이어는 배경과 같은 1440×760 비율을 유지하고 섹션 하단에 붙는다. 1280 이상
 * 에서는 섹션 높이도 같은 비율이라 배경(`object-cover`)과 정확히 포개지고,
 * 1280 미만에서는 레이어만 폭에 비례해 작아져 캐릭터가 잘리지 않는다.
 */
export function HeroCharacterLayer() {
  return (
    <div
      aria-hidden
      /* 1280 미만에서는 다음 섹션(구름 띠)이 히어로 하단을 시안보다 더 많이
         덮는다. 레이어를 32px 들어 올려 소년 캐릭터가 시안과 비슷한 비율만큼
         구름 위로 보이게 한다. 비율이 일치하는 1280 이상에서는 0 이다. */
      className="pointer-events-none absolute inset-x-0 bottom-[32px] aspect-[1440/760] xl:bottom-0"
    >
      {HERO_CHARACTERS.map((character) => (
        <Image
          key={character.src}
          src={character.src}
          alt=""
          width={Math.round(character.width)}
          height={Math.round(character.height)}
          /* GIF 는 최적화를 거치면 정지 이미지가 되므로 원본을 그대로 쓴다. */
          unoptimized
          priority
          style={heroCharacterStyle(character)}
          className={cn('absolute max-w-none object-cover', character.mirrored && '-scale-x-100')}
        />
      ))}
    </div>
  )
}
