import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { firstValue, type QueryParams } from '@/lib/utils/table-query'
import { CONTENT_STATUS_FILTERS, CONTENT_STATUS_LABEL } from '@/lib/validation/moderation'

import type { SelectOption } from '@/components/ui/Select'

/**
 * 커뮤니티 목록 필터.
 *
 * 상태를 갖지 않는 **평범한 GET 폼**이다. 제출하면 브라우저가 쿼리스트링을 다시
 * 쓰므로 자바스크립트 없이도 동작하고, 결과 화면이 그대로 링크가 된다.
 *
 * 정렬(`sort`)만 hidden 으로 실어 보낸다. GET 폼은 폼 안의 필드로 쿼리를 통째로
 * 갈아 끼우기 때문에, 실어 보내지 않으면 검색할 때마다 정렬이 풀린다.
 * 반대로 `page` 는 일부러 뺀다 — 조건이 바뀌면 3페이지에 머물 이유가 없다.
 */
export function ContentFilters({
  pathname,
  params,
  categories,
}: {
  pathname: string
  params: QueryParams
  /** 게시글 목록에서만 넘긴다(댓글에는 카테고리가 없다). */
  categories?: Record<string, string>
}) {
  const sort = firstValue(params.sort)
  const statusOptions: readonly SelectOption[] = CONTENT_STATUS_FILTERS.map((value) => ({
    value,
    label: CONTENT_STATUS_LABEL[value],
  }))
  const categoryOptions: readonly SelectOption[] = Object.entries(categories ?? {}).map(
    ([value, label]) => ({ value, label }),
  )

  return (
    <form
      method="get"
      action={pathname}
      className="border-line bg-surface rounded-card shadow-card mb-4 flex flex-wrap items-end gap-3 border px-5 py-4"
    >
      {sort !== null && <input type="hidden" name="sort" value={sort} />}

      {categories !== undefined && (
        <Select
          label="카테고리"
          name="category"
          defaultValue={firstValue(params.category) ?? ''}
          options={categoryOptions}
          placeholder="전체"
          wrapperClassName="w-36"
        />
      )}

      <Select
        label="상태"
        name="status"
        defaultValue={firstValue(params.status) ?? ''}
        options={statusOptions}
        placeholder="전체"
        wrapperClassName="w-32"
      />

      <Input
        label="작성자"
        name="author"
        defaultValue={firstValue(params.author) ?? ''}
        maxLength={SEARCH_MAX_LENGTH}
        countPlacement="label"
        placeholder="닉네임 일부"
        wrapperClassName="w-44"
      />

      <Input
        label="시작일"
        name="from"
        type="date"
        defaultValue={firstValue(params.from) ?? ''}
        wrapperClassName="w-40"
      />

      <Input
        label="종료일"
        name="to"
        type="date"
        defaultValue={firstValue(params.to) ?? ''}
        wrapperClassName="w-40"
      />

      <div className="flex items-center gap-2 pb-0.5">
        <Button type="submit">검색</Button>
        <Button href={pathname} variant="ghost">
          초기화
        </Button>
      </div>
    </form>
  )
}

/** 목록 셀에서 쓰는 작은 링크(작성자·원문 이동). */
export function CellLink({
  href,
  children,
  external = false,
}: {
  href: string
  children: React.ReactNode
  external?: boolean
}) {
  const className =
    'focus-visible:outline-focus text-accent-strong rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2'

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
