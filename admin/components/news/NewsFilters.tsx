'use client'

import { useRef } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { NEWS_STATUSES, NEWS_STATUS_LABEL } from '@/lib/constants/news'

import type { NewsCategoryOption } from '@/lib/data/news'
import type { SelectOption } from '@/components/ui/Select'

/**
 * 목록 필터 — 평범한 GET 폼.
 *
 * 상태를 컴포넌트가 들고 라우터를 밀어 넣는 대신 폼이 쿼리스트링을 다시 쓰게 둔다.
 * 그래야 새로고침·뒤로가기·링크 공유가 같은 화면을 재현하고, 자바스크립트가 없어도
 * 필터가 동작한다(`lib/utils/table-query.ts` 의 설계와 같은 이유).
 *
 * `page` 는 일부러 폼에 넣지 않는다. 조건이 바뀌면 3페이지는 의미를 잃으므로
 * 제출과 동시에 사라져야 한다. 반대로 `sort` 는 숨은 필드로 보존한다 —
 * 필터를 바꿨다고 정렬까지 초기화되면 목록을 다시 맞춰야 한다.
 */

const STATUS_OPTIONS: readonly SelectOption[] = NEWS_STATUSES.map((status) => ({
  value: status,
  label: NEWS_STATUS_LABEL[status],
}))

type NewsFiltersProps = {
  categories: readonly NewsCategoryOption[]
  category: string
  status: string
  q: string
  sort: string
  isFiltered: boolean
}

export function NewsFilters({
  categories,
  category,
  status,
  q,
  sort,
  isFiltered,
}: NewsFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const submit = () => formRef.current?.requestSubmit()

  return (
    <form
      ref={formRef}
      method="get"
      action="/news"
      className="flex flex-wrap items-end gap-3"
      role="search"
    >
      <input type="hidden" name="sort" value={sort} />

      <Select
        label="카테고리"
        name="category"
        defaultValue={category}
        placeholder="전체"
        options={categories.map((option) => ({ value: option.key, label: option.label }))}
        onChange={submit}
        wrapperClassName="w-40"
      />

      <Select
        label="상태"
        name="status"
        defaultValue={status}
        placeholder="전체(삭제 제외)"
        options={STATUS_OPTIONS}
        onChange={submit}
        wrapperClassName="w-44"
      />

      <Input
        label="검색"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="제목 · 요약"
        wrapperClassName="w-64"
      />

      <Button type="submit">검색</Button>

      {isFiltered && (
        <Button href="/news" variant="ghost">
          초기화
        </Button>
      )}
    </form>
  )
}
