'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { CATEGORY_NOT_FOUND, revalidateCategories } from '@/lib/actions/inquiry-category-shared'
import { nullableArg } from '@/lib/actions/rpc-args'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { getNextInquiryCategorySortOrder } from '@/lib/data/inquiry-categories'
import { createClient } from '@/lib/supabase/server'
import {
  inquiryCategorySchema,
  toCategoryKey,
  toNullableText,
} from '@/lib/validation/inquiry-categories'

/**
 * 문의 카테고리 등록 · 수정 · 삭제.
 *
 * 활성 토글과 정렬 저장은 `inquiry-category-order-actions.ts` 가 갖는다(이 파일의
 * 300줄 상한). 가드·감사·무효화 규약은 두 파일이 똑같이 따른다.
 *
 * 모든 액션이 스스로 `requirePermission('inquiries', 'write')` 을 부르고(직접 POST 방어),
 * 상태를 바꾼 뒤 감사 로그를 남긴다. 쓰기는 세션 클라이언트로만 한다 —
 * `inquiry_categories_admin_all` 정책이 다시 검사하게 두어야 권한 버그가 조용히 통과하지 않는다.
 *
 * **라벨 변경은 과거 문의를 데리고 간다.** `inquiries.category` 가 라벨 문자열이라,
 * 이름만 바꾸면 그 라벨로 접수된 문의가 목록 필터에서 사라진다. 그래서 수정은
 * `public.update_inquiry_category()` RPC 한 번으로 끝낸다 — 카테고리 행과 과거 문의의
 * 재라벨링이 한 트랜잭션에서 함께 성공하거나 함께 실패한다(마이그레이션 20260910000500).
 *
 * **종류 변경도 과거 문의를 데리고 간다.** 카테고리가 곧 문의의 창구이므로, 같은 RPC
 * 가 같은 트랜잭션에서 `inquiries.kind` 까지 옮긴다(마이그레이션 20260914000100).
 */

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
    /* 종류는 셀렉트 값 그대로다. 세 값 밖이면 스키마가 막는다 — RPC 는 모르는 값을
       22023 으로 떨어뜨리고, 그 메시지는 운영자가 읽을 수 있는 말이 아니다. */
    kind: readField(formData, 'kind'),
    isActive: formData.get('isActive') !== null,
  }
}

/**
 * 수정 완료 안내.
 *
 * RPC 는 라벨·종류 중 하나라도 바뀌면 옮긴 문의 수를 돌려준다. 무엇 때문에 옮겨졌는지
 * 말해 주지 않으면 운영자는 "이름만 바꿨는데 왜 N건이 움직였나"를 알 수 없다.
 */
function updateMessage(moved: number, labelChanged: boolean, kindChanged: boolean): string {
  if (moved === 0) {
    return '카테고리를 수정했습니다.'
  }

  if (labelChanged && kindChanged) {
    return `카테고리를 수정했습니다. 기존 문의 ${moved}건의 분류와 종류도 함께 바꿨습니다.`
  }

  if (kindChanged) {
    return `카테고리를 수정했습니다. 이 카테고리로 접수된 문의 ${moved}건의 종류도 함께 바꿨습니다.`
  }

  return `카테고리를 수정했습니다. 기존 문의 ${moved}건의 분류도 새 이름으로 바꿨습니다.`
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

  const { label, description, prefill, subtypes, kind, isActive } = parsed.data
  const supabase = await createClient()
  /* 새 카테고리는 **그 창구의** 맨 뒤에 붙인다. 순번은 kind 안에서만 뜻이 있고,
     중간에 끼우면 기존 순서가 통째로 밀린다. */
  const sortOrder = await getNextInquiryCategorySortOrder(kind)
  const key = toCategoryKey(label)

  const { data, error } = await supabase
    .from('inquiry_categories')
    .insert({
      key,
      label,
      description: toNullableText(description),
      prefill,
      subtypes,
      kind,
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
    after: { key, label, description, subtypes, kind, is_active: isActive, sort_order: sortOrder },
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
    return { formError: CATEGORY_NOT_FOUND }
  }

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { label, description, prefill, subtypes, kind, isActive } = parsed.data
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('inquiry_categories')
    .select('key, label, description, prefill, subtypes, sort_order, is_active, kind')
    .eq('id', categoryId)
    .maybeSingle()

  if (before === null) {
    return { formError: CATEGORY_NOT_FOUND }
  }

  /* key 는 라벨이 바뀌어도 유지한다 — 코드·시드가 가리키는 안정 식별자이기 때문이다.
     자동 생성은 등록할 때 한 번뿐이다.

     RPC 는 9인자다. 인자를 빼먹으면 함수를 찾지 못하고(PGRST202), kind 에 null 을
     넣으면 22023 으로 떨어진다 — 스키마가 세 값만 통과시키는 이유다. */
  const { data: moved, error } = await supabase.rpc('update_inquiry_category', {
    p_id: categoryId,
    p_key: before.key,
    p_label: label,
    p_description: nullableArg(toNullableText(description)),
    p_prefill: prefill,
    p_sort_order: before.sort_order,
    p_is_active: isActive,
    p_subtypes: subtypes,
    p_kind: kind,
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
      kind,
      is_active: isActive,
      /* 이름·종류가 바뀌면서 함께 옮겨 간 과거 문의 수. 나중에 "왜 이 문의의 분류가
         달라졌나"를 되짚는 유일한 근거다. */
      relabelled_inquiries: relabelled,
    },
  })

  await revalidateCategories()

  return { message: updateMessage(relabelled, before.label !== label, before.kind !== kind) }
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
    return { formError: CATEGORY_NOT_FOUND }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('inquiry_categories')
    .select('key, label, description, prefill, subtypes, kind, sort_order, is_active')
    .eq('id', categoryId)
    .maybeSingle()

  if (before === null) {
    return { formError: CATEGORY_NOT_FOUND }
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
