import { cn } from '@/lib/utils/cn'

/**
 * "작성 중" 표시에 쓰는 연필.
 *
 * 아이콘 라이브러리를 붙이지 않는 것은 사이드바(`components/layout/nav-icons.tsx`)와
 * 같은 이유다 — 필요한 것이 하나뿐인데 패키지 하나를 통째로 들이지 않는다.
 * 24 그리드 · 1.6 두께로 그쪽과 모양을 맞췄다.
 */
export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-3.5 shrink-0', className)}
    >
      <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  )
}
