'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { getNextInquiryCategorySortOrder } from '@/lib/data/inquiry-categories'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { createClient } from '@/lib/supabase/server'
import {
  inquiryCategoryReorderSchema,
  inquiryCategorySchema,
  toCategoryKey,
  toNullableText,
} from '@/lib/validation/inquiry-categories'

/**
 * 문의 카테고리 CRUD · 활성 토글 · 정렬 저장.
 *
 * 모든 액션이 스스로 `requirePermission('inquiries', 'write')` 을 부르고(직접 POST 방어),
 * 상태를 바꾼 뒤 감사 로그를 남긴다. 쓰기는 세션 클라이언트로만 한다 —
 * `inquiry_categories_admin_all` 정책이 다시 검사하게 두어야 권한 버그가 조용히 통과하지 않는다.
 *
 * **라벨 변경은 과거 문의를 데리고 간다.** `inquiries.category` 가 라벨 문자열이라,
 * 이름만 바꾸면 그 라벨로 접수된 문의가 목록 필터에서 사라진다. 그래서 수정은
 * `public.update_inquiry_category()` RPC 한 번으로 끝낸다 — 카테고리 행과 과거 문의의
 * 재라벨링이 한 트랜잭션에서 함께 성공하거나 함께 실패한다(마이그레이션 20260910000500).
 */

const CATEGORIES_PATH = '/inquiries/categories'

const NOT_FOUND = '카테고리를 찾을 수 없습니다.'

/**
 * 사용자 사이트의 문의 폼은 카테고리를 `unstable_cache`(300초)로 읽는다. 저장 뒤
 * 태그를 태우지 않으면 새 프리필이 최대 5분간 반영되지 않는다.
 */
async function revalidateCategories(): Promise<void> {
  revalidatePath(CATEGORIES_PATH)
  revalidatePath('/inquiries')
  await revalidateClient([CLIENT_CACHE_TAGS.inquiryCategories])
}

/**
 * RPC 인자로 넘기는 nullable 텍스트.
 *
 * 타입 생성기는 SQL 함수의 `text` 인자를 non-null 로 뽑는다(기본값·NULL 허용 여부를
 * 표현하지 않는다). 함수 본문은 null 을 그대로 받아 `description` 에 저장하므로,
 * 여기서만 좁혀 준다 — '' 로 대신 저장하면 "설명 없음"이 두 벌(null · '')이 된다.
 */
function nullableArg(value: string | null): string {
  return value as unknown as string
}

/**
 * 폼 → 스키마 입력. 체크박스는 값이 없으면 아예 오지 않는다.
 *
 * 세부 유형은 항목마다 같은 이름(`subtypes`)으로 실려 오므로 `getAll` 로 한 번에
 * 받는다 — 순서가 곧 사용자 폼 셀렉트의 순서다(화면이 보여 준 대로 저장된다).
 */
function readCategoryInput(formData: FormData) {
  return {
    label: readField(formData, 'label'),
    description: readField(formData, 'description'),
    prefill: readField(formData, 'prefill'),
    subtypes: formData.getAll('subtypes').map((value) => (typeof value === 'string' ? value : '')),
    isActive: formData.get('isActive') !== null,
  }
}

