import Image from 'next/image'

import { PANEL_LAYERS } from '@/components/about/panel-layers'
import { CREATOR_INTRO, CREATOR_NAME, CREATOR_SLOGAN } from '@/lib/mock/site'
import { hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'

const PHOTO_SRC = '/images/about/panel-photo.png'
const AVATAR_SRC = '/images/about/avatar-dot.gif'

/** 양피지 레이어가 하나도 없을 때 텍스트가 놓이는 종이색. */
const PARCHMENT_CLASS = 'bg-[#f7edd7]'

/**
 * 양피지 패널(시안 1341×739).
 *
 * 데스크톱은 시안 레이어(지도 프레임 · 사진 · 덩굴 · 파란 젤리 GIF)를 각각
 * 절대 배치한다. 합성 PNG 한 장으로 구우면 젤리 캐릭터의 애니메이션이 죽고
 * 위치도 시안과 어긋나서(사용자 지적) 분해본을 쓴다.
 * 모바일에서는 사진만 상단에 얹고 본문을 종이색 카드에 세로로 쌓는다.
 */
export function CreatorPanel() {
  const hasPhoto = hasPublicAsset(PHOTO_SRC)

  return (
    <div className="mx-auto w-full max-w-[1341px]">
      {/* 시안 제목("세글자")은 모바일/데스크톱 레이아웃에 각각 한 벌씩(반응형
          CSS 로 둘 중 하나만 보이게) 중복 렌더된다 — 그중 하나를 h1 으로
          승격하면 뷰포트와 무관하게 DOM 에는 항상 h1 이 두 개 남는다.
          그래서 시각 제목은 h2 로 유지하고, 화면에는 보이지 않되 항상
          하나만 존재하는 sr-only h1 을 페이지 대표 제목으로 둔다. */}
      <h1 className="sr-only">세글자 소개</h1>
      <div className="lg:hidden">
        {hasPhoto ? (
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-t-[12px] bg-[#f7edd7]">
            <Image
              src={PHOTO_SRC}
              alt=""
              fill
              /* 원본이 462px 이라 그 이상 요청하면 최적화 이득이 없다. */
              sizes="480px"
              aria-hidden
              className="object-contain object-center"
            />
          </div>
        ) : null}
        <div
          className={cn(
            PARCHMENT_CLASS,
            'flex flex-col gap-6 px-6 py-8 sm:px-8',
            hasPhoto ? 'rounded-b-[12px]' : 'rounded-[12px]',
          )}
        >
          <CreatorText />
        </div>
      </div>

      <div className="relative hidden aspect-[1341/739] w-full lg:block">
        <div className={cn(PARCHMENT_CLASS, 'absolute inset-[8%_4%] rounded-[12px]')} />

        {PANEL_LAYERS.filter((layer) => hasPublicAsset(layer.src)).map((layer) => (
          <Image
            key={layer.src}
            src={layer.src}
            alt=""
            width={layer.naturalWidth}
            height={layer.naturalHeight}
            unoptimized={layer.isAnimated}
            priority={!layer.isAnimated}
            aria-hidden
            style={{
              left: layer.left,
              top: layer.top,
              width: layer.width,
              height: layer.height,
              transform: layer.isFlipped ? 'scaleX(-1)' : undefined,
            }}
            /* 젤리 GIF(66×76 → 276.6×318.5)만 업스케일된다 — `isAnimated` 로
               구분되는 이 목록에서 GIF는 젤리 하나뿐이라 그대로 재사용한다. */
            className={cn(
              'pointer-events-none absolute max-w-none',
              layer.isAnimated && 'pixel-art',
            )}
          />
        ))}

        {/* 시안의 텍스트 블록은 패널 세로 중앙이 아니라 그보다 35px 아래에 있다
            (사진 타원·덩굴 장식을 피한 위치). 739 기준 54.7%. */}
        <div className="absolute top-[54.7%] left-[41.4%] flex w-[49.4%] -translate-y-1/2 flex-col gap-10">
          <CreatorText />
        </div>

        {hasPublicAsset(AVATAR_SRC) ? (
          <Image
            src={AVATAR_SRC}
            alt=""
            width={206}
            height={285}
            unoptimized
            aria-hidden
            /* 시안: 패널 기준 (1150.58, 356.65) 205.83×285 → 1341×739 대비 %.
               원본 52×72 를 205.8×285 로 업스케일하므로 pixel-art 를 붙인다. */
            className="pixel-art pointer-events-none absolute top-[48.2612%] left-[85.7999%] w-[15.3490%] max-w-none drop-shadow-[0_8px_10px_rgba(0,0,0,0.35)]"
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
      {/* 시안(509:3002): #ffd200→#ff6c00 세로 그라데이션 글자 + 글자 **바깥**
          고동색 외곽선. `-webkit-text-stroke` 는 획 중앙 정렬이라 그대로 쓰면
          두께의 절반이 글자를 덮어 노란 면이 8px 얇아진다(시안 실측 89px →
          81px). 그래서 같은 글자를 스트로크만 있는 레이어로 한 벌 더 깔고
          그 위에 그라데이션 글자를 얹는다 — 획이 전부 글자 밖에 남는다.
          (`paint-order: stroke fill` 은 `background-clip:text` 와 함께 쓰면
          Chromium 이 그라데이션을 획까지 클리핑해 외곽선이 사라진다.) */}
      <h2 className="font-maple relative z-10 text-[clamp(56px,8vw,100px)] leading-none font-bold lg:-top-1">
        <span
          aria-hidden
          className="absolute inset-0 text-[#3a2b20] drop-shadow-[0_4px_6px_rgba(58,43,32,0.35)] [-webkit-text-stroke:12px_#3a2b20] lg:[-webkit-text-stroke:16px_#3a2b20]"
        >
          {CREATOR_NAME}
        </span>
        <span className="relative bg-gradient-to-b from-[#ffd200] to-[#ff6c00] bg-clip-text text-transparent">
          {CREATOR_NAME}
        </span>
      </h2>

      <div className="relative z-10 flex flex-col gap-6 lg:gap-[10px]">
        <p className="font-maple text-[clamp(18px,2.2vw,25px)] leading-snug font-bold text-[#f7601b]">
          {CREATOR_SLOGAN}
        </p>

        <div className="flex flex-col gap-5 lg:gap-[15px]">
          {CREATOR_INTRO.map((paragraph, index) => (
            <p
              key={`${index}-${paragraph.slice(0, 8)}`}
              className="font-intro text-[clamp(16px,1.9vw,22px)] leading-[1.36] font-bold whitespace-pre-line text-[#381f1e]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </>
  )
}
