import { notFound } from 'next/navigation'

import { DeletePostButton } from '@/components/board/DeletePostButton'
import { ReportDialog } from '@/components/board/ReportDialog'
import { PageShell } from '@/components/layout/PageShell'

import type { Metadata } from 'next'

/**
 * 신고 · 삭제 확인 다이얼로그의 시각/접근성 검증용 하네스.
 *
 * 두 버튼 모두 로그인 사용자(또는 작성자)에게만 열리는데 E2E 에는 테스트 계정이
 * 없다. 열린 상태의 다이얼로그를 확인할 방법이 이 화면뿐이라 개발 환경에서만
 * 살려 둔다. 프로덕션 빌드에서는 404 이므로 실사용자에게 노출되지 않는다.
 */
export const metadata: Metadata = {
  title: '신고 다이얼로그 미리보기',
  robots: { index: false, follow: false },
}

const SAMPLE_POST_ID = '22222222-0000-4000-8000-000000000001'

export default async function ReportDialogPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <PageShell variant="community" title="신고 다이얼로그 미리보기">
      <div className="mt-6 flex gap-2">
        <ReportDialog
          targetType="post"
          targetId={SAMPLE_POST_ID}
          nextPath={`/community/${SAMPLE_POST_ID}`}
          defaultOpen
        />
        <DeletePostButton postId={SAMPLE_POST_ID} />
      </div>
    </PageShell>
  )
}
