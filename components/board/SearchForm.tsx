import Image from 'next/image'

import { cn } from '@/lib/utils/cn'

const SEARCH_PLACEHOLDER = '검색어를 입력해주세요'

type SearchFormProps = {
  /** GET 대상 경로. 제출 시 `?q=` 만 갱신되고 page 는 1로 초기화된다. */
  action: string
  defaultValue: string
  /** 검색과 함께 유지할 다른 필터(카테고리·정렬·보기 등). */
  keep?: Record<string, string | null | undefined>
  className?: string
}

export function SearchForm({ action, defaultValue, keep = {}, className }: SearchFormProps) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className={cn('board-control flex items-center gap-2 px-3', className)}
    >
      {Object.entries(keep).map(([name, value]) =>
        value === null || value === undefined || value === '' ? null : (
          <input key={name} type="hidden" name={name} value={value} />
        ),
      )}
      <Image
        src="/images/brand/icon-search.svg"
        alt=""
        width={25}
        height={25}
        aria-hidden
        className="shrink-0"
      />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        aria-label="검색어"
        placeholder={SEARCH_PLACEHOLDER}
        className="text-ink placeholder:text-ink-muted h-full w-full min-w-0 bg-transparent text-[17px] outline-none"
      />
    </form>
  )
}
