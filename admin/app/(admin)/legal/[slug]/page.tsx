import { notFound } from 'next/navigation'

import { LegalDiffView } from '@/components/legal/LegalDiffView'
import { LegalForm } from '@/components/legal/LegalForm'
import { LegalPreview } from '@/components/legal/LegalPreview'
import { LegalVersionHistory } from '@/components/legal/LegalVersionHistory'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  isLegalSlug,
  LEGAL_STATUS_LABEL,
  LEGAL_STATUS_TONE,
  legalClientPath,
  legalDocumentLabel,
} from '@/lib/constants/legal'
import { requirePermission } from '@/lib/auth/require-admin'
import { getLegalDocument } from '@/lib/data/legal'
import { clientSiteUrl } from '@/lib/supabase/env'
import { firstValue } from '@/lib/utils/table-query'
import {
  defaultLegalVersion,
  deriveLegalStatus,
  formatEffectiveDate,
  kstToday,
  selectCurrentLegalVersion,
} from '@/lib/validation/legal'

import type { LegalVersion } from '@/lib/data/legal'
import type { QueryParams } from '@/lib/utils/table-query'
import type { LegalPublishMode } from '@/lib/validation/legal'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '약관 편집',
}

export const dynamic = 'force-dynamic'

/** 폼이 열어야 할 값. 기존 개정본이거나, 복사본이거나, 빈 초안이다. */
type EditorTarget = {
  versionId: string
  version: string
  effectiveDate: string
  summary: string
  contentHtml: string
  mode: LegalPublishMode
  isReadOnly: boolean
}

function modeOf(version: LegalVersion, today: string): LegalPublishMode {
  if (!version.isPublished) {
    return 'draft'
  }

  return version.effectiveDate > today ? 'schedule' : 'publish'
}

function emptyTarget(today: string, contentHtml: string): EditorTarget {
  return {
    versionId: '',
    version: defaultLegalVersion(),
    effectiveDate: today,
    summary: '',
    contentHtml,
    mode: 'draft',
    isReadOnly: false,
  }
}

/**
 * 화면 상태를 쿼리스트링으로 정한다.
 *
 *  `?version=` 열어 볼 개정본 · `?from=` 복사해 새 초안 · `?base=` 비교 기준.
 * 컴포넌트 상태로 두면 새로고침·뒤로가기에서 화면이 초기화되고, 무엇보다 운영자가
 * "이 비교 화면"을 그대로 링크로 남길 수 없다.
 */
function resolveTarget(
  versions: readonly LegalVersion[],
  params: { version: string; from: string },
  today: string,
): EditorTarget {
  if (params.from !== '') {
    const source = versions.find((version) => version.id === params.from)

    return emptyTarget(today, source?.contentHtml ?? '')
  }

  const selected =
    versions.find((version) => version.id === params.version) ??
    selectCurrentLegalVersion(versions, today) ??
    versions[0]

  if (selected === undefined) {
    return emptyTarget(today, '')
  }

  return {
    versionId: selected.id,
    version: selected.version,
    effectiveDate: selected.effectiveDate,
    summary: selected.summary,
    contentHtml: selected.contentHtml,
    mode: modeOf(selected, today),
    isReadOnly: selected.isPublished,
  }
}

export default async function LegalEditPage(props: PageProps<'/legal/[slug]'>) {
  await requirePermission('legal', 'write')
  const { slug } = await props.params

  if (!isLegalSlug(slug)) {
    notFound()
  }

  const search: QueryParams = await props.searchParams
  const document = await getLegalDocument(slug)
  const versions = document?.versions ?? []
  const today = kstToday()
  const current = selectCurrentLegalVersion(versions, today)

  const target = resolveTarget(
    versions,
    { version: firstValue(search.version) ?? '', from: firstValue(search.from) ?? '' },
    today,
  )

  const baseId = firstValue(search.base) ?? ''
  const base = versions.find((version) => version.id === baseId)
  const siteUrl = clientSiteUrl()
  const label = legalDocumentLabel(slug)
  /* 폼이 잠겨 있다(= isReadOnly) == 이미 발행한 개정본을 열었다는 뜻이다.
     초안·복사본은 아직 발행 전이므로 항상 '임시저장'으로 그린다. */
  const previewStatus = deriveLegalStatus(
    {
      version: target.version,
      effectiveDate: target.effectiveDate,
      isPublished: target.isReadOnly,
      publishedAt: null,
    },
    current?.version ?? null,
    today,
  )

  return (
    <>
      <PageHeader
        title={`${label} 편집`}
        description={
          current === null
            ? '아직 발행본이 없습니다. 저장하면 사용자 사이트가 코드 문안 대신 이 문안을 읽습니다.'
            : `현재 시행 ${current.version} · 시행일 ${current.effectiveDate} · 개정본 ${versions.length}건`
        }
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={LEGAL_STATUS_TONE[previewStatus]}>
              {LEGAL_STATUS_LABEL[previewStatus]}
            </Badge>
            <Button
              href={`${siteUrl}${legalClientPath(slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
            >
              클라이언트에서 보기
            </Button>
          </span>
        }
      />

      {/* key 로 폼을 다시 마운트한다. 라우트 전환(같은 컴포넌트, 다른 props)에서는
          React 가 인스턴스를 재사용해 라디오 선택 상태와 에디터 문서가 이전 개정본의
          것으로 남는다 — 발행본을 보다가 "새 초안"으로 넘어가면 그 값이 그대로 저장된다. */}
      <LegalForm
        key={`${target.versionId}:${target.version}`}
        slug={slug}
        versionId={target.versionId}
        defaultVersion={target.version}
        defaultEffectiveDate={target.effectiveDate}
        defaultSummary={target.summary}
        defaultContent={target.contentHtml}
        defaultMode={target.mode}
        isReadOnly={target.isReadOnly}
      />

      <div className="mt-6" data-testid="legal-preview">
        <LegalPreview
          heading={label}
          version={target.version}
          effectiveDate={formatEffectiveDate(target.effectiveDate)}
          contentHtml={target.contentHtml}
          status={previewStatus}
        />
      </div>

      {base === undefined || base.id === target.versionId ? null : (
        <div className="mt-6">
          <LegalDiffView
            baseLabel={base.version}
            targetLabel={target.version}
            baseHtml={base.contentHtml}
            targetHtml={target.contentHtml}
          />
        </div>
      )}

      <div id="history" className="mt-6 scroll-mt-6">
        <LegalVersionHistory
          slug={slug}
          versions={versions}
          currentVersion={current?.version ?? null}
          selectedId={target.versionId}
          baseId={baseId}
        />
      </div>
    </>
  )
}
