import type { NavIcon } from '@/lib/nav'
import type { ReactElement } from 'react'

/**
 * 사이드바 아이콘.
 *
 * 아이콘 라이브러리를 넣지 않는 이유: 여기서 필요한 것은 11개뿐이고, 패키지를
 * 하나 붙이면 관리자 번들에 수백 개의 미사용 컴포넌트가 따라 들어온다.
 * 모두 24 그리드 · 1.6 두께 스트로크로 통일했다.
 */
const PATHS: Record<NavIcon, ReactElement> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  news: (
    <>
      <path d="M4 5h11a1 1 0 0 1 1 1v13H5a1 1 0 0 1-1-1V5Z" />
      <path d="M16 9h3a1 1 0 0 1 1 1v7a2 2 0 0 1-4 0" />
      <path d="M7 9h6M7 13h6" />
    </>
  ),
  community: (
    <>
      <path d="M4 5h16v10H9l-5 4V5Z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  report: (
    <>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  member: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  support: (
    <>
      <path d="M4 6h16v10H4z" />
      <path d="m4 6 8 6 8-6" />
    </>
  ),
  guide: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  ranking: (
    <>
      <path d="M5 20V11M12 20V4M19 20v-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3 5 6v5c0 4.4 2.9 8.4 7 10 4.1-1.6 7-5.6 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  audit: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h6M9 16h6" />
    </>
  ),
}

export function NavIconGlyph({ name }: { name: NavIcon }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  )
}
