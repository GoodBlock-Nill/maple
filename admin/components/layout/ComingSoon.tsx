import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * 2단계에서 채울 화면의 자리표시자.
 *
 * 라우트를 비워 두면 사이드바 링크가 404 로 떨어져 내비게이션 전체를 검증할 수
 * 없다. 껍데기라도 200 으로 응답해야 "메뉴 → 화면"이 이어졌는지 지금 확인된다.
 */
export function ComingSoon({
  title,
  description,
  scope,
}: {
  title: string
  description: string
  scope: string
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState title="준비 중" description={`${scope} 화면은 다음 단계에서 붙습니다.`} />
      </Card>
    </>
  )
}
