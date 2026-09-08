import { cn } from '@/lib/utils/cn'

/** 로딩 골격. 높이·너비는 호출부가 리터럴 클래스로 지정한다. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('bg-line/70 block animate-pulse rounded-sm', className)} />
}
