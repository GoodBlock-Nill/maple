import Image from 'next/image'

import {
  LOGIN_CHARACTERS,
  LOGIN_STAGE_HEIGHT,
  LOGIN_STAGE_WIDTH,
} from '@/components/auth/login-characters'

import type { LoginCharacter } from '@/components/auth/login-characters'

/**
 * 로그인 화면 좌우의 캐릭터 무대(시안 Group 225 · 226).
 *
 * 무대는 1440×868 로 **고정**하고 가운데 정렬한다. 본문 블록도 같은 중심선을
 * 쓰므로 화면이 좁아져도 캐릭터와 글자의 간격(각 8px)이 그대로 유지된다 —
 * 무대를 뷰포트 폭에 비례해 줄이면 1024~1280 에서 캐릭터가 버튼 위를 덮는다.
 * lg(1024) 미만에서는 시안에 캐릭터가 없으므로 아예 그리지 않는다.
 */
export function LoginCharacters() {
  return (
    <div
      aria-hidden
      style={{ width: LOGIN_STAGE_WIDTH, height: LOGIN_STAGE_HEIGHT }}
      className="pointer-events-none absolute top-0 left-1/2 hidden -translate-x-1/2 select-none lg:block"
    >
      {LOGIN_CHARACTERS.map((character) => (
        <Character key={character.id} character={character} />
      ))}
    </div>
  )
}

/** 말풍선 흰 판 + 꼬리. 그림자는 두 조각에 같은 값으로 걸어 이음매를 지운다. */
const BUBBLE_SHADOW = 'drop-shadow-[0_0_12px_rgba(0,0,0,0.12)]'

function Character({ character }: { character: LoginCharacter }) {
  const { bubble, placement, shadows, src, naturalWidth, naturalHeight } = character

  return (
    <>
      <div
        data-bubble={character.id}
        style={bubble.placement}
        className={`absolute ${BUBBLE_SHADOW}`}
      >
        <div className="flex h-full w-full flex-col justify-center rounded-[12px] bg-white px-4 py-3">
          {bubble.lines.map((line) => (
            <span
              key={line}
              className="block text-[13px] leading-[20px] tracking-[-0.33px] whitespace-nowrap text-[#727272]"
            >
              {line}
            </span>
          ))}
        </div>
      </div>

      {/* 꼬리는 말풍선과 같은 흰색·같은 그림자를 쓴다. 삼각형이라 clip-path 로 깎는다. */}
      <div
        style={{ ...bubble.tail, clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
        className={`absolute bg-white ${BUBBLE_SHADOW}`}
      />

      {/* 발밑 타원. 캐릭터보다 먼저 그려 캐릭터가 위에 오게 한다. */}
      {shadows.map((shadow, index) => (
        <div
          key={`${character.id}-${index}`}
          style={shadow}
          className="absolute rounded-[50%] bg-[#e6e9ed]"
        />
      ))}

      <Image
        src={src}
        alt=""
        width={naturalWidth}
        height={naturalHeight}
        priority
        sizes="256px"
        style={placement}
        className="absolute max-w-none object-contain"
      />
    </>
  )
}
