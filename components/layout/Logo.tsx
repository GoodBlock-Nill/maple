import Image from 'next/image'
import Link from 'next/link'

import { SITE_NAME } from '@/lib/constants/site'
import { cn } from '@/lib/utils/cn'

type LogoProps = {
  /** 시안: 헤더 99×36, 푸터 109×40. */
  width?: number
  height?: number
  href?: string
  className?: string
}

export function Logo({ width = 99, height = 36, href = '/', className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-bar inline-flex shrink-0 items-center',
        'focus-visible:outline-2 focus-visible:outline-offset-4',
        className,
      )}
    >
      <Image
        src="/images/brand/logo.svg"
        alt={SITE_NAME}
        width={width}
        height={height}
        loading="eager"
        style={{ width, height }}
      />
    </Link>
  )
}
