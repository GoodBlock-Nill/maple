'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import {
  isLegalSlug,
  LEGAL_CLIENT_CACHE_TAG,
  legalDocumentLabel,
  type LegalSlug,
} from '@/lib/constants/legal'
import { revalidateClient } from '@/lib/revalidate'
import { sanitizeLegalHtml } from '@/lib/sanitize/legal-html'
import { createClient } from '@/lib/supabase/server'
import {
  legalFormSchema,
  resolveLegalPublishPlan,
  type LegalFormInput,
} from '@/lib/validation/legal'

import type { Json } from '@/types/database.types'

/**
 * 약관 개정본 저장 · 발행 · 초안 삭제.
 *
 * 모든 액션이 스스로 `requirePermission('legal', 'write')` 을 부른다 — 서버 액션은 UI 를
 * 거치지 않는 직접 POST 로 호출될 수 있다. 쓰기는 세션 클라이언트로 해서
 * RLS(`legal_*_admin`)가 다시 검사하게 둔다.
 *
 * **발행본은 고치지 않고 쌓는다.** 이미 발행한 개정본의 본문을 덮어쓰면 "그때 그
 * 약관"이 사라진다. 화면도 발행본을 열면 "이 버전으로 새 초안 만들기"만 권한다.
 */

const LEGAL_PATH = '/legal'
const SAVE_FAILURE = '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'

type LegalSnapshot = {
  slug: string
  version: string
  effectiveDate: string
  isPublished: string
}

function toJson(snapshot: LegalSnapshot): Json {
  return { ...snapshot }
}

function snapshotOf(slug: LegalSlug, input: LegalFormInput, isPublished: boolean): LegalSnapshot {
  return {
    slug,
    version: input.version,
    effectiveDate: input.effectiveDate,
    isPublished: isPublished ? 'true' : 'false',
  }
}

/**
 * 문서 행을 찾고, 없으면 만든다.
 *
 * 시드 마이그레이션이 세 문서를 심어 두지만, 새 환경(로컬 복제본 등)에서 시드가
 * 아직 돌지 않았다고 편집 화면이 막히면 곤란하다. 슬러그는 DB 체크 제약이 다시
 * 검사하므로 임의 문서가 생길 수는 없다.
 */
async function ensureDocumentId(slug: LegalSlug): Promise<string | null> {
  const supabase = await createClient()
  const query = supabase.from('legal_documents').select('id').eq('slug', slug)
  const { data } = await query.maybeSingle()

  if (data !== null && data !== undefined) {
    return data.id
  }

  const { data: created, error } = await supabase
    .from('legal_documents')
    .insert({ slug, title: legalDocumentLabel(slug) })
    .select('id')
    .single()

  if (error !== null) {
    console.error('[legal] 문서 생성 실패', slug, error.message)

    return null
  }

  return created.id
}

/** 발행·예약 저장 뒤에만 사용자 사이트 캐시를 태운다(임시저장은 독자에게 보이지 않는다). */
async function revalidateLegalClient(): Promise<void> {
  await revalidateClient([LEGAL_CLIENT_CACHE_TAG])
}

