import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { DISCORD_URL, PLAY_URL } from '@/lib/constants/site'
import { cn } from '@/lib/utils/cn'

import type { ButtonVariant } from '@/components/ui/Button'
import type { ReactNode } from 'react'

type CtaVariant = Extract<ButtonVariant, 'dark' | 'discord'>

type HeroCtaGroupProps = {
  className?: string
}

/** 시안: 글래스 링(패딩 6px) 안에 높이 47px 버튼이 들어간다. */
export function HeroCtaGroup({ className }: HeroCtaGroupProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-5', className)}>
      <HeroCta href={PLAY_URL} variant="dark">
        메이플월드 바로가기
      </HeroCta>
      <HeroCta href={DISCORD_URL} variant="discord">
        디스코드 바로가기
      </HeroCta>
    </div>
  )
}

type HeroCtaProps = {
  href: string
  variant: CtaVariant
  children: ReactNode
}

function HeroCta({ href, variant, children }: HeroCtaProps) {
  return (
    <span className="glass rounded-pill inline-flex p-1.5">
      <Button href={href} variant={variant} size="lg" className="gap-4 pr-3">
        {children}
        <Image
          src="/images/brand/arrow-cta.svg"
          alt=""
          width={31}
          height={31}
          className="size-[31px] shrink-0"
        />
      </Button>
    </span>
  )
}
