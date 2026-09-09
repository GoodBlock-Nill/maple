'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { getNextFaqSortOrder } from '@/lib/data/faqs'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { createClient } from '@/lib/supabase/server'
import { faqReorderSchema, faqSchema } from '@/lib/validation/faqs'

/**
 * FAQ CRUD · 발행 토글 · 정렬 저장.
 *
 * 모든 액션이 스스로 `requirePermission('faqs', 'write')` 을 부르고(직접 POST 방어), 상태를 바꾼 뒤
 * 감사 로그를 남긴다. 쓰기는 세션 클라이언트로만 한다 — `faqs_admin_all` 정책이
 * 다시 검사하게 두어야 권한 버그가 조용히 통과하지 않는다.
 */

const FAQS_PATH = '/faqs'

/**
 * FAQ 는 사용자 사이트에서 `unstable_cache`(300초)로 읽는다. 저장 뒤 태그를 태우지
 * 않으면 발행·수정이 최대 5분간 반영되지 않는다. 사용자 사이트는 별도 배포라
 * `revalidateTag()` 가 닿지 않아 HTTP 로 부른다(lib/revalidate.ts).
 */
async function revalidateFaqs(): Promise<void> {
  revalidatePath(FAQS_PATH)
  await revalidateClient([CLIENT_CACHE_TAGS.faqs])
}

/** 폼 → 스키마 입력. 체크박스는 값이 없으면 아예 오지 않는다. */
function readFaqInput(formData: FormData) {
  return {
    category: readField(formData, 'category'),
    question: readField(formData, 'question'),
    answer: readField(formData, 'answer'),
    isPublished: formData.get('isPublished') !== null,
  }
}

export async function createFaqAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('faqs', 'write')
  const parsed = faqSchema.safeParse(readFaqInput(formData))

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { category, question, answer, isPublished } = parsed.data
  const supabase = await createClient()
  // 새 항목은 카테고리 맨 뒤에 붙인다. 중간에 끼우면 기존 순서가 통째로 밀린다.
  const sortOrder = await getNextFaqSortOrder(category)

  const { data, error } = await supabase
    .from('faqs')
    .insert({
      category,
      question,
      answer,
      sort_order: sortOrder,
      is_published: isPublished,
    })
    .select('id')
    .single()

  if (error !== null) {
    return actionFailure('faqs', 'FAQ를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', error)
  }

  await writeAuditLog(actor.id, {
    action: 'faq.create',
    targetTable: 'faqs',
    targetId: data.id,
    after: { category, question, is_published: isPublished, sort_order: sortOrder },
  })

  await revalidateFaqs()

  return { message: 'FAQ를 등록했습니다.' }
}

export async function updateFaqAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('faqs', 'write')
  const faqId = readField(formData, 'faqId')
  const parsed = faqSchema.safeParse(readFaqInput(formData))

  if (faqId === '') {
    return { formError: '대상을 찾을 수 없습니다.' }
  }

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { category, question, answer, isPublished } = parsed.data
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('faqs')
    .select('category, question, answer, is_published')
    .eq('id', faqId)
    .maybeSingle()

  if (before === null) {
    return { formError: 'FAQ를 찾을 수 없습니다.' }
  }

  /* 카테고리를 옮기면 옮겨 간 쪽의 맨 뒤로 보낸다. 원래 순번을 그대로 두면
     새 카테고리에서 중복 순번이 되어 정렬이 뒤섞인다. */
  const sortOrderPatch =
    before.category === category ? {} : { sort_order: await getNextFaqSortOrder(category) }

  const { error } = await supabase
    .from('faqs')
    .update({ category, question, answer, is_published: isPublished, ...sortOrderPatch })
    .eq('id', faqId)

  if (error !== null) {
    return actionFailure('faqs', 'FAQ를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.', error)
  }

  await writeAuditLog(actor.id, {
    action: 'faq.update',
    targetTable: 'faqs',
    targetId: faqId,
    before,
    after: { category, question, answer, is_published: isPublished },
  })

  await revalidateFaqs()

  return { message: 'FAQ를 수정했습니다.' }
}

export async function deleteFaqAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('faqs', 'write')
  const faqId = readField(formData, 'faqId')

  if (faqId === '') {
    return { formError: '대상을 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('faqs')
    .select('category, question, answer, is_published, sort_order')
    .eq('id', faqId)
    .maybeSingle()

  if (before === null) {
    return { formError: 'FAQ를 찾을 수 없습니다.' }
  }

  const { error } = await supabase.from('faqs').delete().eq('id', faqId)

  if (error !== null) {
    return actionFailure(
      'faqs',
      'FAQ를 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  /* 남은 항목의 sort_order 는 다시 매기지 않는다. 구멍(0,1,3)이 있어도 표시 순서는
     같고, 정렬 저장이 한 번 돌면 0부터 정리된다. */
  await writeAuditLog(actor.id, {
    action: 'faq.delete',
    targetTable: 'faqs',
    targetId: faqId,
    before,
  })

  await revalidateFaqs()

  return { message: 'FAQ를 삭제했습니다.' }
}

/** 발행/미발행 토글. 미발행은 사용자 사이트에서 즉시 사라진다(`faqs_select_published`). */
export async function toggleFaqPublishAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('faqs', 'write')
  const faqId = readField(formData, 'faqId')
  const nextPublished = readField(formData, 'isPublished') === 'true'

  if (faqId === '') {
    return { formError: '대상을 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('faqs')
    .update({ is_published: nextPublished })
    .eq('id', faqId)

  if (error !== null) {
    return actionFailure(
      'faqs',
      'FAQ 발행 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'faq.publish',
    targetTable: 'faqs',
    targetId: faqId,
    before: { is_published: !nextPublished },
    after: { is_published: nextPublished },
  })

  await revalidateFaqs()

  return { message: nextPublished ? 'FAQ를 발행했습니다.' : 'FAQ를 숨겼습니다.' }
}

/**
 * 카테고리 안의 순서 저장.
 *
 * 화면이 보여 준 순서를 그대로 0..n-1 로 다시 쓴다. 두 행의 값만 맞바꾸면 기존
 * 데이터에 중복·구멍이 있을 때 결과가 화면과 달라진다.
 *
 * `id` 와 함께 `category` 로도 조건을 건다 — 다른 카테고리의 id 를 섞어 보내도
 * 그 행의 순번이 바뀌지 않는다.
 */
export async function reorderFaqsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('faqs', 'write')
  const parsed = faqReorderSchema.safeParse({
    category: readField(formData, 'category'),
    ids: readField(formData, 'ids').split(',').filter(Boolean),
  })

  if (!parsed.success) {
    return { formError: '정렬 정보를 읽지 못했습니다.' }
  }

  const { category, ids } = parsed.data
  const supabase = await createClient()

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase.from('faqs').update({ sort_order: index }).eq('id', id).eq('category', category),
    ),
  )

  const failed = results.find((result) => result.error !== null)

  if (failed?.error != null) {
    /* 행마다 UPDATE 를 던지므로 앞쪽 몇 건은 이미 저장됐을 수 있다. */
    return actionFailure(
      'faqs',
      '순서를 저장하지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요.',
      failed.error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'faq.reorder',
    targetTable: 'faqs',
    // 대상이 여러 행이라 targetId 는 비운다. 무엇이 어떤 순서가 됐는지는 after 에 남는다.
    after: { category, ids: [...ids] },
  })

  await revalidateFaqs()

  return { message: '순서를 저장했습니다.' }
}
