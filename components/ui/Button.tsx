import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef, ReactNode } from 'react'

export type ButtonVariant = 'dark' | 'discord' | 'light' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:pointer-events-none disabled:opacity-50 active:translate-y-px'

/** 표면 스타일은 globals.css `@layer components` 의 .cta-* 클래스가 소유한다. */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  dark: 'cta-dark hover:brightness-125',
  discord: 'cta-discord hover:brightness-110',
  light: 'cta-light hover:border-ink-soft',
  ghost: 'text-ink-muted hover:bg-ink/5 hover:text-ink',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-[16px]',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-[47px] px-[30px] text-[16px]',
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
  const { variant = 'dark', size = 'md', className, children } = props
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
