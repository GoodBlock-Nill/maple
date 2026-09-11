import Link from 'next/link'

import type { NavItem } from '@/lib/constants/site'

type FooterLegalLinksProps = {
  links: readonly NavItem[]
}

/**
 * 푸터 약관 링크 한 줄(개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책).
 *
 * 시안(footer-v3-home.png)은 Menu/Legal 두 열 대신 연락처 아래 한 줄로 묶는다.
 * `flex-wrap` 은 폰 폭에서 세 링크가 한 줄에 다 안 들어갈 때를 대비한 안전장치일
 * 뿐, 시안 자체는 lg 이상과 같은 한 줄 배치를 폰에서도 유지한다.
 */
export function FooterLegalLinks({ links }: FooterLegalLinksProps) {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      {links.map((link, index) => (
        <li key={link.href} className="flex items-center gap-4">
          {index > 0 ? <span aria-hidden className="h-3 w-px shrink-0 rounded-full bg-[#c2c2c2]" /> : null}
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
