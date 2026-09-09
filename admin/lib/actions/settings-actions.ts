'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { readFile, uploadPublicAsset } from '@/lib/actions/asset-upload'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { getHeroBanners, SITE_SETTINGS_ID } from '@/lib/data/settings'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { createClient } from '@/lib/supabase/server'
import {
  heroBannerSchema,
  HERO_BANNER_TEXT_FIELDS,
  movedOrder,
  toHeroBannerRow,
} from '@/lib/validation/hero-banner'
import {
  siteSettingsSchema,
  SITE_SETTINGS_TEXT_FIELDS,
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

/**
 * 설정은 사용자 사이트의 헤더·푸터·소개까지 전부에 드러난다. `site` 태그 하나로
 * `site_settings` 와 히어로 배너를 함께 태운다(둘 다 같은 태그로 캐시된다).
 */
async function revalidateSite(): Promise<void> {
  revalidatePath(SETTINGS_PATH)
  await revalidateClient([CLIENT_CACHE_TAGS.site])
}

/** 이름 목록을 그대로 읽어 `{ 이름: 값 }` 으로 만든다. 폼 필드가 많은 설정 화면용. */
function readFields(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, readField(formData, name)]))
}

export async function saveSiteSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('settings', 'write')
  const photo = readFile(formData, 'creatorPhotoFile')
  let creatorPhotoUrl = readField(formData, 'creatorPhotoUrl')

  if (photo !== null) {
    const uploaded = await uploadPublicAsset(photo, (ext) => `site/creator-photo.${ext}`, {
      upsert: true,
    })

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
    return actionFailure(
      'settings',
      '사이트 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'settings.update',
    targetTable: 'site_settings',
    targetId: String(SITE_SETTINGS_ID),
    before: (before ?? null) as Json,
    after: payload as Json,
  })

  await revalidateSite()
  return { message: '사이트 설정을 저장했습니다.' }
}

/** 생성·수정 공용. `id` 가 비어 있으면 생성이다. */
export async function saveHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('settings', 'write')
  const id = readField(formData, 'id')

  /* 파일 업로드는 두 종류 모두에서 쓴다 — 이미지 배너의 그림이자 영상 배너의
     포스터다. 그래서 미디어 유형을 보기 전에 먼저 처리한다. */
  const image = readFile(formData, 'imageFile')
  let imageUrl = readField(formData, 'imageUrl')

  if (image !== null) {
    const uploaded = await uploadPublicAsset(
      image,
      (ext) => `banners/${crypto.randomUUID()}.${ext}`,
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
    return actionFailure(
      'settings',
      '배너를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: isNew ? 'banner.create' : 'banner.update',
    targetTable: 'hero_banners',
    targetId: data.id,
    before,
    after: payload as Json,
  })

  await revalidateSite()
  return { message: '배너를 저장했습니다.' }
}

export async function deleteHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('settings', 'write')
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
    return actionFailure(
      'settings',
      '배너를 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'banner.delete',
    targetTable: 'hero_banners',
    targetId: id,
    before: before as Json,
  })

  await revalidateSite()
  return { message: `${before.title} 배너를 삭제했습니다.` }
}

/** 목록에서의 노출 토글. 값 하나만 바꾸므로 감사 로그도 그 한 줄만 남긴다. */
export async function toggleHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('settings', 'write')
  const id = readField(formData, 'id')
  const isActive = readField(formData, 'isActive') === 'true'
  const supabase = await createClient()
  const { error } = await supabase.from('hero_banners').update({ is_active: isActive }).eq('id', id)

  if (error !== null) {
    return actionFailure(
      'settings',
      '배너 노출 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'banner.toggle',
    targetTable: 'hero_banners',
    targetId: id,
    before: { is_active: !isActive },
    after: { is_active: isActive },
  })

  await revalidateSite()
  return { message: isActive ? '배너를 노출합니다.' : '배너를 숨겼습니다.' }
}

/** 순서 변경. 계산은 `movedOrder()` 가 하고 여기서는 바뀐 행만 기록한다. */
export async function moveHeroBannerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('settings', 'write')
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
      /* 앞선 행은 이미 저장됐다. 되돌릴 방법이 없으므로 어디까지 반영됐는지 확인하게 한다. */
      return actionFailure(
        'settings',
        '배너 순서를 바꾸지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요.',
        error,
      )
    }
  }

  await writeAuditLog(actor.id, {
    action: 'banner.reorder',
    targetTable: 'hero_banners',
    targetId: id,
    after: { order: ordered.map((banner) => banner.id) },
  })

  await revalidateSite()
  return { message: '배너 순서를 변경했습니다.' }
}
