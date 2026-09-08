import { MEDAL_COLORS } from '@/lib/constants/ranking'

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

type MedalRibbonProps = {
  /** 1 | 2 | 3. 색은 금·은·동 순서다. */
  rank: number
  className?: string
}

/**
 * TOP3 카드 좌상단에 걸리는 메달 리본 60×80.
 * PNG 자산(`ranking/top3-medal-*.png`)이 아직 없어 인라인 SVG로 그린다.
 */
export function MedalRibbon({ rank, className }: MedalRibbonProps) {
  const color = MEDAL_COLORS[rank - 1] ?? MEDAL_COLORS[0]

  if (color === undefined) {
    return null
  }

  return (
    <svg
      viewBox="0 0 60 80"
      width={60}
      height={80}
      role="img"
      aria-label={`${rank}위`}
      className={className}
    >
      {/* 시안: 원판이 카드 상단 모서리에 걸치고 리본 꼬리가 아래로 흐른다. */}
      <path d="M12 22h36v54L30 63 12 76Z" fill={color.ribbon} />
      <path d="M12 22h36v8H12Z" fill={color.edge} opacity="0.35" />
      <circle cx="30" cy="30" r="25" fill={color.edge} />
      <circle cx="30" cy="30" r="22" fill={color.disc} />
      <text
        x="30"
        y="30"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="20"
        fontWeight="700"
        fill={color.edge}
      >
        {rank}
      </text>
    </svg>
  )
}

/** 1위 이름 앞의 왕관 31×30. 이모지 대신 인라인 SVG로 그린다. */
export function CrownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 31 30" width={31} height={30} aria-hidden className={className}>
      <path
        d="M3 22 1.5 8.5l7.8 5.2L15.5 4l6.2 9.7 7.8-5.2L28 22Z"
        fill="#ffd75e"
        stroke="#e0a01c"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M3.6 24.6h23.8v3.2H3.6Z" fill="#f2a93b" />
    </svg>
  )
}

/**
 * 캐릭터 일러스트가 없을 때 카드 가운데에 놓이는 실루엣.
 * TODO(asset): `ranking/top3-char-*.png` 가 도착하면 이 폴백은 표시되지 않는다.
 */
export function CharacterSilhouette({ className }: IconProps) {
  return (
    <svg viewBox="0 0 120 140" aria-hidden className={className}>
      <g fill="currentColor" opacity="0.28">
        <circle cx="60" cy="36" r="26" />
        <path d="M60 68c22 0 38 16 40 38 .6 6.6-3 10-8 10H28c-5 0-8.6-3.4-8-10 2-22 18-38 40-38Z" />
      </g>
    </svg>
  )
}

/**
 * 길드 엠블럼 자리. 실제 엠블럼 업로드 전까지 방패 실루엣을 쓴다.
 * TODO(asset): 길드 엠블럼은 관리자 업로드(Phase 4) 대상이다.
 */
export function GuildEmblem({ className }: IconProps) {
  return (
    <svg viewBox="0 0 40 41" aria-hidden className={className}>
      <path
        d="M20 2 36 7v16c0 9-7 15.6-16 18-9-2.4-16-9-16-18V7Z"
        fill="#ffd75e"
        stroke="#c98a12"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m20 12 3 6.4 6.6.9-4.8 4.9 1.2 7-6-3.4-6 3.4 1.2-7-4.8-4.9 6.6-.9Z" fill="#c98a12" />
    </svg>
  )
}
