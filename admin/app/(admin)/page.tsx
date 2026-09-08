import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { getDashboardMetrics, getRecentActivity, type MetricWindow } from '@/lib/data/dashboard'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '대시보드',
}

/* 지표는 요청마다 새로 센다. 운영자가 조치 직후 숫자를 확인하는 화면이라
   캐시된 값을 보여 주면 "반영이 안 됐다"는 오해를 부른다. */
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [metrics, activity] = await Promise.all([getDashboardMetrics(), getRecentActivity()])

  return (
    <>
      <PageHeader
        title="대시보드"
        description="오늘 기준 수치입니다. 카드 아래 줄은 최근 7일 · 30일 누계입니다."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="신규 가입"
          value={format(metrics.profiles.today)}
          hint={windowHint(metrics.profiles)}
          testId="stat-profiles"
        />
        <StatCard
          label="뉴스 등록"
          value={format(metrics.newsPosts.today)}
          hint={windowHint(metrics.newsPosts)}
          testId="stat-news"
        />
        <StatCard
          label="커뮤니티 글"
          value={format(metrics.communityPosts.today)}
          hint={windowHint(metrics.communityPosts)}
          testId="stat-community"
        />
        <StatCard
          label="댓글"
          value={format(metrics.comments.today)}
          hint={windowHint(metrics.comments)}
          testId="stat-comments"
        />
        <StatCard
          label="미처리 신고"
          value={format(metrics.openReports)}
          hint="상태 open"
          tone={metrics.openReports > 0 ? 'danger' : 'default'}
          testId="stat-reports"
        />
        <StatCard
          label="대기 문의"
          value={format(metrics.pendingInquiries)}
          hint="상태 pending"
          tone={metrics.pendingInquiries > 0 ? 'warn' : 'default'}
          testId="stat-inquiries"
        />
      </div>

      <Card>
        <CardHeader title="최근 활동" description="게시글 · 댓글 · 문의 · 신고를 시간순으로 묶었습니다." />
        <RecentActivity items={activity} />
      </Card>
    </>
  )
}

/** 서식은 서버에서 확정한다. 클라이언트 로캘에 맡기면 하이드레이션이 어긋난다. */
function format(value: number): string {
  return value.toLocaleString('ko-KR')
}

function windowHint(window: MetricWindow): string {
  return `7일 ${format(window.week)} · 30일 ${format(window.month)}`
}
