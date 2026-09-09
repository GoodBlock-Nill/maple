import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * 관리 화면 안에서 `notFound()` 가 불렸을 때(지워진 뉴스·문의 상세 등).
 *
 * 루트의 `app/not-found.tsx` 는 레이아웃 바깥이라 사이드바가 사라진다. 운영자가
 * 목록에서 방금 지운 항목을 다시 눌렀을 뿐인데 화면 전체가 바뀌면 길을 잃는다.
 * 여기서는 껍데기를 그대로 두고 본문만 안내로 바꾼다.
 */
export default function AdminNotFound() {
  return (
    <>
      <PageHeader title="찾을 수 없음" />

      <Card>
        <EmptyState
          title="요청하신 항목을 찾을 수 없습니다."
          description="삭제됐거나 주소가 잘못됐을 수 있습니다."
          action={<Button href="/">대시보드로 이동</Button>}
        />
      </Card>
    </>
  )
}
