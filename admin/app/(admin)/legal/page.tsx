import { LegalDocumentCard } from '@/components/legal/LegalDocumentCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { listLegalDocuments } from '@/lib/data/legal'
import { clientSiteUrl } from '@/lib/supabase/env'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Legal',
}

export const dynamic = 'force-dynamic'

/**
 * 약관 문서 목록.
 *
 * 문서 수가 고정(현재 네 개)이라 표가 아니라 카드다. 거의 늘어나지 않는 목록에
 * 정렬·검색·페이지를 붙이면 운영자가 매번 같은 몇 줄을 훑게 된다. 카드 목록의
 * 단일 출처는 `LEGAL_DOCUMENTS` 이므로 문서를 더할 때 이 화면은 손대지 않는다.
 */
export default async function LegalPage() {
  const { permissions } = await requirePermission('legal', 'read')
  const canWrite = hasPermission(permissions, 'legal', 'write')
  const documents = await listLegalDocuments()
  const siteUrl = clientSiteUrl()

  return (
    <>
      <PageHeader
        title="Legal"
        description="개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책 · 마케팅 정보 수신 동의. 발행본은 사용자 사이트 /policy/[slug] 가 그대로 읽습니다."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {documents.map((document) => (
          <LegalDocumentCard
            key={document.slug}
            document={document}
            siteUrl={siteUrl}
            canWrite={canWrite}
          />
        ))}
      </div>
    </>
  )
}
