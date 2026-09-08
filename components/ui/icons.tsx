import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const BASE_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export function MenuIcon({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CloseIcon({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** 뉴스 목록 "카드형" 보기 전환 트리거 아이콘(시안: 2×2 라운드 사각형). */
export function GridIcon({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  )
}

export function ChevronDownIcon({ className = 'size-4', ...props }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  )
}

export function ArrowRightIcon({ className = 'size-4', ...props }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}

export function ExternalLinkIcon({ className = 'size-4', ...props }: IconProps) {
  return (
    <svg {...BASE_PROPS} className={className} {...props}>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M19 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.5" />
    </svg>
  )
}
