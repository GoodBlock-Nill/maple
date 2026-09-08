import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const BASE_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-panel font-semibold whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow] duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:pointer-events-none disabled:opacity-45'

/* 클래스 문자열은 전부 리터럴로 둔다. Tailwind 는 소스를 정적으로 훑기 때문에
   `bg-${color}` 처럼 조립하면 유틸리티가 생성되지 않는다. */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'bg-surface text-ink border border-line hover:bg-page',
  ghost: 'text-muted hover:bg-page hover:text-ink',
  danger: 'bg-danger-soft text-danger border border-danger/25 hover:bg-danger hover:text-white',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
}

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children?: ReactNode
}

type AnchorProps = CommonProps &
  Omit<ComponentPropsWithRef<typeof Link>, keyof CommonProps | 'href'> & { href: string }

type NativeProps = CommonProps &
  Omit<ComponentPropsWithRef<'button'>, keyof CommonProps> & { href?: undefined }

export type ButtonProps = AnchorProps | NativeProps

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children } = props
  const classes = cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)

  if (props.href !== undefined) {
    const {
      variant: _variant,
      size: _size,
      className: _className,
      children: _children,
      ...linkProps
    } = props

    return (
      <Link {...linkProps} className={classes}>
        {children}
      </Link>
    )
  }

  const {
    variant: _variant,
    size: _size,
    className: _className,
    children: _children,
    href: _href,
    ...buttonProps
  } = props

  return (
    <button type="button" {...buttonProps} className={classes}>
      {children}
    </button>
  )
}
