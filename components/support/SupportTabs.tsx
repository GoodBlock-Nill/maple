import Link from 'next/link'

import { SUPPORT_MENU } from '@/lib/constants/support-menu'
import { cn } from '@/lib/utils/cn'

type SupportTabsProps = {
  activeHref: string
}

/**
 * 모바일 세그먼트 탭(시안 v2 m-1~m-4).
 *
 * 좌측 메뉴를 대체한다. 카드 패딩(12) 밖으로 밀어내 카드 폭을 꽉 채우는 이유는
 * 탭 아래 구분선이 카드 양 끝까지 이어져야 "여기가 화면 전환 줄"로 읽히기
 * 때문이다.
 *
 * 항목이 셋에서 **다섯**으로 늘면서(버그제보 · 불법이용제보) 343 폭에 균등 분할로는
 * 들어가지 않는다. 다섯 칸으로 쪼개면 "불법이용제보"가 두 줄로 접혀 탭 높이가
 * 들쭉날쭉해지므로, 균등 분할을 버리고 **가로 스크롤**로 바꾼다 — 첫 화면에 네
 * 개쯤 보이고 나머지는 밀어서 본다. 스크롤바는 감춘다(탭 아래 구분선과 겹쳐
 * 보인다). 활성 탭의 분홍 밑줄은 그대로다.
 *
 * 링크로 두므로 PC 의 메뉴와 같은 경로·같은 이름을 쓴다 — 폰에서도 "내 문의 내역"
 * 을 이름으로 찾을 수 있다(비로그인은 눌렀을 때 로그인으로 안내된다).
 */
export function SupportTabs({ activeHref }: SupportTabsProps) {
  return (
    <nav
      aria-label="고객지원 메뉴"
      className="border-line-soft scrollbar-hidden -mx-3 mb-6 overflow-x-auto border-b lg:hidden"
    >
      <ul className="flex w-max min-w-full">
        {SUPPORT_MENU.map((item) => {
          const isActive = item.href === activeHref

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  /* `-mb-px` 로 2px 인디케이터가 아래 1px 구분선을 덮는다. */
                  '-mb-px flex h-[47px] items-center justify-center border-b-2 px-3 text-center',
                  'text-[14px] leading-[20px] font-medium whitespace-nowrap transition-colors',
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
