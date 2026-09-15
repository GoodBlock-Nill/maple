import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

import type { NavItem } from '@/lib/constants/site'

type FooterLegalLinksProps = {
  links: readonly NavItem[]
}

/**
 * 푸터 약관 링크 한 줄(개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책 ·
 * 마케팅 정보 수신 동의 — 네 번째는 오너 요청 2026-09-15).
 *
 * 시안(footer-v3-home.png)은 Menu/Legal 두 열 대신 연락처 아래 한 줄로 묶는다.
 * 네 개가 되면서 375 폭에는 한 줄에 들어가지 않는다. `flex-wrap` 으로 접으면 둘째 줄
 * 첫머리에 구분선이 남으므로, lg 미만은 **2×2 격자**로 놓고 구분선은 각 줄의 둘째
 * 항목 앞에만 그린다(lg 이상은 한 줄 · 첫 항목 뒤 전부).
 */
export function FooterLegalLinks({ links }: FooterLegalLinksProps) {
  return (
    <ul className="grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
      {links.map((link, index) => (
        <li key={link.href} className="flex items-center gap-4">
          {index > 0 ? (
            <span
              aria-hidden
              className={cn(
                'h-3 w-px shrink-0 rounded-full bg-[#c2c2c2]',
                index % 2 === 1 ? 'block' : 'hidden lg:block',
              )}
            />
          ) : null}
          <Link
            href={link.href}
            className="tap-area rounded-pill font-ui text-[15px] leading-[22px] font-medium text-[#ddd] transition-colors hover:text-white"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
