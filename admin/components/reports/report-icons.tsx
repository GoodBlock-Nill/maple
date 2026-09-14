import { cn } from '@/lib/utils/cn'

/**
 * 대상 유형 뱃지에 쓰는 문서/말풍선 아이콘.
 *
 * 게시글·댓글 뱃지가 같은 톤(`accent`)을 썼던 탓에 목록을 훑을 때 둘이 구별되지
 * 않는다는 운영 피드백(2026-09-14)으로 추가했다. 아이콘 라이브러리를 새로 붙이는
 * 대신 사이드바·문의 아이콘(`nav-icons.tsx`, `inquiry-icons.tsx`)과 같은 24 그리드 ·
 * 1.6 두께 규칙을 따라 모양을 맞췄다.
 */
export function DocumentIcon({ className }: { className?: string }) {
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
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 12.5h6M9 16h6" />
    </svg>
  )
}

export function CommentIcon({ className }: { className?: string }) {
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
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
    </svg>
  )
}
