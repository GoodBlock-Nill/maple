import { unstable_cache } from 'next/cache'

import { CACHE_TAGS, STATIC_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { sanitizeLegalHtml } from '@/lib/sanitize/legal-html'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * 약관·정책 문서 조회 계층 (`legal_documents` + `legal_document_versions`).
 *
 * "지금 시행 중인 문안"을 고르는 규칙은 DB 함수 `current_legal_version(slug)` 하나가
 * 소유한다. 관리자 미리보기와 사용자 화면이 각자 규칙을 짜면 예약 개정본이 걸린
 * 날 두 화면이 서로 다른 버전을 보여 준다.
 *
 * 조회에 실패하거나 발행본이 없으면 `null` 을 돌려준다 — 호출부(`/policy/[slug]`)가
 * 코드 안의 문안(`lib/content/*`)으로 떨어진다. 약관 페이지가 500 으로 죽는 것보다
 * 조금 오래된 문안을 보여 주는 편이 낫다.
 */

/**
 * 사용자 사이트가 다루는 정책 문서. DB 의 `legal_documents_slug_known` 과 같은
 * 집합이어야 한다(`marketing` 은 20260910000300 마이그레이션이 제약에 더한다).
 */
export const LEGAL_SLUGS = ['privacy', 'discord', 'operating', 'marketing'] as const

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}

export type LegalDocument = {
  title: string
  version: string
  /** `2026-09-18` (DB 의 date 그대로). 화면 표기는 `formatEffectiveDate()` 가 만든다. */
  effectiveDate: string
  /** 정제를 마친 본문 HTML. 화면은 `renderPolicyHtml()` 을 한 번 더 거쳐 그린다. */
  contentHtml: string
  summary: string | null
}

/** `2026-09-18` → `2026년 9월 18일`. 코드 문안의 표기와 글자 하나까지 같아야 한다. */
export function formatEffectiveDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(isoDate.trim())

  if (match === null) {
    return isoDate
  }

  /* `new Date()` 를 쓰지 않는다. date 컬럼에는 시각이 없어 UTC 자정으로 해석되고,
     한국 시간대로 다시 포맷하면 하루가 밀린다. */
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`
}

async function fetchLegalDocument(slug: string): Promise<LegalDocument | null> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('current_legal_version', { p_slug: slug })

  if (error !== null) {
    console.error('[legal] 조회 실패', slug, error.message)

    return null
  }

  const row = data.at(0)

  if (row === undefined) {
    return null
  }

  return {
    title: row.title,
    version: row.version,
    effectiveDate: row.effective_date,
    /* 저장 시점에 이미 정제된 값이지만 한 번 더 깎는다. 정제기가 바뀌면 과거 행도
       새 규칙을 받아야 하고, DB 를 직접 고친 값이 화면까지 그대로 갈 수 없어야 한다. */
    contentHtml: sanitizeLegalHtml(row.content_html),
    summary: row.summary,
  }
}

const getCachedLegalDocument = unstable_cache(fetchLegalDocument, ['legal-document'], {
  tags: [CACHE_TAGS.legal],
  revalidate: STATIC_REVALIDATE_SECONDS,
})

/**
 * 슬러그의 현재 시행 문안. 없으면 `null`.
 *
 * `unstable_cache` 의 키에는 인자가 자동으로 섞이므로 문서마다 따로 캐시된다.
 * 태그는 하나(`legal`)다 — 관리자가 어느 문서를 발행하든 세 페이지가 같이 갱신되는
 * 편이, 문서별 태그를 관리자 쪽에 다시 옮겨 적는 것보다 어긋날 여지가 적다.
 */
export async function getLegalDocument(slug: LegalSlug): Promise<LegalDocument | null> {
  return getCachedLegalDocument(slug)
}
