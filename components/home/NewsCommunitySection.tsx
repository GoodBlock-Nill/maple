import Image from 'next/image'

import { CategoryCardGrid } from '@/components/home/CategoryCardGrid'

const HEADING_ID = 'news-community-heading'

/** 섹션 좌표계(mid-under 이미지 크기). 드래곤 좌표는 이 프레임 기준이다. */
const FRAME = { width: 1440, height: 1102 } as const

/**
 * 드래곤 이미지 박스(시안 값). Figma 는 회전 후 바운딩박스(301.29×284.90)의
 * 좌상단을 (−79.93, 68.44) 로 잡는데, CSS 는 회전 전 박스를 배치하므로
 * 좌상단이 (−55.33, 96.24) 가 된다. 프레임 왼쪽 밖으로 나가는 건 시안 그대로다.
 */
const DRAGON = { left: -55.33, top: 96.24, width: 252.09, height: 229.3 } as const

/** Figma rotation 165.57° + 상하 반전. 구버전 mid-under(드래곤 구워진 것)와 겹쳐 확인했다. */
const DRAGON_TRANSFORM = 'rotate(-165.57deg) scaleY(-1)'

const percent = (value: number, total: number) => `${(value / total) * 100}%`

/**
 * 히어로 하단과 164px 겹치는 카드 섹션.
 * 레이어(아래→위): mid-under → 드래곤 → 카드 → 제목 → mid-over → 마스코트 GIF.
 * 하단 숲(mid-over)이 푸터 상단 70px 위로 이어져야 하므로 섹션을 z-10 으로 올리고
 * 아래쪽으로 70px 겹치게(-mb) 둔다.
 * 1440 이상에서만 1440×1102 좌표계를 그대로 쓰고, 그 아래는 흐름 레이아웃으로
 * 폴백한다(1280~1439 에서 절대 좌표를 쓰면 우측 카드와 마스코트가 잘린다).
 *
 * 섹션 자체에는 `overflow-hidden` 대신 `overflow-x-clip` 만 둔다. 드래곤 GIF 가
 * 프레임 위쪽·아래쪽으로 삐져나와도 잘리지 않아야 하고, 가로 방향 클리핑 경계는
 * 어차피 뷰포트 가장자리와 같아 보이는 픽셀을 깎지 않는다(가로 스크롤 방지).
 * 배경 두 장은 각각 클리핑 박스로 감싸 예전과 같은 범위로 잘라낸다.
 */
export function NewsCommunitySection() {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="frame:-mt-[164px] frame:-mb-[70px] frame:h-[1102px] frame:bg-transparent relative isolate z-10 -mt-[80px] overflow-x-clip bg-[#9bd4f8] sm:-mt-[120px]"
    >
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/images/home/mid-under-v2.png"
          alt=""
          width={FRAME.width}
          height={FRAME.height}
          sizes="100vw"
          className="frame:inset-0 frame:h-full frame:object-cover absolute inset-x-0 top-0 h-auto w-full"
        />
      </div>

      <DragonLayer />

      <div className="frame:h-full frame:px-0 frame:pt-0 frame:pb-0 relative z-10 mx-auto w-full max-w-[1440px] px-4 pt-[130px] pb-[200px] sm:pt-[180px] sm:pb-[280px]">
        <h2
          id={HEADING_ID}
          className="text-ink frame:absolute frame:inset-x-0 frame:top-[271px] text-center text-[clamp(32px,5vw,64px)] leading-none font-semibold uppercase"
        >
          NEWS &amp; COMMUNITY
        </h2>
        <CategoryCardGrid className="frame:mt-0 mt-12" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <Image
          src="/images/home/mid-over.png"
          alt=""
          width={FRAME.width}
          height={FRAME.height}
          sizes="100vw"
          className="frame:inset-0 frame:h-full frame:object-cover absolute inset-x-0 bottom-0 h-auto w-full"
        />
      </div>

      <div
        aria-hidden
        className="frame:block pointer-events-none absolute inset-0 z-30 mx-auto hidden w-full max-w-[1440px]"
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

/**
 * 구름 위를 나는 드래곤 GIF.
 *
 * 레이어는 1440×1102 좌표계를 그대로 쓰되 폭이 1440 을 넘지 않는다(슬라임·오리
 * 레이어와 같은 규칙). 1440 미만에서는 mid-under 와 똑같이 폭에 비례해 줄고,
 * 1440 이상에서는 가운데 정렬되어 프레임 왼쪽으로 나간 드래곤이 오히려 온전히
 * 보인다. 좌표는 % 라 어느 폭에서도 비율이 유지된다.
 */
function DragonLayer() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] mx-auto aspect-[1440/1102] w-full max-w-[1440px]"
    >
      <Image
        src="/images/home/dragon.gif"
        alt=""
        width={Math.round(DRAGON.width)}
        height={Math.round(DRAGON.height)}
        unoptimized
        style={{
          left: percent(DRAGON.left, FRAME.width),
          top: percent(DRAGON.top, FRAME.height),
          width: percent(DRAGON.width, FRAME.width),
          height: percent(DRAGON.height, FRAME.height),
          transform: DRAGON_TRANSFORM,
        }}
        className="absolute max-w-none object-cover"
      />
    </div>
  )
}
