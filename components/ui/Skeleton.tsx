import { cn } from '@/lib/utils/cn'

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('bg-line animate-pulse rounded-md', className ?? 'h-4 w-full')}
    />
  )
}

type SkeletonTextProps = {
  lines?: number
  className?: string
}

const LAST_LINE_WIDTH = 'w-2/3'

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-4', index === lines - 1 ? LAST_LINE_WIDTH : 'w-full')}
        />
      ))}
    </div>
  )
}
