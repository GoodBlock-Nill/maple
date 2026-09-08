import { AUTH_CARD_CLASS } from '@/components/auth/auth-styles'

import type { ReactNode } from 'react'

type AuthCardProps = {
  title: string
  description: string
  children: ReactNode
  /** 카드 아래 보조 링크 줄(가입/로그인 전환 등). */
  footer?: ReactNode
}

/** 인증 화면 공통 글래스 카드. 제목 → 설명 → 폼 → 보조 링크 순서를 고정한다. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <section className={AUTH_CARD_CLASS}>
      <h1 className="text-ink text-[28px] leading-[1.3] font-semibold tracking-[-0.5px]">
        {title}
      </h1>
      <p className="text-ink-muted mt-2 text-[15px] leading-[1.6]">{description}</p>

      <div className="mt-8">{children}</div>

      {footer === undefined ? null : (
        <div className="border-line-soft text-ink-muted mt-8 border-t pt-6 text-center text-[15px]">
          {footer}
        </div>
      )}
    </section>
  )
}
