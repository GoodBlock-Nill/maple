import Link from 'next/link'

import { cn } from '@/lib/utils/cn'
import { LEGAL_TAB_LABEL, LEGAL_TABS } from '@/lib/validation/legal-state'

import type { LegalTab } from '@/lib/validation/legal-state'

/**
 * 편집 · 미리보기 · 이력 탭.
 *
 * 링크 세 개뿐이다(`?tab=`). 클라이언트 상태로 두면 새로고침·뒤로가기에서 탭이
 * 초기화되고, "이 문서의 이력 화면"을 링크로 넘길 수 없다. 서버가 활성 패널만
 * 그리므로 보지 않는 탭의 본문(미리보기 HTML·비교 계산)을 만들지도 않는다.
 */
export function LegalTabs({
  active,
  buildHref,
}: {
  active: LegalTab
  buildHref: (tab: LegalTab) => string
}) {
  return (
    <nav aria-label="약관 화면" className="border-line mb-5 flex items-end gap-1 border-b">
      {LEGAL_TABS.map((tab) => (
        <Link
          key={tab}
          href={buildHref(tab)}
          aria-current={tab === active ? 'page' : undefined}
          className={cn(
            'focus-visible:outline-focus -mb-px border-b-2 px-3 py-2.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
            tab === active
              ? 'border-accent text-accent-strong'
              : 'text-muted hover:text-ink border-transparent',
          )}
        >
          {LEGAL_TAB_LABEL[tab]}
        </Link>
      ))}
    </nav>
  )
}
