import Image from 'next/image'

import { MEDAL_PALETTE } from '@/lib/constants/ranking'

type MedalRibbonProps = {
  /** 1 | 2 | 3. */
  rank: number
  className?: string
}

const MEDAL_WIDTH = 60
const MEDAL_HEIGHT = 80

/**
 * TOP3 카드 좌상단에 걸리는 메달 리본 60×80.
 * 1위는 시안 자산, 2·3위는 숫자만 바뀐 같은 형태의 SVG 로 그린다.
 */
export function MedalRibbon({ rank, className }: MedalRibbonProps) {
  const palette = MEDAL_PALETTE[rank]

  if (palette === undefined) {
    return (
      <Image
        src="/images/ranking/medal-ribbon.png"
        alt={`${rank}위`}
        width={MEDAL_WIDTH}
        height={MEDAL_HEIGHT}
        className={className}
      />
    )
  }

  return (
    <svg
      viewBox={`0 0 ${MEDAL_WIDTH} ${MEDAL_HEIGHT}`}
      width={MEDAL_WIDTH}
      height={MEDAL_HEIGHT}
      role="img"
      aria-label={`${rank}위`}
      className={className}
    >
      <path d="M16 40h13v36l-6.5-8L16 76Z" fill={palette.tail} />
      <path d="M31 40h13v36l-6.5-8L31 76Z" fill={palette.tail} />
      <circle cx="30" cy="29" r="27" fill={palette.rim} />
      <circle cx="30" cy="29" r="22" fill={palette.disc} />
      <circle cx="30" cy="29" r="18" fill="none" stroke={palette.rim} strokeWidth="2" />
      <text
        x="30"
        y="30"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="22"
        fontWeight="700"
        fill={palette.digit}
      >
        {rank}
      </text>
    </svg>
  )
}

type IconProps = {
  className?: string
}

/** 1위 이름 앞의 왕관 31×30. */
export function CrownIcon({ className }: IconProps) {
  return (
    <Image
      src="/images/ranking/crown.png"
      alt=""
      width={31}
      height={30}
      aria-hidden
      className={className}
    />
  )
}

/** 캐릭터 썸네일 80×80. 개별 이미지가 없을 때 쓰는 기본 아바타. */
export function RowAvatar({ className }: IconProps) {
  return (
    <Image
      src="/images/ranking/row-avatar.png"
      alt=""
      width={80}
      height={80}
      aria-hidden
      className={className}
    />
  )
}

/**
 * 길드 엠블럼 자리 32×35.
 * TODO(asset): 길드별 엠블럼은 관리자 업로드(Phase 4) 대상이라 공통 아이콘을 쓴다.
 */
export function GuildEmblem({ className }: IconProps) {
  return (
    <Image
      src="/images/ranking/guild-icon.png"
      alt=""
      width={32}
      height={35}
      aria-hidden
      className={className}
    />
  )
}
