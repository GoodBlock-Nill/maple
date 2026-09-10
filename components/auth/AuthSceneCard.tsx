import {
  AUTH_CARD_INNER_CLASS,
  AUTH_CARD_OUTER_CLASS,
  AUTH_TITLE_CLASS,
} from '@/components/auth/auth-scene-styles'

import type { ReactNode } from 'react'

type AuthSceneCardProps = {
  title: string
  children: ReactNode
}

/**
 * 시안의 이중 카드 — 860 글래스(padding 32) 안에 794 흰 카드(padding-y 70).
 * 제목과 폼 사이는 40px 고정이다.
 */
export function AuthSceneCard({ title, children }: AuthSceneCardProps) {
  return (
    <section className={AUTH_CARD_OUTER_CLASS}>
      <div className={AUTH_CARD_INNER_CLASS}>
        <h1 className={AUTH_TITLE_CLASS}>{title}</h1>
        {children}
      </div>
    </section>
  )
}
