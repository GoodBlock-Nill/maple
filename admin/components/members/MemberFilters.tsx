import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { firstValue, type QueryParams } from '@/lib/utils/table-query'
import {
  MEMBER_PROVIDER_LABEL,
  MEMBER_PROVIDERS,
  MEMBER_STATUS_FILTERS,
  MEMBER_STATUS_LABEL,
} from '@/lib/validation/members'

import type { SelectOption } from '@/components/ui/Select'

const STATUS_OPTIONS: readonly SelectOption[] = MEMBER_STATUS_FILTERS.map((value) => ({
  value,
  label: MEMBER_STATUS_LABEL[value],
}))

const PROVIDER_OPTIONS: readonly SelectOption[] = MEMBER_PROVIDERS.map((value) => ({
  value,
  label: MEMBER_PROVIDER_LABEL[value],
}))

/**
 * 회원 목록 필터 — 커뮤니티와 같은 GET 폼 방식.
 *
 * 검색어 하나로 닉네임과 이메일을 동시에 훑는다. 운영자는 문의를 받을 때 둘 중
 * 무엇을 손에 들고 있을지 모르기 때문에, 입력칸을 나누면 매번 헛다리를 짚는다.
 */
export function MemberFilters({ pathname, params }: { pathname: string; params: QueryParams }) {
  const sort = firstValue(params.sort)

  return (
    <form
      method="get"
      action={pathname}
      className="border-line bg-surface rounded-card shadow-card mb-4 flex flex-wrap items-end gap-3 border px-5 py-4"
    >
      {sort !== null && <input type="hidden" name="sort" value={sort} />}

      <Input
        label="검색"
        name="q"
        defaultValue={firstValue(params.q) ?? ''}
        maxLength={SEARCH_MAX_LENGTH}
        countPlacement="label"
        placeholder="닉네임 또는 이메일"
        wrapperClassName="w-56"
      />

      <Select
        label="상태"
        name="status"
        defaultValue={firstValue(params.status) ?? ''}
        options={STATUS_OPTIONS}
        placeholder="전체"
        wrapperClassName="w-32"
      />

      <Select
        label="가입 방식"
        name="provider"
        defaultValue={firstValue(params.provider) ?? ''}
        options={PROVIDER_OPTIONS}
        placeholder="전체"
        wrapperClassName="w-32"
      />

      <Input
        label="가입 시작일"
        name="from"
        type="date"
        defaultValue={firstValue(params.from) ?? ''}
        wrapperClassName="w-40"
      />

      <Input
        label="가입 종료일"
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
