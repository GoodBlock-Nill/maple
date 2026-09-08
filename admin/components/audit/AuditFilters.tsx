import { auditActionLabel, auditTableLabel } from '@/components/audit/audit-labels'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

import type { AuditFilterOptions, AuditFilters as Filters } from '@/lib/data/audit'

/**
 * 감사 로그 필터.
 *
 * GET `<form>` 이다. 필터 상태가 곧 URL 이므로 링크로 공유하면 같은 화면이 다시
 * 열리고, 새로고침해도 조건이 남는다. 자바스크립트도 필요 없다.
 */
export function AuditFilters({
  filters,
  options,
}: {
  filters: Filters
  options: AuditFilterOptions
}) {
  return (
    <form
      action="/audit"
      method="get"
      className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 lg:items-end"
    >
      <Select
        label="관리자"
        name="actor"
        defaultValue={filters.actorId ?? ''}
        placeholder="전체"
        options={options.actors.map((actor) => ({ value: actor.value, label: actor.label }))}
      />
      <Select
        label="대상 테이블"
        name="table"
        defaultValue={filters.targetTable ?? ''}
        placeholder="전체"
        options={options.tables.map((table) => ({ value: table, label: auditTableLabel(table) }))}
      />
      <Select
        label="행동"
        name="action"
        defaultValue={filters.action ?? ''}
        placeholder="전체"
        options={options.actions.map((action) => ({
          value: action,
          label: auditActionLabel(action),
        }))}
      />
      <Input label="시작일" name="from" type="date" defaultValue={filters.from ?? ''} />
      <Input label="종료일" name="to" type="date" defaultValue={filters.to ?? ''} />
      <div className="flex items-end gap-2">
        <Input
          label="대상 ID"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="일부만 입력해도 됩니다"
          wrapperClassName="flex-1"
        />
      </div>
      <div className="flex gap-2 lg:col-span-6 lg:justify-end">
        <Button href="/audit" variant="ghost" size="sm">
          초기화
        </Button>
        <Button type="submit" size="sm">
          검색
        </Button>
      </div>
    </form>
  )
}
