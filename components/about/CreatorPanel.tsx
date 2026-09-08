import Image from 'next/image'

import { CREATOR_INTRO, CREATOR_NAME, CREATOR_SLOGAN } from '@/lib/mock/site'
import { hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'

const PANEL_SRC = '/images/about/creator-panel.png'
const AVATAR_SRC = '/images/about/avatar-dot.png'

/** 양피지 배경 PNG 가 없을 때 텍스트가 놓이는 종이색. */
const PARCHMENT_CLASS = 'bg-[#f7edd7]'

/**
 * 양피지 패널(시안 1341×739).
 *
 * 데스크톱은 지도 프레임·질감·사진 타원이 모두 합성된 배경 PNG 위에 텍스트를
 * 절대 배치한다. 모바일에서는 같은 PNG 를 늘리면 사진이 본문 뒤로 깔려
 * 읽기 어려우므로, 사진 영역만 잘라 상단 이미지로 쓰고 본문은 종이색 카드에
 * 세로로 쌓는다(시안의 "사진 → 이름 → 본문" 스택).
 */
export function CreatorPanel() {
  const hasPanel = hasPublicAsset(PANEL_SRC)

  return (
    <div className="mx-auto w-full max-w-[1341px]">
      <div className="lg:hidden">
        {hasPanel ? (
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-t-[12px]">
            <Image
              src={PANEL_SRC}
              alt=""
              fill
              sizes="100vw"
              aria-hidden
              className="object-cover object-[24%_50%]"
            />
          </div>
        ) : null}
        <div
          className={cn(
            PARCHMENT_CLASS,
            'flex flex-col gap-6 px-6 py-8 sm:px-8',
            hasPanel ? 'rounded-b-[12px]' : 'rounded-[12px]',
          )}
        >
          <CreatorText />
        </div>
      </div>

      <div className="relative hidden aspect-[1341/739] w-full lg:block">
        {hasPanel ? (
          <Image
            src={PANEL_SRC}
            alt=""
            fill
            sizes="(min-width: 1400px) 1341px, 100vw"
            aria-hidden
            className="rounded-[12px] object-cover object-center"
          />
        ) : (
          <div className={cn(PARCHMENT_CLASS, 'absolute inset-0 rounded-[12px]')} />
        )}

        {/* 시안의 텍스트 블록은 패널 세로 중앙이 아니라 그보다 35px 아래에 있다
            (사진 타원·덩굴 장식을 피한 위치). 739 기준 54.7%. */}
        <div className="absolute top-[54.7%] left-[41.4%] flex w-[49.4%] -translate-y-1/2 flex-col gap-10">
          <CreatorText />
        </div>

        {/* TODO(asset): avatar-dot.png 가 없으면 픽셀 아바타는 생략된다. */}
        {hasPublicAsset(AVATAR_SRC) ? (
          <Image
            src={AVATAR_SRC}
            alt=""
            width={206}
            height={285}
            aria-hidden
            className="pointer-events-none absolute top-[48.3%] left-[85.8%] w-[15.4%] max-w-none drop-shadow-[0_8px_10px_rgba(0,0,0,0.35)]"
          />
        ) : null}
      </div>
    </div>
  )
}

/** 이름 · 슬로건 · 본문. 데스크톱/모바일 레이아웃이 같은 내용을 공유한다. */
function CreatorText() {
  return (
    <>
      {/* 시안: 그라데이션 글자 위에 두꺼운 고동색 외곽선(메이플 로고 스타일).
          `background-clip:text` 배경이 먼저 칠해지고 그 위에 스트로크가 얹히므로
          선 두께의 절반이 글자 안쪽을 덮는다 — 시안의 두께감이 그렇게 나온다. */}
      <h2 className="font-display bg-gradient-to-b from-[#ffd200] to-[#ff6c00] bg-clip-text text-[clamp(56px,8vw,100px)] leading-none font-bold text-transparent [-webkit-text-stroke:6px_#382a20] lg:[-webkit-text-stroke:8px_#382a20]">
        {CREATOR_NAME}
      </h2>

      <div className="flex flex-col gap-6 lg:gap-[10px]">
        <p className="font-display text-[clamp(18px,2.2vw,25px)] leading-snug font-bold text-[#f7601b]">
          {CREATOR_SLOGAN}
        </p>

        <div className="flex flex-col gap-5 lg:gap-[15px]">
          {CREATOR_INTRO.map((paragraph) => (
            <p
              key={paragraph}
              className="text-[clamp(16px,1.9vw,22px)] leading-[1.36] font-bold whitespace-pre-line text-[#381f1e]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </>
  )
}
