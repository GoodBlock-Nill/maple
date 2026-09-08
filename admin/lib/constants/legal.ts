/**
 * 약관 모듈의 고정값.
 *
 * 슬러그 목록은 DB 의 `legal_documents_slug_known` 체크 제약과 같은 집합이어야
 * 한다. 여기 없는 슬러그로 화면을 열면 404 로 끊고, DB 에도 들어가지 못한다.
 */

export const LEGAL_SLUGS = ['privacy', 'discord', 'operating'] as const

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}

/** 목록 카드에 쓰는 이름과 사용자 사이트 경로. 순서가 곧 카드 순서다. */
export const LEGAL_DOCUMENTS: readonly { slug: LegalSlug; label: string; clientPath: string }[] = [
  { slug: 'privacy', label: '개인정보처리방침', clientPath: '/policy/privacy' },
  { slug: 'discord', label: '디스코드 운영정책', clientPath: '/policy/discord' },
  { slug: 'operating', label: '글자월드 운영정책', clientPath: '/policy/operating' },
]

export function legalDocumentLabel(slug: LegalSlug): string {
  return LEGAL_DOCUMENTS.find((document) => document.slug === slug)?.label ?? slug
}

export function legalClientPath(slug: LegalSlug): string {
  return `/policy/${slug}`
}

/**
 * 사용자 사이트 캐시 태그(`lib/data/cache.ts` 의 `CACHE_TAGS.legal`).
 *
 * `lib/revalidate.ts` 의 `CLIENT_CACHE_TAGS` 에 이 값이 아직 없다. 그쪽은 다른
 * 모듈이 함께 쓰는 파일이라 여기서 한 줄만 들고 있는다 — 사용자 사이트가 허용
 * 목록으로 다시 검사하므로 오타는 400 으로 즉시 드러난다.
 */
export const LEGAL_CLIENT_CACHE_TAG = 'legal'

/** 개정본의 화면 상태. `is_published` + `effective_date` 조합에서 파생된다. */
export type LegalVersionStatus = 'draft' | 'scheduled' | 'published' | 'superseded'

export const LEGAL_STATUS_LABEL: Record<LegalVersionStatus, string> = {
  draft: '임시저장',
  scheduled: '예약',
  published: '시행 중',
  superseded: '지난 버전',
}

export const LEGAL_STATUS_TONE: Record<LegalVersionStatus, 'neutral' | 'warn' | 'success'> = {
  draft: 'neutral',
  scheduled: 'warn',
  published: 'success',
  superseded: 'neutral',
}
