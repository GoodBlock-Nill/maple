'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { parseCsvTable } from '@/lib/utils/csv'
import {
  gachaCsvRowSchema,
  gachaItemSchema,
  gachaRowsJsonSchema,
  GACHA_CSV_REQUIRED_HEADERS,
  type GachaTab,
} from '@/lib/validation/gacha'
import { ASSET_TYPE_ERROR, kstLocalToIso, PUBLIC_ASSET_EXTENSIONS } from '@/lib/validation/settings'

import type { TablesInsert } from '@/lib/supabase/types'
import type { Json } from '@/types/database.types'

/**
 * 확률형 아이템 CRUD · CSV 가져오기.
 *
 * 모든 액션이 스스로 `requireAdmin()` 을 부른다. 레이아웃이 이미 막고 있어도
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다.
 */

const LIST_PATH = '/gacha'
const BUCKET = 'public-assets'

/**
 * 아이콘 업로드.
 *
 * 파일 이름을 그대로 쓰지 않고 UUID 로 바꾼다. 같은 이름의 다른 파일이 서로를
 * 덮어써 이미 공시된 아이템의 아이콘이 조용히 바뀌는 사고를 막는다.
 */
async function uploadIcon(file: File): Promise<{ url: string } | { error: string }> {
  const extension = PUBLIC_ASSET_EXTENSIONS[file.type]

  if (extension === undefined) {
    return { error: ASSET_TYPE_ERROR }
  }

  const supabase = await createClient()
  const path = `gacha/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error !== null) {
    return { error: `아이콘을 올리지 못했습니다. ${error.message}` }
  }

  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

function readFile(formData: FormData, name: string): File | null {
  const value = formData.get(name)

  return value instanceof File && value.size > 0 ? value : null
}

/** 생성·수정 공용. `id` 가 비어 있으면 생성이다. */
export async function saveGachaItemAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const id = readField(formData, 'id')

  const iconFile = readFile(formData, 'iconFile')
  let iconUrl = readField(formData, 'iconUrl')

  if (iconFile !== null) {
    const uploaded = await uploadIcon(iconFile)

    if ('error' in uploaded) {
      return { fieldErrors: { iconFile: uploaded.error } }
    }

    iconUrl = uploaded.url
  }

  const rows = gachaRowsJsonSchema.safeParse(readField(formData, 'rows'))

  if (!rows.success) {
    return { formError: '확률표에 잘못된 값이 있습니다. 등급·아이템명·확률을 확인해 주세요.' }
  }

  const parsed = gachaItemSchema.safeParse({
    tab: readField(formData, 'tab'),
    name: readField(formData, 'name'),
    iconUrl,
    probability: readField(formData, 'probability'),
    rows: rows.data,
    isPublished: formData.get('isPublished') !== null,
    publishedAt: readField(formData, 'publishedAt'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const input = parsed.data
  const payload = {
    tab: input.tab,
    name: input.name,
    icon_url: input.iconUrl === '' ? null : input.iconUrl,
    probability: input.probability,
    rows: input.rows as unknown as Json,
    is_published: input.isPublished,
    published_at: kstLocalToIso(input.publishedAt) ?? new Date().toISOString(),
  }

  const supabase = await createClient()
  const isNew = id === ''

  /* 수정이면 이전 값을 먼저 읽는다. 저장한 뒤에는 무엇이 바뀌었는지 알 수 없다. */
  const before = isNew
    ? null
    : ((await supabase.from('gacha_items').select('*').eq('id', id).maybeSingle()).data as Json)

  const { data, error } = isNew
    ? await supabase.from('gacha_items').insert(payload).select('id').single()
    : await supabase.from('gacha_items').update(payload).eq('id', id).select('id').single()

  if (error !== null) {
    return { formError: `저장하지 못했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: isNew ? 'gacha.create' : 'gacha.update',
    targetTable: 'gacha_items',
    targetId: data.id,
    before,
    after: payload as unknown as Json,
  })

  revalidatePath(LIST_PATH)
  redirect(`${LIST_PATH}?tab=${input.tab}`)
}

