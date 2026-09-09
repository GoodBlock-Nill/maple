'use client'

import { useCallback } from 'react'

import { Button } from '@/components/ui/Button'
import { countCharacters } from '@/components/ui/CharacterCount'
import { CONTROL_CLASS } from '@/components/ui/FormField'
import { URL_MAX_LENGTH } from '@/lib/constants/field-limits'
import { cn } from '@/lib/utils/cn'
import {
  GACHA_GRADES,
  GACHA_ROW_ITEM_NAME_MAX,
  GACHA_ROW_NOTE_MAX,
  PROBABILITY_INPUT_MAX_LENGTH,
  type GachaDetailRow,
} from '@/lib/validation/gacha'

/**
 * 확률표 편집기.
 *
 * 상태는 상위 폼이 들고 있다(미리보기가 같은 값을 그려야 한다). 값은 입력마다
 * name 을 붙이는 대신 폼이 JSON hidden 필드 하나로 보낸다 — `rows[0][grade]`
 * 같은 이름 규칙은 중간 행을 지우는 순간 인덱스가 어긋난다.
 */

const EMPTY_ROW: GachaDetailRow = {
  grade: 'A',
  itemName: '',
  itemIcon: '',
  probability: '0',
  note: '-',
}

const CELL_CLASS = 'h-9 text-[13px]'

/**
 * 셀 하나 = 입력 + 글자수.
 *
 * 표 안이라 라벨을 그릴 자리가 없어 `FormField`(Input)를 쓰지 않는다. 대신 값이
 * 전부 상위 상태라 셀 수 있는 길이는 prop 으로 바로 계산된다.
 */
function RowCell({
  label,
  value,
  max,
  onChange,
  placeholder,
  className,
  inputMode,
}: {
  label: string
  value: string
  max: number
  onChange: (value: string) => void
  placeholder: string
  className?: string
  inputMode?: 'decimal'
}) {
  const count = countCharacters(value)

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <input
        aria-label={label}
        value={value}
        maxLength={max}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(CONTROL_CLASS, CELL_CLASS, className)}
      />
      <span
        className={cn(
          'text-right text-[11px] tabular-nums',
          count >= max ? 'text-danger font-semibold' : 'text-muted',
        )}
      >
        <span aria-hidden="true">{`${count} / ${max}`}</span>
        <span className="sr-only">{`${label} 최대 ${max}자`}</span>
      </span>
    </span>
  )
}

/** select 의 값은 문자열이다. 목록에서 다시 찾아 등급 타입으로 좁힌다. */
function toGrade(value: string): GachaDetailRow['grade'] {
  return GACHA_GRADES.find((grade) => grade === value) ?? EMPTY_ROW.grade
}

export function GachaRowsEditor({
  rows,
  onChange,
}: {
  rows: readonly GachaDetailRow[]
  onChange: (rows: readonly GachaDetailRow[]) => void
}) {
  const update = useCallback(
    (index: number, patch: Partial<GachaDetailRow>) => {
      onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)))
    },
    [rows, onChange],
  )

  const remove = useCallback(
    (index: number) => {
      onChange(rows.filter((_, position) => position !== index))
    },
    [rows, onChange],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-ink text-[13px] font-semibold">
          확률표 ({rows.length}행)
          <span className="text-muted ml-2 font-normal">
            아이템명·비고는 상세 모달 표에서 한 칸에 약 8~15자마다 줄이 바뀝니다.
          </span>
        </p>
        <Button size="sm" variant="secondary" onClick={() => onChange([...rows, EMPTY_ROW])}>
          행 추가
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="border-line text-muted rounded-panel border border-dashed px-3 py-6 text-center text-[13px]">
          확률표가 비어 있습니다. 필요하면 행을 추가해 주세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li
              key={index}
              className="border-line rounded-panel grid grid-cols-[80px_1fr_1fr_90px_1fr_auto] items-center gap-2 border p-2"
            >
              <label className="sr-only" htmlFor={`row-grade-${index}`}>
                {index + 1}행 등급
              </label>
              <select
                id={`row-grade-${index}`}
                value={row.grade}
                onChange={(event) => update(index, { grade: toGrade(event.target.value) })}
                className={cn(CONTROL_CLASS, CELL_CLASS)}
              >
                {GACHA_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>

              <RowCell
                label={`${index + 1}행 아이템명`}
                value={row.itemName}
                max={GACHA_ROW_ITEM_NAME_MAX}
                onChange={(itemName) => update(index, { itemName })}
                placeholder="아이템명"
              />
              <RowCell
                label={`${index + 1}행 아이콘 주소`}
                value={row.itemIcon}
                max={URL_MAX_LENGTH}
                onChange={(itemIcon) => update(index, { itemIcon })}
                placeholder="아이콘 주소"
              />
              <RowCell
                label={`${index + 1}행 확률`}
                value={row.probability}
                max={PROBABILITY_INPUT_MAX_LENGTH}
                onChange={(probability) => update(index, { probability })}
                inputMode="decimal"
                placeholder="0.05"
                className="text-right"
              />
              <RowCell
                label={`${index + 1}행 비고`}
                value={row.note}
                max={GACHA_ROW_NOTE_MAX}
                onChange={(note) => update(index, { note })}
                placeholder="비고"
              />

              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(index)}
                aria-label={`${index + 1}행 삭제`}
              >
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
