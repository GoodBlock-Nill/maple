import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

/**
 * 마이페이지 v2 시안 아이콘 — `public/images/mypage-v2/*.svg` 를 그대로 옮겼다.
 *
 * `<Image>` 대신 인라인 컴포넌트로 두는 이유는 두 가지다.
 *  1) 탭·체크박스 아이콘은 요청 하나를 더 만들 만큼 크지 않고, 첫 렌더에서 늦게
 *     뜨면 탭 줄이 한 번 흔들린다.
 *  2) 색을 `currentColor` 로 바꿔 상태(비활성·호버)를 CSS 로 다룰 수 있다.
 */

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

/** 계정 관리 탭 — 48 박스를 가득 채우는 사람 아이콘(원본의 박스 좌표계를 그대로 쓴다). */
export function TabAccountGlyph({ className = 'size-12 text-ink', ...props }: IconProps) {
  return (
    <svg {...STROKE_PROPS} viewBox="7 5 48 48" className={className} {...props}>
      <path d="M40.5 41C40.5 36.7168 36.2472 31.3057 31 31.3057C25.7528 31.3057 21.5 36.7168 21.5 41M35.75 21.8471C35.75 23.1327 35.2496 24.3655 34.3588 25.2746C33.468 26.1836 32.2598 26.6942 31 26.6942C29.7402 26.6942 28.532 26.1836 27.6412 25.2746C26.7504 24.3655 26.25 23.1327 26.25 21.8471C26.25 20.5616 26.7504 19.3287 27.6412 18.4197C28.532 17.5107 29.7402 17 31 17C32.2598 17 33.468 17.5107 34.3588 18.4197C35.2496 19.3287 35.75 20.5616 35.75 21.8471Z" />
    </svg>
  )
}

/** 계정 연동 탭 — 28 박스 안의 링크(사슬) 아이콘(`tab-link.svg`). */
export function TabLinkGlyph({ className = 'size-7 text-ink', ...props }: IconProps) {
  return (
    <svg {...STROKE_PROPS} viewBox="0 0 28 28" className={className} {...props}>
      <path d="M10.7005 17.3002L17.3002 10.7005" />
      <path d="M8.22517 13.1751L6.57525 14.825C4.7528 16.6475 4.7528 19.6023 6.57525 21.4247C8.3977 23.2472 11.3525 23.2472 13.1749 21.4247L14.8248 19.7748" />
      <path d="M13.1751 8.22517L14.825 6.57525C16.6475 4.7528 19.6023 4.7528 21.4247 6.57525C23.2472 8.3977 23.2472 11.3525 21.4247 13.1749L19.7748 14.8248" />
    </svg>
  )
}

/**
 * 체크된 체크박스 22 — 잉크색 사각형(radius 4) + 흰 체크(`check-on.svg`).
 * 사각형만 `currentColor` 라서 비활성 상태에서 회색으로 낮출 수 있다.
 */
export function CheckOnGlyph({ className = 'size-[22px] text-ink', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden
      focusable="false"
      className={className}
      {...props}
    >
      <rect width="22" height="22" rx="4" fill="currentColor" />
      <path
        d="M6 10.5L9.33333 14L16 7"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 회원 탈퇴 행 우측 화살표 24(`arrow.svg`). 색은 상속받는다(#b3261e). */
export function ArrowRightGlyph({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
      {...props}
    >
      <path d="M9 6L15 12L9 18" />
    </svg>
  )
}

/** 헤더 계정 메뉴의 삼각형 12×6(`chevron-down.svg`). 열리면 CSS 로 뒤집는다. */
export function ChevronDownGlyph({ className = 'h-1.5 w-3', ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 12 6"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
      {...props}
    >
      <path d="M6 0L12 6H0L6 0Z" />
    </svg>
  )
}
