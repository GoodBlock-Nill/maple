import 'server-only'

import { LEGAL_DOCUMENTS, type LegalSlug } from '@/lib/constants/legal'
import { createClient } from '@/lib/supabase/server'
import { selectCurrentLegalVersion } from '@/lib/validation/legal'

/**
 * 약관 조회 계층 (`legal_documents` + `legal_document_versions`).
 *
 * 세션 클라이언트로 읽는다 — 서비스 롤을 쓰면 `legal_versions_select_admin` 정책이
 * 건너뛰어져 "권한이 사라져도 임시저장본이 계속 보이는" 상태가 된다. 관리자는
 * 임시저장·예약·지난 버전을 모두 봐야 하고, 그 권한의 근거는 정책 하나뿐이다.
 *
 * 문자열을 이어 붙이면(`'a' + 'b'`) 타입이 그냥 `string` 이 되어 supabase-js 가 행
 * 타입을 추론하지 못한다. 길더라도 리터럴 한 줄로 둔다.
 */
const VERSION_COLUMNS =
  'id, version, effective_date, content_html, summary, is_published, published_at, created_at, created_by'

export type LegalVersion = {
  id: string
  version: string
  /** `2026-09-18`. */
  effectiveDate: string
  contentHtml: string
  summary: string
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  createdBy: string | null
}

export type LegalDocumentDetail = {
  id: string
  slug: LegalSlug
  title: string
  updatedAt: string
  /** 최신 생성순. 목록·이력 화면이 이 순서를 그대로 쓴다. */
  versions: readonly LegalVersion[]
}

export type LegalDocumentSummary = {
  slug: LegalSlug
  label: string
  /** 문서 행이 아직 없으면 null(시드 전). 화면은 "미등록"으로 그린다. */
  title: string | null
  current: LegalVersion | null
  /** 가장 최근에 만든 개정본. "마지막 수정"의 근거다. */
  latest: LegalVersion | null
  versionCount: number
}

type VersionRow = {
  id: string
  version: string
  effective_date: string
  content_html: string
  summary: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
  created_by: string | null
}

function toVersion(row: VersionRow): LegalVersion {
  return {
    id: row.id,
    version: row.version,
    effectiveDate: row.effective_date,
    contentHtml: row.content_html,
    summary: row.summary ?? '',
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

/** 목록 화면(카드 3장). 문서가 세 개뿐이라 한 번에 다 읽는다. */
export async function listLegalDocuments(): Promise<readonly LegalDocumentSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('legal_documents')
    .select(`id, slug, title, updated_at, legal_document_versions (${VERSION_COLUMNS})`)

  if (error !== null) {
    console.error('[legal] 목록 조회 실패', error.message)
  }

  return LEGAL_DOCUMENTS.map((document) => {
    const row = (data ?? []).find((candidate) => candidate.slug === document.slug)
    const versions = (row?.legal_document_versions ?? []).map(toVersion)
    const sorted = [...versions].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )

    return {
      slug: document.slug,
      label: document.label,
      title: row?.title ?? null,
      current: selectCurrentLegalVersion(versions),
      latest: sorted[0] ?? null,
      versionCount: versions.length,
    }
  })
}

/** 편집·이력 화면. 개정본을 최신 생성순으로 함께 싣는다. */
export async function getLegalDocument(slug: LegalSlug): Promise<LegalDocumentDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('legal_documents')
    .select(`id, slug, title, updated_at, legal_document_versions (${VERSION_COLUMNS})`)
    .eq('slug', slug)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  const versions = data.legal_document_versions
    .map(toVersion)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return {
    id: data.id,
    slug,
    title: data.title,
    updatedAt: data.updated_at,
    versions,
  }
}
