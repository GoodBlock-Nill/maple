import Image from 'next/image'

import { LinkMenu } from '@/components/board/LinkMenu'

import type { BoardOption } from '@/lib/constants/board'

type SortMenuProps<TValue extends string> = {
  options: readonly BoardOption<TValue>[]
  active: TValue
  hrefFor: (value: TValue) => string
  /** 트리거 버튼의 접근성 이름. */
  label?: string
  className?: string
}

/**
 * 목록 정렬 드롭다운. 시안에서는 박스 없이 텍스트 + 캐럿만 노출한다.
 * 항목은 전부 URL 링크라 서버 필터와 상태가 어긋나지 않는다.
 */
export function SortMenu<TValue extends string>({
  options,
  active,
  hrefFor,
  label = '정렬 기준',
  className,
}: SortMenuProps<TValue>) {
  const current = options.find((option) => option.value === active) ?? options[0]

  return (
    <LinkMenu
      className={className}
      label={label}
      triggerClassName="text-ink-muted pl-3 text-ui font-medium"
      menuClassName="right-auto left-0"
      trigger={
        <>
          {current?.label}
          <Image
            src="/images/brand/icon-sort-caret.svg"
            alt=""
            width={25}
            height={25}
            aria-hidden
            className="rotate-90 transition-transform duration-150 ease-out group-data-[state=open]:rotate-[270deg] motion-reduce:transition-none"
          />
        </>
      }
      items={options.map((option) => ({
        label: option.label,
        href: hrefFor(option.value),
        isActive: option.value === active,
      }))}
    />
  )
}