export async function deleteGachaItemAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const id = readField(formData, 'id')

  if (id === '') {
    return { formError: '대상을 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { data: before } = await supabase.from('gacha_items').select('*').eq('id', id).maybeSingle()

  if (before === null) {
    return { formError: '이미 삭제된 항목입니다.' }
  }

  const { error } = await supabase.from('gacha_items').delete().eq('id', id)

  if (error !== null) {
    return { formError: `삭제하지 못했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: 'gacha.delete',
    targetTable: 'gacha_items',
    targetId: id,
    before: before as Json,
  })

  revalidatePath(LIST_PATH)
  return { message: `${before.name} 을(를) 삭제했습니다.` }
}

type ImportRow = {
  id: string
  tab: GachaTab
  name: string
  /* 행 모양을 DB 삽입 타입에 묶어 둔다. Record<string, Json> 으로 두면 열 이름을
     오타 내도 upsert 호출까지 타입 오류가 드러나지 않는다. */
  payload: Omit<TablesInsert<'gacha_items'>, 'id'>
}

/**
 * CSV 가져오기.
 *
 * 브라우저에서 이미 미리보기를 거쳤더라도 **서버가 원본 텍스트를 다시 파싱한다**.
 * 미리보기 결과를 그대로 믿으면 조작된 요청 하나로 검증을 통째로 건너뛸 수 있다.
 *
 * 한 행이라도 틀리면 전체를 반려한다. 부분 적용은 "어디까지 들어갔는지" 모르는
 * 상태를 만들고, 운영자는 같은 파일을 다시 올릴 수 없게 된다.
 */
export async function importGachaCsvAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const table = parseCsvTable(readField(formData, 'csv'), GACHA_CSV_REQUIRED_HEADERS)

  if (table.error !== null) {
    return { formError: table.error }
  }

  if (table.records.length === 0) {
    return { formError: '데이터 행이 없습니다.' }
  }

  const issues: string[] = []
  const parsedRows: ImportRow[] = []

  for (const record of table.records) {
    const parsed = gachaCsvRowSchema.safeParse(record.values)

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '값이 올바르지 않습니다.'
      issues.push(`${record.line}번째 줄: ${message}`)

      continue
    }

    const row = parsed.data

    parsedRows.push({
      id: row.id,
      tab: row.tab,
      name: row.name,
      payload: {
        tab: row.tab,
        name: row.name,
        icon_url: row.icon_url === '' ? null : row.icon_url,
        probability: row.probability,
        rows: row.rows as unknown as Json,
        is_published: row.is_published,
        published_at: row.published_at ?? new Date().toISOString(),
      },
    })
  }

  if (issues.length > 0) {
    return {
      formError: `${issues.length}개 행에 오류가 있어 적용하지 않았습니다. ${issues.slice(0, 3).join(' / ')}`,
    }
  }

  const supabase = await createClient()
  const tabs = [...new Set(parsedRows.map((row) => row.tab))]
  const { data: existing } = await supabase
    .from('gacha_items')
    .select('id, tab, name')
    .in('tab', tabs)

  /* id 열이 비어 있으면 (tab, name) 으로 기존 행을 찾는다. 운영자가 엑셀에서 새 줄을
     추가할 때 id 를 채우지 않는 것이 자연스러운데, 그때마다 중복이 생기면 안 된다. */
  const idByName = new Map((existing ?? []).map((row) => [`${row.tab}/${row.name}`, row.id]))
  const known = new Set((existing ?? []).map((row) => row.id))

  const upsertRows = parsedRows.map((row) => {
    const matched = known.has(row.id) ? row.id : idByName.get(`${row.tab}/${row.name}`)

    return { id: matched ?? crypto.randomUUID(), ...row.payload }
  })

  const created = upsertRows.filter((row) => !known.has(row.id)).length
  const { error } = await supabase.from('gacha_items').upsert(upsertRows, { onConflict: 'id' })

  if (error !== null) {
    return { formError: `적용하지 못했습니다. ${error.message}` }
  }

  const updated = upsertRows.length - created

  await writeAuditLog(actor.id, {
    action: 'gacha.import',
    targetTable: 'gacha_items',
    after: { total: upsertRows.length, created, updated, tabs },
  })

  revalidatePath(LIST_PATH)
  return {
    message: `${upsertRows.length}건을 적용했습니다. (신규 ${created}건 · 수정 ${updated}건)`,
  }
}
