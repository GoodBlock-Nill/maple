import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

/**
 * 시안 실측: h45 pill, px 15, 그리고 **최소 폭 78px**.
 * (커뮤니티 칩 그룹 폭 343 = 78.25×4 + 10×3 — 두 글자 라벨도 78 로 맞춰진다.)
 */
const CHIP_CLASS =
  'board-control rounded-pill inline-flex min-w-[78px] items-center justify-center px-[15px] ' +
  'text-ui font-medium transition-colors'

const ACTIVE_CLASS = 'bg-ink border-ink text-white'
const INACTIVE_CLASS = 'text-ink-muted hover:border-ink/30 hover:text-ink'

export type FilterChipOption<TValue extends string> = {
  /** null 은 "전체"를 뜻한다. */
  value: TValue | null
  label: string
}

type FilterChipsProps<TValue extends string> = {
  /** "전체" 항목까지 포함한 완성된 목록. 순서가 곧 표시 순서다. */
  options: readonly FilterChipOption<TValue>[]
  active: TValue | null
  /** 칩 값 → 이동할 URL. 나머지 질의 문자열 유지는 호출부 책임. */
  hrefFor: (value: TValue | null) => string
  label: string
  className?: string
  /**
   * 좁은 화면에서 가로 스크롤 대신 다음 줄로 접는다.
   * 칩이 많아 한 줄에 담기지 않는 목록(뉴스 말머리 6종 + 전체)에 쓴다.
   */
  wrap?: boolean
}

/**
 * 목록 필터 칩. 값은 전부 URL 로 표현되므로 항목은 모두 `<Link>` 다.
 * 기본은 한 줄 + 좁은 화면 가로 스크롤이고, `wrap` 이면 좁은 화면에서 접힌다.
 */
export function FilterChips<TValue extends string>({
  options,
  active,
  hrefFor,
  label,
  className,
  wrap = false,
}: FilterChipsProps<TValue>) {
  return (
    <nav
      aria-label={label}
      className={cn(
        wrap
          ? ''
          : 'scrollbar-hidden -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0',
        className,
      )}
    >
      <ul
        className={cn(
          'flex items-center gap-2.5 sm:w-auto sm:flex-wrap',
          wrap ? 'w-full flex-wrap' : 'w-max',
        )}
      >
        {options.map((option) => {
          const isActive = option.value === active

          return (
            <li key={option.value ?? 'all'}>
              <Link
                href={hrefFor(option.value)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(CHIP_CLASS, isActive ? ACTIVE_CLASS : INACTIVE_CLASS)}
              >
                {option.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
