'use client'

import { useState } from 'react'

import { Button, Input } from '@/components/ui'
import { INQUIRY_SUBTYPE_COUNT_MAX, INQUIRY_SUBTYPE_MAX } from '@/lib/validation/inquiry-categories'

/**
 * 세부 문의 유형 편집기.
 *
 * 한 항목이 그대로 사용자 폼의 유형 셀렉트 한 줄이 되고, 고른 값이
 * `inquiries.type` 에 저장된다(마이그레이션 20260910000700). 그래서 **순서까지**
 * 편집한다 — 위에 둔 항목이 사용자에게도 먼저 보인다.
 *
 * 항목마다 `name="subtypes"` 인 입력을 그대로 둔다(hidden 이 아니라 진짜 입력이다).
 * 서버 액션은 `formData.getAll('subtypes')` 로 화면에 보이는 순서 그대로 받는다 —
 * 값의 출처가 화면과 전송에서 갈리지 않는다.
 *
 * 비워 둘 수 있다. 세부 유형이 없는 카테고리는 사용자 폼에서 유형 셀렉트를 잠그고
 * '기타' 로 접수된다(`lib/utils/inquiry-subtypes.ts` — 사용자 사이트).
 */
export function InquiryCategorySubtypeEditor({
  defaultSubtypes,
  error,
}: {
  defaultSubtypes: readonly string[]
  error?: string
}) {
  const [subtypes, setSubtypes] = useState<readonly string[]>(defaultSubtypes)
  const isFull = subtypes.length >= INQUIRY_SUBTYPE_COUNT_MAX

  const replaceAt = (index: number, value: string) => {
    setSubtypes((current) => current.map((item, at) => (at === index ? value : item)))
  }

  const removeAt = (index: number) => {
    setSubtypes((current) => current.filter((_item, at) => at !== index))
  }

  /** 위/아래로 한 칸. 끝에서는 버튼이 비활성이지만, 범위를 벗어나면 그대로 둔다. */
  const moveAt = (index: number, direction: -1 | 1) => {
    setSubtypes((current) => {
      const target = index + direction
      const moved = current[index]
      const displaced = current[target]

      if (moved === undefined || displaced === undefined) {
        return current
      }

      return current.map((item, at) => {
        if (at === index) {
          return displaced
        }

        return at === target ? moved : item
      })
    })
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink text-[13px] font-semibold">
        세부 문의 유형
        <span className="text-muted ml-2 text-[12px] font-normal">
          {subtypes.length} / {INQUIRY_SUBTYPE_COUNT_MAX}
        </span>
      </legend>

      <p className="text-muted text-[12px]">
        사용자가 이 카테고리를 고르면 유형 셀렉트에 이 항목들이 순서대로 보이고, 고른 값이 문의의
        유형으로 저장됩니다. 비워 두면 셀렉트가 잠기고 &lsquo;기타&rsquo; 로 접수됩니다.
      </p>

      {subtypes.length === 0 ? (
        <p className="border-line text-muted rounded-panel border border-dashed px-3 py-2.5 text-[13px]">
          세부 유형이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {subtypes.map((subtype, index) => (
            /* key 가 값이면 같은 글자를 두 번 넣었을 때 입력이 서로 뒤바뀐다.
               항목의 정체는 "몇 번째 줄인가"이므로 자리로 식별한다. */
            <li key={index} className="flex items-end gap-1.5">
              <Input
                name="subtypes"
                aria-label={`세부 유형 ${index + 1}`}
                value={subtype}
                maxLength={INQUIRY_SUBTYPE_MAX}
                onChange={(event) => replaceAt(index, event.target.value)}
                wrapperClassName="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                aria-label={`세부 유형 ${index + 1} 위로`}
                disabled={index === 0}
                onClick={() => moveAt(index, -1)}
                className="h-10 px-2"
              >
                ▲
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`세부 유형 ${index + 1} 아래로`}
                disabled={index === subtypes.length - 1}
                onClick={() => moveAt(index, 1)}
                className="h-10 px-2"
              >
                ▼
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`세부 유형 ${index + 1} 삭제`}
                onClick={() => removeAt(index)}
                className="h-10"
              >
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isFull}
          onClick={() => setSubtypes((current) => [...current, ''])}
        >
          세부 유형 추가
        </Button>
        {isFull && (
          <span className="text-muted ml-2 text-[12px]">
            {INQUIRY_SUBTYPE_COUNT_MAX}개까지 넣을 수 있습니다.
          </span>
        )}
      </div>

      {error === undefined ? null : (
        <p role="alert" className="text-danger text-[12px]">
          {error}
        </p>
      )}
    </fieldset>
  )
}
