'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { newsCategoryLabel } from '@/lib/constants/news'
import { newsTemplateSeed } from '@/lib/constants/news-templates'
import { sanitizePostHtml } from '@/lib/sanitize/post-html'
import { createClient } from '@/lib/supabase/server'
import { newsTemplateCategorySchema, newsTemplateSchema } from '@/lib/validation/news-templates'

import type { Json } from '@/types/database.types'

/**
 * 카테고리 템플릿 저장 · 기본값 복원.
 *
 * 두 액션 모두 스스로 `requirePermission('news', 'write')` 를 부른다 — 서버 액션은 UI 를
 * 거치지 않는 직접 POST 로도 호출된다. 쓰기는 세션 클라이언트로만 해서
 * `news_category_templates_admin_all` 정책이 다시 검사하게 둔다.
 *
 * **사용자 사이트 캐시는 태우지 않는다.** 템플릿은 글이 되기 전의 양식이고, 사용자
 * 사이트는 이 테이블을 읽지도 못한다(RLS 가 관리자만 연다). 남의 캐시를 이유 없이
 * 비우지 않는다는 규칙(`lib/revalidate.ts` 머리말)을 그대로 따른다.
 *
 * 본문은 뉴스 본문과 **같은 정제기**를 통과한다. 템플릿이 더 관대하면, 불러온 순간
 * 화면에 보이던 서식이 글 저장에서 사라진다.
 */

const TEMPLATES_PATH = '/news/templates'
const TABLE = 'news_category_templates'
const SNAPSHOT_COLUMNS = 'id, title_template, summary_template, body_template, is_active'

type TemplateSnapshot = {
  id: string
  title_template: string
  summary_template: string
  body_template: string
  is_active: boolean
}

type TemplateValues = {
  title_template: string
  summary_template: string
  body_template: string
  is_active: boolean
}

/**
 * 저장 뒤 되돌아갈 화면들.
 *
 * 목록·편집 화면은 물론 **새 글 작성 화면**도 함께 비운다 — 그 화면이 템플릿을 서버에서
 * 받아 폼에 싣기 때문에, 태우지 않으면 방금 고친 문안이 다음 글에 반영되지 않는다.
 */
function revalidateTemplates(category: string): void {
  revalidatePath(TEMPLATES_PATH)
  revalidatePath(`${TEMPLATES_PATH}/${category}`)
  revalidatePath('/news/new')
}

function toJson(values: TemplateValues | null): Json {
  return values === null ? null : { ...values }
}

async function readSnapshot(category: string): Promise<TemplateSnapshot | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from(TABLE)
    .select(SNAPSHOT_COLUMNS)
    .eq('category_key', category)
    .maybeSingle()

  return data
}

function snapshotValues(snapshot: TemplateSnapshot | null): TemplateValues | null {
  if (snapshot === null) {
    return null
  }

  return {
    title_template: snapshot.title_template,
    summary_template: snapshot.summary_template,
    body_template: snapshot.body_template,
    is_active: snapshot.is_active,
  }
}

/**
 * 카테고리당 한 행이므로 `upsert(onConflict: category_key)` 한 번으로 끝낸다.
 * 저장된 적 없는 카테고리(시드 이후 추가)도 같은 경로로 처음 행이 생긴다.
 */
async function upsertTemplate(
  category: string,
  values: TemplateValues,
  actorId: string,
): Promise<{ id: string | null; error: { message: string; code?: string } | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      { category_key: category, ...values, updated_by: actorId },
      { onConflict: 'category_key' },
    )
    .select('id')
    .single()

  return { id: data?.id ?? null, error }
}

export async function saveNewsTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('news', 'write')
  const parsed = newsTemplateSchema.safeParse({
    category: readField(formData, 'category'),
    title: readField(formData, 'title'),
    summary: readField(formData, 'summary'),
    body: readField(formData, 'body'),
    // 체크박스는 켜졌을 때만 전송된다. 없으면 꺼진 것이다.
    isActive: formData.get('isActive') !== null,
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { category, title, summary, isActive } = parsed.data
  const body = sanitizePostHtml(parsed.data.body)

  /* 입력이 있었는데 정제 후 빈 문자열이면 허용되지 않은 태그만 보냈다는 뜻이다.
     그대로 저장하면 운영자는 "본문을 넣었는데 템플릿이 비어 있다"를 겪는다. */
  if (body === '' && parsed.data.body !== '') {
    return { fieldErrors: { body: '저장할 수 있는 본문이 없습니다.' } }
  }

  const before = await readSnapshot(category)
  const values: TemplateValues = {
    title_template: title,
    summary_template: summary,
    body_template: body,
    is_active: isActive,
  }

  const { id, error } = await upsertTemplate(category, values, actor.id)

  if (error !== null) {
    return actionFailure(
      'news-templates',
      '템플릿을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'news_template.update',
    targetTable: TABLE,
    targetId: id ?? undefined,
    before: toJson(snapshotValues(before)),
    after: toJson({ ...values }),
  })

  revalidateTemplates(category)

  return { message: `${newsCategoryLabel(category)} 템플릿을 저장했습니다.` }
}

/**
 * 기본값 복원.
 *
 * 되돌리는 것은 **문안 셋(제목 · 요약 · 본문)뿐**이다. 활성 여부는 "이 카테고리에서 템플릿을
 * 쓸 것인가"라는 별개의 결정이라, 문구를 되돌렸다고 꺼 둔 템플릿이 되살아나면 안 된다.
 *
 * 원본은 코드 상수(`lib/constants/news-templates.ts`)다 — 마이그레이션 시드와 같은
 * 생성기에서 나온 같은 문자열이라, 되돌린 결과가 첫 배포 상태와 정확히 같다.
 */
export async function resetNewsTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('news', 'write')
  const parsed = newsTemplateCategorySchema.safeParse({ category: readField(formData, 'category') })

  if (!parsed.success) {
    return { formError: '카테고리를 찾을 수 없습니다.' }
  }

  const { category } = parsed.data
  const seed = newsTemplateSeed(category)
  const before = await readSnapshot(category)
  const values: TemplateValues = {
    title_template: seed.title,
    summary_template: seed.summary,
    body_template: seed.body,
    is_active: before?.is_active ?? true,
  }

  const { id, error } = await upsertTemplate(category, values, actor.id)

  if (error !== null) {
    return actionFailure(
      'news-templates',
      '기본값으로 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'news_template.reset',
    targetTable: TABLE,
    targetId: id ?? undefined,
    before: toJson(snapshotValues(before)),
    after: toJson({ ...values }),
  })

  revalidateTemplates(category)

  return { message: `${newsCategoryLabel(category)} 템플릿을 기본값으로 되돌렸습니다.` }
}
