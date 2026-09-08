import { notFound } from 'next/navigation'

import { policyTocEntries } from '@/components/policy/policy-prose'
import { PolicyCodeBody } from '@/components/policy/PolicyCodeBody'
import { PolicyDocumentShell, PolicyIpNotice } from '@/components/policy/PolicyDocumentShell'
import { PolicyHtmlBody } from '@/components/policy/PolicyHtmlBody'
import { POLICY_FALLBACKS } from '@/lib/content/policy-fallback'
import { formatEffectiveDate, getLegalDocument, isLegalSlug, LEGAL_SLUGS } from '@/lib/data/legal'
import { getSiteSettings } from '@/lib/data/site'
import { resolveIpNotice } from '@/lib/data/site-view'

import type { PolicyTocEntry } from '@/components/policy/policy-prose'
import type { Metadata } from 'next'

/**
 * 정책 문서 한 편.
 *
 * 본문의 단일 출처는 DB 의 발행본(`legal_documents` + `legal_document_versions`)이다.
 * 관리자에서 고친 문안이 그대로 여기 나온다. 조회가 실패하거나 아직 발행본이 없으면
 * 코드 문안(`lib/content/policy-fallback.ts`)으로 떨어진다 — 약관 페이지는 DB 사정과
 * 무관하게 항상 열려 있어야 한다.
 *
 * 지식재산권 고지는 `site_settings.ip_notice` 가 단일 출처다. 본문에 섞지 않는 이유:
 * 그 문구는 넥슨 IP 정책을 따라 별도로 갱신되고, 개정본 이력에 끌려 들어가면
 * 문구 하나 고치려고 약관 개정본을 만들어야 한다.
 */

export function generateStaticParams(): { slug: string }[] {
  return LEGAL_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata(props: PageProps<'/policy/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params

  if (!isLegalSlug(slug)) {
    return {}
  }

  const fallback = POLICY_FALLBACKS[slug]
  const document = await getLegalDocument(slug)

  return { title: document?.title ?? fallback.title, description: fallback.description }
}

/** 폴백 목차. 발행본은 `<h2>` 에서, 폴백은 장 번호에서 항목을 만든다. */
function fallbackTocEntries(slug: keyof typeof POLICY_FALLBACKS): readonly PolicyTocEntry[] {
  return POLICY_FALLBACKS[slug].sections.map((section) => ({
    id: section.id,
    label: `${section.number}. ${section.title}`,
  }))
}

export default async function PolicyPage(props: PageProps<'/policy/[slug]'>) {
  const { slug } = await props.params

  if (!isLegalSlug(slug)) {
    notFound()
  }

  const fallback = POLICY_FALLBACKS[slug]
  const [document, settings] = await Promise.all([getLegalDocument(slug), getSiteSettings()])
  const isPublished = document !== null

  const version = document?.version ?? fallback.version
  const entries = isPublished ? policyTocEntries(document.contentHtml) : fallbackTocEntries(slug)

  return (
    <PolicyDocumentShell
      heading={fallback.heading}
      effectiveDate={
        isPublished ? formatEffectiveDate(document.effectiveDate) : fallback.effectiveDate
      }
      version={version}
      versionHref={`/policy/${slug}?ver=${version}`}
      entries={entries}
    >
      {isPublished ? (
        <PolicyHtmlBody html={document.contentHtml} />
      ) : (
        <PolicyCodeBody fallback={fallback} />
      )}

      {fallback.hasIpNotice ? <PolicyIpNotice notice={resolveIpNotice(settings)} /> : null}
    </PolicyDocumentShell>
  )
}