export async function saveLegalVersionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('legal', 'write')
  const slug = readField(formData, 'slug')

  if (!isLegalSlug(slug)) {
    return { formError: '알 수 없는 문서입니다.' }
  }

  const parsed = legalFormSchema.safeParse({
    version: readField(formData, 'version'),
    effectiveDate: readField(formData, 'effectiveDate'),
    summary: readField(formData, 'summary'),
    content: readField(formData, 'content'),
    publishMode: readField(formData, 'publishMode'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const content = sanitizeLegalHtml(parsed.data.content)

  /* 정제 후 빈 문자열 = 허용되지 않은 태그만 보냈다는 뜻이다. 그대로 두면 본문
     없는 약관이 발행된다. */
  if (content === '') {
    return { fieldErrors: { content: '저장할 수 있는 본문이 없습니다.' } }
  }

  const documentId = await ensureDocumentId(slug)

  if (documentId === null) {
    return { formError: SAVE_FAILURE }
  }

  return writeVersion(actor.id, slug, documentId, parsed.data, content, readField(formData, 'id'))
}

async function writeVersion(
  actorId: string,
  slug: LegalSlug,
  documentId: string,
  input: LegalFormInput,
  content: string,
  versionId: string,
): Promise<FormState> {
  const supabase = await createClient()
  const plan = resolveLegalPublishPlan(input.publishMode)
  const columns = {
    version: input.version,
    effective_date: input.effectiveDate,
    content_html: content,
    summary: input.summary === '' ? null : input.summary,
    is_published: plan.isPublished,
    published_at: plan.publishedAt,
  }

  if (versionId !== '') {
    const { data: current } = await supabase
      .from('legal_document_versions')
      .select('id, version, effective_date, is_published')
      .eq('id', versionId)
      .eq('document_id', documentId)
      .maybeSingle()

    if (current === null || current === undefined) {
      return { formError: '개정본을 찾을 수 없습니다.' }
    }

    /* 이미 발행한 개정본은 문안을 덮어쓸 수 없다. 되돌릴 수 없는 기록이라, 실수로
       고치는 경로 자체를 열지 않는다. */
    if (current.is_published) {
      return { formError: '이미 발행한 개정본은 고칠 수 없습니다. 새 버전을 만들어 주세요.' }
    }

    const { error } = await supabase
      .from('legal_document_versions')
      .update(columns)
      .eq('id', versionId)

    if (error !== null) {
      console.error('[legal] 수정 실패', error.message)

      return { formError: duplicateMessage(error.message) }
    }

    await writeAuditLog(actorId, {
      action: plan.isPublished ? 'legal.publish' : 'legal.update',
      targetTable: 'legal_document_versions',
      targetId: versionId,
      before: toJson({
        slug,
        version: current.version,
        effectiveDate: current.effective_date,
        isPublished: 'false',
      }),
      after: toJson(snapshotOf(slug, input, plan.isPublished)),
    })

    return finish(slug, plan.isPublished, versionId)
  }

  const { data: created, error } = await supabase
    .from('legal_document_versions')
    .insert({ ...columns, document_id: documentId, created_by: actorId })
    .select('id')
    .single()

  if (error !== null) {
    console.error('[legal] 작성 실패', error.message)

    return { formError: duplicateMessage(error.message) }
  }

  await writeAuditLog(actorId, {
    action: plan.isPublished ? 'legal.publish' : 'legal.create',
    targetTable: 'legal_document_versions',
    targetId: created.id,
    after: toJson(snapshotOf(slug, input, plan.isPublished)),
  })

  return finish(slug, plan.isPublished, created.id)
}

/** 유니크 위반(23505)은 운영자가 고칠 수 있는 실수다. 원문 대신 할 일을 알려 준다. */
function duplicateMessage(message: string): string {
  return message.includes('unique_version') ? '이미 있는 버전 번호입니다.' : SAVE_FAILURE
}

async function finish(
  slug: LegalSlug,
  isPublished: boolean,
  versionId: string,
): Promise<FormState> {
  revalidatePath(LEGAL_PATH)
  revalidatePath(`${LEGAL_PATH}/${slug}`)

  if (isPublished) {
    await revalidateLegalClient()
  }

  // redirect() 는 예외를 던져 이후 코드를 건너뛴다. 재검증을 반드시 앞에 둔다.
  redirect(`${LEGAL_PATH}/${slug}?version=${versionId}&saved=1`)
}

/**
 * 임시저장본 삭제.
 *
 * 발행본은 지우지 않는다 — 개정 이력이 곧 법적 근거다. 화면에도 임시저장본에만
 * 버튼이 붙지만, 액션은 직접 POST 로도 불릴 수 있으므로 여기서 다시 막는다.
 */
export async function deleteLegalDraftAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('legal', 'write')
  const slug = readField(formData, 'slug')
  const versionId = readField(formData, 'id')

  if (!isLegalSlug(slug) || versionId === '') {
    return { formError: '알 수 없는 요청입니다.' }
  }

  const supabase = await createClient()
  const { data: current } = await supabase
    .from('legal_document_versions')
    .select('id, version, effective_date, is_published')
    .eq('id', versionId)
    .maybeSingle()

  if (current === null || current === undefined) {
    return { formError: '개정본을 찾을 수 없습니다.' }
  }

  if (current.is_published) {
    return { formError: '발행한 개정본은 삭제할 수 없습니다.' }
  }

  const { error } = await supabase.from('legal_document_versions').delete().eq('id', versionId)

  if (error !== null) {
    console.error('[legal] 삭제 실패', error.message)

    return { formError: '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  await writeAuditLog(actor.id, {
    action: 'legal.delete_draft',
    targetTable: 'legal_document_versions',
    targetId: versionId,
    before: toJson({
      slug,
      version: current.version,
      effectiveDate: current.effective_date,
      isPublished: 'false',
    }),
  })

  revalidatePath(LEGAL_PATH)
  revalidatePath(`${LEGAL_PATH}/${slug}`)
  redirect(`${LEGAL_PATH}/${slug}`)
}
