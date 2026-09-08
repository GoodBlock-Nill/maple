'use server'

import { revalidatePath } from 'next/cache'

import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getHeroBanners, SITE_SETTINGS_ID } from '@/lib/data/settings'
import { createClient } from '@/lib/supabase/server'
import {
  ASSET_TYPE_ERROR,
  heroBannerSchema,
  HERO_BANNER_TEXT_FIELDS,
  movedOrder,
  PUBLIC_ASSET_EXTENSIONS,
  siteSettingsSchema,
  SITE_SETTINGS_TEXT_FIELDS,
  toHeroBannerRow,
  toSiteSettingsRow,
} from '@/lib/validation/settings'

import type { Json } from '@/types/database.types'

/**
 * 사이트 설정 · 히어로 배너 변경.
 *
 * 설정은 사용자 사이트의 모든 페이지에 즉시 드러난다. 저장 전후를 감사 로그에
 * 남겨 "언제 무엇이 바뀌었는지"를 되짚을 수 있게 한다.
 */

const SETTINGS_PATH = '/settings'
const BUCKET = 'public-assets'

function readFile(formData: FormData, name: string): File | null {
  const value = formData.get(name)

  return value instanceof File && value.size > 0 ? value : null
}

/** 이름 목록을 그대로 읽어 `{ 이름: 값 }` 으로 만든다. 폼 필드가 많은 설정 화면용. */
function readFields(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, readField(formData, name)]))
}

/**
 * public-assets 업로드. 경로가 고정된 자산(크리에이터 사진)은 덮어쓰되 URL 에
 * 갱신 시각을 붙인다 — 안 붙이면 CDN 이 옛 이미지를 계속 내려 준다.
 */
async function uploadAsset(
  file: File,
  buildPath: (extension: string) => string,
  upsert: boolean,
): Promise<{ url: string } | { error: string }> {
  const extension = PUBLIC_ASSET_EXTENSIONS[file.type]

  if (extension === undefined) {
    return { error: ASSET_TYPE_ERROR }
  }

  const supabase = await createClient()
  const path = buildPath(extension)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert })

  if (error !== null) {
    return { error: `이미지를 올리지 못했습니다. ${error.message}` }
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  return { url: upsert ? `${publicUrl}?v=${Date.now()}` : publicUrl }
}

export async function saveSiteSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const photo = readFile(formData, 'creatorPhotoFile')
  let creatorPhotoUrl = readField(formData, 'creatorPhotoUrl')

  if (photo !== null) {
    const uploaded = await uploadAsset(photo, (ext) => `site/creator-photo.${ext}`, true)

    if ('error' in uploaded) {
      return { fieldErrors: { creatorPhotoFile: uploaded.error } }
    }

    creatorPhotoUrl = uploaded.url
  }

  const parsed = siteSettingsSchema.safeParse({
    ...readFields(formData, SITE_SETTINGS_TEXT_FIELDS),
    creatorPhotoUrl,
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const payload = toSiteSettingsRow(parsed.data)
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', SITE_SETTINGS_ID)
    .maybeSingle()

  /* 행이 없을 수도 있다(빈 DB). upsert 로 두면 첫 저장이 곧 초기화가 된다. */
  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: SITE_SETTINGS_ID, ...payload }, { onConflict: 'id' })

  if (error !== null) {
    return { formError: `저장하지 못했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: 'settings.update',
    targetTable: 'site_settings',
    targetId: String(SITE_SETTINGS_ID),
    before: (before ?? null) as Json,
    after: payload as Json,
  })

  revalidatePath(SETTINGS_PATH)
  return { message: '사이트 설정을 저장했습니다.' }
}

/** 생성·수정 공용. `id` 가 비어 있으면 생성이다. */
export async function saveHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const id = readField(formData, 'id')

  const image = readFile(formData, 'imageFile')
  let imageUrl = readField(formData, 'imageUrl')

  if (image !== null) {
    const uploaded = await uploadAsset(
      image,
      (ext) => `banners/${crypto.randomUUID()}.${ext}`,
      false,
    )

    if ('error' in uploaded) {
      return { fieldErrors: { imageFile: uploaded.error } }
    }

    imageUrl = uploaded.url
  }

  const parsed = heroBannerSchema.safeParse({
    ...readFields(formData, HERO_BANNER_TEXT_FIELDS),
    imageUrl,
    isActive: formData.get('isActive') !== null,
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const payload = toHeroBannerRow(parsed.data)
  const supabase = await createClient()
  const isNew = id === ''

  /* 수정이면 이전 값을 먼저 읽는다. 저장한 뒤에는 무엇이 바뀌었는지 알 수 없다. */
  const before = isNew
    ? null
    : ((await supabase.from('hero_banners').select('*').eq('id', id).maybeSingle()).data as Json)

  const { data, error } = isNew
    ? await supabase.from('hero_banners').insert(payload).select('id').single()
    : await supabase.from('hero_banners').update(payload).eq('id', id).select('id').single()

  if (error !== null) {
    return { formError: `저장하지 못했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: isNew ? 'banner.create' : 'banner.update',
    targetTable: 'hero_banners',
    targetId: data.id,
    before,
    after: payload as Json,
  })

  revalidatePath(SETTINGS_PATH)
  return { message: '배너를 저장했습니다.' }
}