export async function createInquiryCategoryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryCategorySchema.safeParse(readCategoryInput(formData))

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { label, description, prefill, subtypes, isActive } = parsed.data
  const supabase = await createClient()
  // 새 카테고리는 맨 뒤에 붙인다. 중간에 끼우면 기존 순서가 통째로 밀린다.
  const sortOrder = await getNextInquiryCategorySortOrder()
  const key = toCategoryKey(label)

  const { data, error } = await supabase
    .from('inquiry_categories')
    .insert({
      key,
      label,
      description: toNullableText(description),
      prefill,
      subtypes,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .select('id')
    .single()

  if (error !== null) {
    /* 23505 는 라벨(또는 key) 중복이다. 운영자가 스스로 고칠 수 있는 실패라
       "잠시 후 다시"가 아니라 무엇이 문제인지 그대로 알려 준다. */
    if (error.code === '23505') {
      return { fieldErrors: { label: '이미 같은 이름의 카테고리가 있습니다.' } }
    }

    return actionFailure(
      'inquiry-categories',
      '카테고리를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_category.create',
    targetTable: 'inquiry_categories',
    targetId: data.id,
    after: { key, label, description, subtypes, is_active: isActive, sort_order: sortOrder },
  })

  await revalidateCategories()

  return { message: '카테고리를 등록했습니다.' }
}

export async function updateInquiryCategoryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const categoryId = readField(formData, 'categoryId')
  const parsed = inquiryCategorySchema.safeParse(readCategoryInput(formData))

  if (categoryId === '') {
    return { formError: NOT_FOUND }
  }

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { label, description, prefill, subtypes, isActive } = parsed.data
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('inquiry_categories')
    .select('key, label, description, prefill, subtypes, sort_order, is_active')
    .eq('id', categoryId)
    .maybeSingle()

  if (before === null) {
    return { formError: NOT_FOUND }
  }

  /* key 는 라벨이 바뀌어도 유지한다 — 코드·시드가 가리키는 안정 식별자이기 때문이다.
     자동 생성은 등록할 때 한 번뿐이다. */
  const { data: moved, error } = await supabase.rpc('update_inquiry_category', {
    p_id: categoryId,
    p_key: before.key,
    p_label: label,
    p_description: nullableArg(toNullableText(description)),
    p_prefill: prefill,
    p_sort_order: before.sort_order,
    p_is_active: isActive,
    p_subtypes: subtypes,
  })

  if (error !== null) {
    if (error.code === '23505') {
      return { fieldErrors: { label: '이미 같은 이름의 카테고리가 있습니다.' } }
    }

    return actionFailure(
      'inquiry-categories',
      '카테고리를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  const relabelled = moved ?? 0

  await writeAuditLog(actor.id, {
    action: 'inquiry_category.update',
    targetTable: 'inquiry_categories',
    targetId: categoryId,
    before,
    after: {
      key: before.key,
      label,
      description,
      prefill,
      subtypes,
      is_active: isActive,
      /* 이름이 바뀌면서 함께 옮겨 간 과거 문의 수. 나중에 "왜 이 문의의 분류가
         달라졌나"를 되짚는 유일한 근거다. */
      relabelled_inquiries: relabelled,
    },
  })

  await revalidateCategories()

  return {
    message:
      relabelled > 0
        ? `카테고리를 수정했습니다. 기존 문의 ${relabelled}건의 분류도 새 이름으로 바꿨습니다.`
        : '카테고리를 수정했습니다.',
  }
}

/**
 * 삭제.
 *
 * 이 라벨로 접수된 문의가 하나라도 있으면 지우지 않는다 — 지우는 순간 그 문의들의
 * 분류는 어디에도 정의되지 않은 문자열이 된다. 화면도 같은 규칙으로 버튼 대신
 * "비활성화"를 권하고, 여기서 한 번 더 막는 이유는 직접 POST 때문이다.
 */
export async function deleteInquiryCategoryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const categoryId = readField(formData, 'categoryId')

  if (categoryId === '') {
    return { formError: NOT_FOUND }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('inquiry_categories')
    .select('key, label, description, prefill, subtypes, sort_order, is_active')
    .eq('id', categoryId)
    .maybeSingle()

  if (before === null) {
    return { formError: NOT_FOUND }
  }

  const { count, error: countError } = await supabase
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('category', before.label)

  if (countError !== null) {
    return actionFailure(
      'inquiry-categories',
      '문의 수를 확인하지 못해 삭제를 중단했습니다. 잠시 후 다시 시도해 주세요.',
      countError,
    )
  }

  if ((count ?? 0) > 0) {
    return {
      formError: `이 카테고리로 접수된 문의가 ${count}건 있습니다. 삭제 대신 비활성화해 주세요.`,
    }
  }

  const { error } = await supabase.from('inquiry_categories').delete().eq('id', categoryId)

  if (error !== null) {
    return actionFailure(
      'inquiry-categories',
      '카테고리를 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_category.delete',
    targetTable: 'inquiry_categories',
    targetId: categoryId,
    before,
  })

  await revalidateCategories()

  return { message: '카테고리를 삭제했습니다.' }
}

/** 활성/비활성 토글. 비활성 카테고리는 사용자 폼에서 즉시 사라진다. */
export async function toggleInquiryCategoryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const categoryId = readField(formData, 'categoryId')
  const nextActive = readField(formData, 'isActive') === 'true'

  if (categoryId === '') {
    return { formError: NOT_FOUND }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('inquiry_categories')
    .update({ is_active: nextActive })
    .eq('id', categoryId)

  if (error !== null) {
    return actionFailure(
      'inquiry-categories',
      '카테고리 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_category.update',
    targetTable: 'inquiry_categories',
    targetId: categoryId,
    before: { is_active: !nextActive },
    after: { is_active: nextActive },
  })

  await revalidateCategories()

  return { message: nextActive ? '카테고리를 활성화했습니다.' : '카테고리를 비활성화했습니다.' }
}

/**
 * 순서 저장.
 *
 * 화면이 보여 준 순서를 그대로 0..n-1 로 다시 쓴다. 두 행의 값만 맞바꾸면 기존
 * 데이터에 중복·구멍이 있을 때 결과가 화면과 달라진다(FAQ 와 같은 규칙).
 */
export async function reorderInquiryCategoriesAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryCategoryReorderSchema.safeParse({
    ids: readField(formData, 'ids').split(',').filter(Boolean),
  })

  if (!parsed.success) {
    return { formError: '정렬 정보를 읽지 못했습니다.' }
  }

  const { ids } = parsed.data
  const supabase = await createClient()

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase.from('inquiry_categories').update({ sort_order: index }).eq('id', id),
    ),
  )

  const failed = results.find((result) => result.error !== null)

  if (failed?.error != null) {
    /* 행마다 UPDATE 를 던지므로 앞쪽 몇 건은 이미 저장됐을 수 있다. */
    return actionFailure(
      'inquiry-categories',
      '순서를 저장하지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요.',
      failed.error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_category.reorder',
    targetTable: 'inquiry_categories',
    // 대상이 여러 행이라 targetId 는 비운다. 무엇이 어떤 순서가 됐는지는 after 에 남는다.
    after: { ids: [...ids] },
  })

  await revalidateCategories()

  return { message: '순서를 저장했습니다.' }
}
