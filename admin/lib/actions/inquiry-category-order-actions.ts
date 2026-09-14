'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, type FormState } from '@/lib/actions/form-state'
import { CATEGORY_NOT_FOUND, revalidateCategories } from '@/lib/actions/inquiry-category-shared'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { inquiryCategoryReorderSchema } from '@/lib/validation/inquiry-categories'

/**
 * 문의 카테고리의 **목록 상태** — 활성 토글 · 정렬 저장.
 *
 * 등록·수정·삭제(`inquiry-category-actions.ts`)와 파일을 가른 것은 길이 때문이지만,
 * 경계 자체는 뜻이 있다: 이쪽 둘은 카테고리의 내용을 건드리지 않고 **사용자 폼에서
 * 어떻게 보이는가**만 바꾼다(보이는가 · 어느 순서로).
 *
 * 두 액션 모두 스스로 `requirePermission('inquiries', 'write')` 를 부르고(직접 POST
 * 방어), 세션 클라이언트로만 쓴다 — `inquiry_categories_admin_all` 정책이 다시
 * 검사하게 두어야 권한 버그가 조용히 통과하지 않는다.
 */

/** 활성/비활성 토글. 비활성 카테고리는 사용자 폼에서 즉시 사라진다. */
export async function toggleInquiryCategoryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const categoryId = readField(formData, 'categoryId')
  const nextActive = readField(formData, 'isActive') === 'true'

  if (categoryId === '') {
    return { formError: CATEGORY_NOT_FOUND }
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
 *
 * 오는 id 는 **한 창구(kind)의 것뿐**이다 — `sort_order` 가 kind 안에서의 순서라
 * (마이그레이션 20260914000100) 세 섹션을 한 번에 다시 매기면 서로의 순번을 덮어쓴다.
 */
export async function reorderInquiryCategoriesAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryCategoryReorderSchema.safeParse({
    ids: readField(formData, 'ids').split(',').filter(Boolean),
    kind: readField(formData, 'kind'),
  })

  if (!parsed.success) {
    return { formError: '정렬 정보를 읽지 못했습니다.' }
  }

  const { ids, kind } = parsed.data
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
    after: { kind, ids: [...ids] },
  })

  await revalidateCategories()

  return { message: '순서를 저장했습니다.' }
}
