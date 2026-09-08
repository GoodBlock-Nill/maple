import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

type ContainerProps = {
  className?: string
  children: ReactNode
}

export function Container({ className, children }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1140px] px-4 sm:px-6', className)}>{children}</div>
  )
}
