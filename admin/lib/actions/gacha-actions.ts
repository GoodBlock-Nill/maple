'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { actionFailure } from '@/lib/actions/action-failure'
import { readFile, uploadPublicAsset } from '@/lib/actions/asset-upload'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import { gachaItemSchema, gachaRowsJsonSchema } from '@/lib/validation/gacha'
import { kstLocalToIso } from '@/lib/validation/settings'

import type { Json } from '@/types/database.types'

/**
 * 확률형 아이템 CRUD.
 *
 * 모든 액션이 스스로 `requirePermission('gacha', 'write')` 을 부른다. 레이아웃이 이미 막고 있어도
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다.
 */

const LIST_PATH = '/gacha'

/**
 * 사용자 사이트의 확률 공시(목록·상세)는 `unstable_cache` 로 읽는다. 태우지 않으면
 * 공시 변경이 최대 1분 늦게 보인다 — 확률 공시는 법적 고지라 늦으면 안 된다.
 */
async function revalidateGacha(): Promise<void> {
  revalidatePath(LIST_PATH)
  await revalidateClient([CLIENT_CACHE_TAGS.gacha])
}

/** 생성·수정 공용. `id` 가 비어 있으면 생성이다. */
export async function saveGachaItemAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('gacha', 'write')
  const id = readField(formData, 'id')

  const iconFile = readFile(formData, 'iconFile')
  let iconUrl = readField(formData, 'iconUrl')

  if (iconFile !== null) {
    /* 아이콘은 매번 새 UUID 경로로 올린다. 같은 이름의 다른 파일이 서로를 덮어써
       이미 공시된 아이템의 아이콘이 조용히 바뀌는 사고를 막는다. */
    const uploaded = await uploadPublicAsset(
      iconFile,
      (ext) => `gacha/${crypto.randomUUID()}.${ext}`,
      { label: '아이콘' },
    )

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
    return actionFailure(
      'gacha',
      '확률형 아이템을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: isNew ? 'gacha.create' : 'gacha.update',
    targetTable: 'gacha_items',
    targetId: data.id,
    before,
    after: payload as unknown as Json,
  })

  await revalidateGacha()
  redirect(`${LIST_PATH}?tab=${input.tab}`)
}

export async function deleteGachaItemAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('gacha', 'write')
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
    return actionFailure(
      'gacha',
      '확률형 아이템을 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'gacha.delete',
    targetTable: 'gacha_items',
    targetId: id,
    before: before as Json,
  })

  await revalidateGacha()
  return { message: `${before.name}${josa(before.name, '을')} 삭제했습니다.` }
}
