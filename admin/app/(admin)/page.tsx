import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { Card, CardHeader } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { hasPermission } from '@/lib/auth/permissions'
import { requireAdmin } from '@/lib/auth/require-admin'
import { COUNT_FAILED } from '@/lib/constants/messages'
import { getDashboardMetrics, getRecentActivity, type MetricWindow } from '@/lib/data/dashboard'
import { firstValue } from '@/lib/utils/table-query'
import { PURGE_RETENTION_DAYS } from '@/lib/validation/member-status'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '대시보드',
}

/* 지표는 요청마다 새로 센다. 운영자가 조치 직후 숫자를 확인하는 화면이라
   캐시된 값을 보여 주면 "반영이 안 됐다"는 오해를 부른다. */
export const dynamic = 'force-dynamic'

/** 권한이 없는 화면에서 되돌아왔을 때의 안내(`requirePermission` 의 착지점). */
const FORBIDDEN_MESSAGE = '이 화면을 볼 권한이 없습니다. 필요하면 슈퍼어드민에게 요청해 주세요.'

/**
 * 대시보드는 `requirePermission()` 을 쓰지 않는다.
 *
 * 권한 없는 화면의 착지점이 대시보드 자신이기 때문이다 — 여기서 다시 리다이렉트하면
 * `/?error=forbidden` 이 자기 자신으로 무한히 튕긴다. 대신 직접 판정해서 지표를
 * 감추고, 되돌아온 사유를 배너로 알린다.
 */
export default async function DashboardPage(props: PageProps<'/'>) {
  const searchParams = await props.searchParams
  const admin = await requireAdmin()
  const isForbidden = firstValue(searchParams.error) === 'forbidden'
  const canRead = hasPermission(admin.permissions, 'dashboard', 'read')

  if (!canRead) {
    return (
      <>
        <PageHeader title="대시보드" description="열람 권한이 없는 화면입니다." />
        <FormBanner message={FORBIDDEN_MESSAGE} />
      </>
    )
  }

  const [metrics, activity] = await Promise.all([getDashboardMetrics(), getRecentActivity()])

  return (
    <>
      <PageHeader
        title="대시보드"
        description="오늘 기준 수치입니다. 카드 아래 줄은 최근 7일 · 30일 누계입니다."
      />

      {isForbidden && (
        <div className="mb-4">
          <FormBanner message={FORBIDDEN_MESSAGE} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          tone={isPositive(metrics.openReports) ? 'danger' : 'default'}
          testId="stat-reports"
        />
        <StatCard
          label="대기 문의"
          value={format(metrics.pendingInquiries)}
          hint="상태 pending"
          tone={isPositive(metrics.pendingInquiries) ? 'warn' : 'default'}
          testId="stat-inquiries"
        />
        <StatCard
          label="처리 대기 쿠폰"
          value={format(metrics.pendingCouponRedemptions)}
          hint="지급·거절을 아직 기록하지 않은 등록"
          tone={isPositive(metrics.pendingCouponRedemptions) ? 'warn' : 'default'}
          testId="stat-coupon-redemptions"
        />
        <StatCard
          label="탈퇴 대기"
          value={format(metrics.withdrawnPending)}
          hint={`파기까지 ${PURGE_RETENTION_DAYS}일 · 그 안에 재로그인하면 복구`}
          testId="stat-withdrawn"
        />
        <StatCard
          label="지난 7일 파기"
          value={format(metrics.purgedThisWeek)}
          hint="개인정보 영구 삭제 완료"
          testId="stat-purged"
        />
      </div>

      <Card>
        <CardHeader
          title="최근 활동"
          description="게시글 · 댓글 · 문의 · 신고를 시간순으로 묶었습니다."
        />
        <RecentActivity items={activity} />
      </Card>
    </>
  )
}

/**
 * 서식은 서버에서 확정한다. 클라이언트 로캘에 맡기면 하이드레이션이 어긋난다.
 *
 * 집계가 깨진 값은 `null` 로 온다. 0 으로 그리면 운영자가 "오늘 아무 일도 없었다"로
 * 읽고 넘어가므로, 숫자 자리에 실패했다는 사실을 그대로 적는다.
 */
function format(value: number | null): string {
  return value === null ? COUNT_FAILED : value.toLocaleString('ko-KR')
}

/** 강조 색은 "센 값이 있을 때"만 쓴다 — 집계 실패를 위험 신호로 물들이지 않는다. */
function isPositive(value: number | null): boolean {
  return value !== null && value > 0
}

function windowHint(window: MetricWindow): string {
  return `7일 ${format(window.week)} · 30일 ${format(window.month)}`
}
