/**
 * 간편로그인 버튼 마크.
 *
 * 사용자 사이트(`components/auth/social-icons.tsx`)와 같은 도형을 쓴다. 외부
 * 자산(PNG/SVG 파일)을 두지 않고 인라인 SVG 로 그리는 이유도 같다 — 로그인
 * 화면은 첫 진입에서 바로 보여야 하는데 아이콘 3개를 네트워크로 더 받으면
 * 버튼이 빈 채로 깜빡인다. 각 마크는 제공자 가이드의 기본 형태를 따른다.
 */

type IconProps = {
  className?: string
}

/** 구글 G 마크(4색). 흰 배경 위에만 쓴다. */
export function GoogleMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden focusable="false" className={className}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19A23.9 23.9 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  )
}

/** 카카오 말풍선 심볼. 노란 배경 위에 검정 85% 로 얹는다. */
export function KakaoMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M9 1.5C4.58 1.5 1 4.29 1 7.73c0 2.2 1.45 4.13 3.64 5.25-.16.58-.58 2.12-.66 2.45-.11.41.15.4.31.29.13-.08 2.06-1.4 2.9-1.97.58.08 1.19.13 1.81.13 4.42 0 8-2.79 8-6.23S13.42 1.5 9 1.5Z"
      />
    </svg>
  )
}

/** 네이버 N 마크. 초록 배경 위에 흰색으로 얹는다. */
export function NaverMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M10.44 8.57 5.35 1.2H1.2v13.6h4.36V7.43l5.09 7.37h4.15V1.2h-4.36v7.37Z"
      />
    </svg>
  )
}
