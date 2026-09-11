import type { SVGProps } from 'react'

/**
 * 고객지원 v2 시안이 내보낸 아이콘(`public/images/support/v2/*.svg`)을 그대로 옮긴 것.
 *
 * 파일을 `next/image` 로 불러오지 않고 인라인으로 두는 이유는 두 가지다 —
 * 작은 선 아이콘 여섯 개가 각각 요청을 만들 이유가 없고, 색을 `currentColor` 로
 * 두면 비활성 화살표·모바일 톤 변화를 부모의 글자색 하나로 맞출 수 있다(시안의
 * 기본 색은 각 호출부가 지정한다).
 */

type IconProps = SVGProps<SVGSVGElement>

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

/** 상세·수정 화면 상단의 뒤로 가기(24, stroke 2). */
export function ArrowBackIcon({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} {...STROKE_PROPS} className={className} {...props}>
      <path d="M21 12L3 12" />
      <path d="M8 17L3 12L8 7" />
    </svg>
  )
}

/** 답변 블록의 말풍선(24, stroke 2). 점 세 개는 길이 0 선분이라 둥근 캡으로 찍힌다. */
export function ChatDotsIcon({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} {...STROKE_PROPS} className={className} {...props}>
      <path d="M20 5H4C3.44772 5 3 5.44772 3 6V18.9194C3 19.7579 3.96993 20.2241 4.6247 19.7002L7.72609 17.2191C7.9034 17.0773 8.12371 17 8.35078 17H20C20.5523 17 21 16.5523 21 16V6C21 5.44772 20.5523 5 20 5Z" />
      <path d="M16 11H16.002V11.002H16V11Z" />
      <path d="M12 11H12.002V11.002H12V11Z" />
      <path d="M8 11H8.002V11.002H8V11Z" />
    </svg>
  )
}

/** 페이지네이션 화살표(24, stroke 2). 오른쪽은 같은 그림을 뒤집어 쓴다. */
export function ChevronLeftIcon({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} {...STROKE_PROPS} className={className} {...props}>
      <path d="M15 19L8 12L15 5" />
    </svg>
  )
}

export function ChevronRightIcon({ className = 'size-6', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} {...STROKE_PROPS} className={className} {...props}>
      <path d="M9 19L16 12L9 5" />
    </svg>
  )
}

/** 목록·상세의 `계정 › 신고` 사이에 서는 작은 꺾쇠(16, stroke 1.25). */
export function ChevronRightSmallIcon({ className = 'size-4', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" strokeWidth={1.25} {...STROKE_PROPS} className={className} {...props}>
      <path d="M6 3.33325L10.6667 7.99992L6 12.6666" />
    </svg>
  )
}

/** 파일 칩의 제거 버튼(20, stroke 1.5). */
export function CloseIcon({ className = 'size-5', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.5} {...STROKE_PROPS} className={className} {...props}>
      <path d="M15 15L5 5" />
      <path d="M15 5L5 15" />
    </svg>
  )
}
