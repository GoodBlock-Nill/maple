'use client'

import { ADMIN_MODULES, PERMISSION_LEVELS, PERMISSION_LEVEL_LABEL } from '@/lib/auth/permissions'
import { PERMISSION_FIELD_PREFIX } from '@/lib/validation/admins'

import type { ModulePermissions, PermissionLevel } from '@/lib/auth/permissions'

/**
 * 모듈 × 등급 라디오 표.
 *
 * 체크박스 두 개(읽기·쓰기)가 아니라 라디오 세 개인 이유: 체크박스로 두면 "읽기는
 * 껐는데 쓰기는 켠" 조합이 만들어지고, 그 상태의 의미를 아무도 설명할 수 없다.
 * 등급은 서열이므로 하나만 고르게 한다.
 *
 * 값은 비제어 라디오다 — 폼이 그대로 제출하고 서버가 다시 파싱한다
 * (`permissionMatrixSchema`). 상태를 들면 라디오 13×3 개의 리렌더가 매 클릭마다 돈다.
 */
export function PermissionMatrixField({ defaults }: { defaults: ModulePermissions }) {
  return (
    <fieldset className="border-line rounded-panel flex flex-col border">
      <legend className="sr-only">모듈별 권한</legend>

      <div className="border-line text-muted grid grid-cols-[1fr_repeat(3,56px)] items-center gap-2 border-b px-3 py-2 text-[12px] font-semibold">
        <span>모듈</span>
        {PERMISSION_LEVELS.map((level) => (
          <span key={level} className="text-center">
            {PERMISSION_LEVEL_LABEL[level]}
          </span>
        ))}
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {ADMIN_MODULES.map((module) => (
          <ModuleRow
            key={module.key}
            module={module.key}
            label={module.label}
            defaultLevel={defaults[module.key] ?? 'none'}
          />
        ))}
      </div>
    </fieldset>
  )
}

function ModuleRow({
  module,
  label,
  defaultLevel,
}: {
  module: string
  label: string
  defaultLevel: PermissionLevel
}) {
  const name = `${PERMISSION_FIELD_PREFIX}${module}`

  return (
    <div className="border-line grid grid-cols-[1fr_repeat(3,56px)] items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
      <span className="text-ink text-[13px]">{label}</span>
      {PERMISSION_LEVELS.map((level) => (
        <span key={level} className="flex justify-center">
          <input
            type="radio"
            name={name}
            value={level}
            defaultChecked={defaultLevel === level}
            aria-label={`${label} ${PERMISSION_LEVEL_LABEL[level]}`}
            className="accent-accent size-4"
          />
        </span>
      ))}
    </div>
  )
}