export async function deleteHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const id = readField(formData, 'id')

  if (id === '') {
    return { formError: '대상을 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('hero_banners')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (before === null) {
    return { formError: '이미 삭제된 배너입니다.' }
  }

  const { error } = await supabase.from('hero_banners').delete().eq('id', id)
  if (error !== null) {
    return { formError: `삭제하지 못했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: 'banner.delete',
    targetTable: 'hero_banners',
    targetId: id,
    before: before as Json,
  })

  revalidatePath(SETTINGS_PATH)
  return { message: `${before.title} 배너를 삭제했습니다.` }
}

/** 목록에서의 노출 토글. 값 하나만 바꾸므로 감사 로그도 그 한 줄만 남긴다. */
export async function toggleHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const id = readField(formData, 'id')
  const isActive = readField(formData, 'isActive') === 'true'
  const supabase = await createClient()
  const { error } = await supabase.from('hero_banners').update({ is_active: isActive }).eq('id', id)

  if (error !== null) {
    return { formError: `상태를 바꾸지 못했습니다. ${error.message}` }
  }

  await writeAuditLog(actor.id, {
    action: 'banner.toggle',
    targetTable: 'hero_banners',
    targetId: id,
    before: { is_active: !isActive },
    after: { is_active: isActive },
  })

  revalidatePath(SETTINGS_PATH)
  return { message: isActive ? '배너를 노출합니다.' : '배너를 숨겼습니다.' }
}

/** 순서 변경. 계산은 `movedOrder()` 가 하고 여기서는 바뀐 행만 기록한다. */
export async function moveHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const id = readField(formData, 'id')
  const direction = readField(formData, 'direction') === 'up' ? 'up' : 'down'
  const ordered = movedOrder(await getHeroBanners(), id, direction)

  if (ordered === null) {
    return { formError: '더 이상 이동할 수 없습니다.' }
  }

  const supabase = await createClient()
  for (const [position, banner] of ordered.entries()) {
    if (banner.sortOrder === position) {
      continue
    }

    const { error } = await supabase
      .from('hero_banners')
      .update({ sort_order: position })
      .eq('id', banner.id)

    if (error !== null) {
      return { formError: `순서를 바꾸지 못했습니다. ${error.message}` }
    }
  }

  await writeAuditLog(actor.id, {
    action: 'banner.reorder',
    targetTable: 'hero_banners',
    targetId: id,
    after: { order: ordered.map((banner) => banner.id) },
  })

  revalidatePath(SETTINGS_PATH)
  return { message: '배너 순서를 변경했습니다.' }
}
