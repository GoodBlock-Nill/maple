import Link from 'next/link'

import { isNavItemHidden } from '@/components/layout/navigation'

import type { NavItem } from '@/lib/constants/site'

type FooterColumnProps = {
  title: string
  links: readonly NavItem[]
  className?: string
}

/**
 * 푸터 Menu/Legal 열. `SiteFooter.tsx` 에서 분리한 이유는 `SiteFooter` 가
 * `getSiteSettings()`(server-only 의존 체인)를 끌고 오는 async 서버 컴포넌트라
 * 단위 테스트가 jsdom 에서 그 모듈을 import 할 수 없기 때문이다 — 숨김 메뉴
 * 렌더링(소개)만 따로 검증하려면 이 컴포넌트가 독립 모듈이어야 한다
 * (`tests/unit/layout/FooterColumn.test.tsx`).
 */
export function FooterColumn({ title, links, className }: FooterColumnProps) {
  const visibleLinks = links.filter((link) => !isNavItemHidden(link.href))

  return (
    <nav aria-label={title} className={className}>
      <p className="text-label-lg leading-none font-medium text-white">{title}</p>
      {/* 링크 줄 간격은 시안 기준 28px(글자 16 + 간격 12, lg 이상). 폰에서는 tap-area
          확장(±14px)이 이웃 링크와 겹치지 않도록 28px 로 벌린다(행 44px). `leading-none` 은
          인라인 <a> 가 아니라 <li> 스트럿에 걸려야 실제 높이가 줄어든다. */}
      <ul className="mt-[14px] flex flex-col gap-7 leading-none lg:gap-3">
        {visibleLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="tap-area rounded-pill text-ink-soft text-ui-sm whitespace-nowrap transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
