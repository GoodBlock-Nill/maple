import Link from 'next/link'

import { SUPPORT_MENU } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'

type SupportTabsProps = {
  activeHref: string
}

/**
 * 모바일 세그먼트 탭(시안 v2 m-1~m-4).
 *
 * 좌측 메뉴를 대체한다. 카드 패딩(12) 밖으로 밀어내 카드 폭을 꽉 채우는 이유는
 * 탭 아래 구분선이 카드 양 끝까지 이어져야 "여기가 화면 전환 줄"로 읽히기
 * 때문이다(시안 실측: 탭 하나 114.33 = 343 ÷ 3).
 *
 * 링크로 두므로 PC 의 메뉴와 같은 경로·같은 이름을 쓴다 — 폰에서도 "내 문의 내역"
 * 을 이름으로 찾을 수 있다(비로그인은 눌렀을 때 로그인으로 안내된다).
 */
export function SupportTabs({ activeHref }: SupportTabsProps) {
  return (
    <nav aria-label="고객지원 메뉴" className="border-line-soft -mx-3 mb-6 border-b lg:hidden">
      <ul className="flex">
        {SUPPORT_MENU.map((item) => {
          const isActive = item.href === activeHref

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  /* `-mb-px` 로 2px 인디케이터가 아래 1px 구분선을 덮는다. */
                  '-mb-px flex h-[47px] items-center justify-center border-b-2 px-1 text-center',
                  'text-[14px] leading-[20px] font-medium transition-colors',
                  isActive
                    ? 'border-[#e8308a] text-[#e8308a]'
                    : 'border-transparent text-[#49454f]',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
