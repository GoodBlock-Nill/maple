'use client'

import { useActionState, useState } from 'react'

import { GachaPreview } from '@/components/gacha/GachaPreview'
import { GachaRowsEditor } from '@/components/gacha/GachaRowsEditor'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { saveGachaItemAction } from '@/lib/actions/gacha-actions'
import { GACHA_TABS, type GachaDetailRow, type GachaTab } from '@/lib/validation/gacha'

import type { GachaAdminItem } from '@/lib/data/gacha'

/**
 * 확률형 아이템 작성·수정 폼.
 *
 * `item` 이 없으면 생성이다. 두 화면을 한 컴포넌트로 두는 이유는 필드가 완전히
 * 같기 때문이다 — 나누면 한쪽에만 필드를 추가하는 사고가 반드시 생긴다.
 *
 * 카드에 드러나는 값(이름·확률·아이콘·확률표)만 상태로 들고 있다. 미리보기가
 * 저장 전에 사용자 사이트와 같은 화면을 보여 주려면 그 값들이 필요하다.
 */
export function GachaForm({
  item,
  defaultTab,
  publishedAtLocal,
}: {
  item: GachaAdminItem | null
  defaultTab: GachaTab
  /** 서버가 KST 로 환산해 넘긴 `datetime-local` 값. */
  publishedAtLocal: string
}) {
  const [state, formAction, isPending] = useActionState(saveGachaItemAction, EMPTY_FORM_STATE)
  const [name, setName] = useState(item?.name ?? '')
  const [probability, setProbability] = useState(item === null ? '0' : item.probability.toFixed(3))
  const [iconUrl, setIconUrl] = useState(item?.iconUrl ?? '')
  const [publishedAt, setPublishedAt] = useState(publishedAtLocal)
  const [rows, setRows] = useState<readonly GachaDetailRow[]>(item?.rows ?? [])

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="id" value={item?.id ?? ''} />
      <input type="hidden" name="rows" value={JSON.stringify(rows)} readOnly />

      <FormBanner message={state.formError} />

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="탭"
          name="tab"
          required
          defaultValue={item?.tab ?? defaultTab}
          options={GACHA_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          error={state.fieldErrors?.tab}
        />
        <Input
          label="이름"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="프리미엄 부화기 12차"
          error={state.fieldErrors?.name}
        />
        <Input
          label="대표 확률 (%)"
          name="probability"
          required
          inputMode="decimal"
          value={probability}
          onChange={(event) => setProbability(event.target.value)}
          hint="0~100, 소수점 셋째 자리까지. 사이트 카드에는 둘째 자리로 반올림해 보입니다."
          error={state.fieldErrors?.probability}
        />
        <Input
          label="게시일"
          name="publishedAt"
          type="datetime-local"
          value={publishedAt}
          onChange={(event) => setPublishedAt(event.target.value)}
          hint="한국 시간 기준입니다. 비우면 저장 시각으로 채웁니다."
          error={state.fieldErrors?.publishedAt}
        />
        <Input
          label="아이콘 주소"
          name="iconUrl"
          value={iconUrl}
          onChange={(event) => setIconUrl(event.target.value)}
          placeholder="/images/guide/icon-item-1.png"
          hint="비우면 사이트는 확률표 첫 행의 아이콘을 대신 씁니다."
          error={state.fieldErrors?.iconUrl}
        />
        <Input
          label="아이콘 파일"
          name="iconFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          hint="파일을 올리면 위 주소 대신 업로드한 이미지를 씁니다."
          error={state.fieldErrors?.iconFile}
          className="h-auto py-2"
        />
      </div>

      <label className="text-ink flex w-fit items-center gap-2 text-[13px] font-semibold">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={item?.isPublished ?? true}
          className="accent-accent h-4 w-4"
        />
        사용자 사이트에 공개
      </label>

      <GachaRowsEditor rows={rows} onChange={setRows} />

      <GachaPreview
        name={name}
        probability={probability}
        iconUrl={iconUrl}
        publishedAt={publishedAt.slice(0, 10)}
        rows={rows}
      />

      <div className="border-line flex justify-end gap-2 border-t pt-4">
        <Button href="/gacha" variant="secondary">
          취소
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '저장 중…' : '저장'}
        </Button>
      </div>
    </form>
  )
}
