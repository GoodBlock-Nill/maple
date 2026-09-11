import { notFound } from 'next/navigation'

import { MemberActions } from '@/components/members/MemberActions'
import {
  ACTIVITY_TABS,
  MemberActivityPanel,
  type ActivityTab,
} from '@/components/members/MemberActivityPanel'
import { MemberLifecycleCard } from '@/components/members/MemberLifecycleCard'
import { MemberProfileCard } from '@/components/members/MemberProfileCard'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { countRedemptionsByMember } from '@/lib/data/coupon-redemptions'
import { getMember, getMemberActivity } from '@/lib/data/members'
import { getMemberInquiries } from '@/lib/data/member-inquiries'
import { getReportsFor } from '@/lib/data/reports'
import { buildHref, firstValue } from '@/lib/utils/table-query'
import { memberLifecycle } from '@/lib/validation/member-status'
import { isSuspended } from '@/lib/validation/members'

import type { MemberInquirySummary } from '@/lib/data/member-inquiries'
import type { ReportItem } from '@/lib/data/reports'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원 상세',
}

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage(props: PageProps<'/members/[id]'>) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams])
  const [actor, member] = await Promise.all([requirePermission('members', 'read'), getMember(id)])
  const canWrite = hasPermission(actor.permissions, 'members', 'write')
  /* 문의는 별도 모듈이다 — 회원 읽기 권한만으로 다른 모듈(1:1 문의)의 내용을
     보여 주지 않는다. 아래 쿠폰 건수와 같은 이유. */
  const canReadInquiries = hasPermission(actor.permissions, 'inquiries', 'read')

  if (member === null) {
    notFound()
  }

  const lifecycle = memberLifecycle(member)
  /* 쿠폰 등록 건수는 `coupons` 모듈을 읽을 수 있는 운영자에게만 보여 준다 — 회원
     권한만 가진 사람에게 다른 모듈의 수치를 흘리지 않는다. RLS 는 이 구분을 모른다. */
  const canReadCoupons = hasPermission(actor.permissions, 'coupons', 'read')
  const [activity, couponCount] = await Promise.all([
    getMemberActivity(id),
    canReadCoupons ? countRedemptionsByMember(id) : Promise.resolve(null),
  ])
  const requested = firstValue(searchParams.tab)
  const tab: ActivityTab = ACTIVITY_TABS.includes(requested as ActivityTab)
    ? (requested as ActivityTab)
    : 'posts'

  /* 신고 목록·문의 목록은 보고 있는 탭에서만 읽는다. 늘 읽으면 게시글 탭 한 번에
     쓰이지도 않는 질의가 붙는다. */
  const [reports, memberInquiries] = await Promise.all([
    loadReports(tab, id, activity.posts, activity.comments),
    loadMemberInquiries(tab, id, canReadInquiries),
  ])
  const path = `/members/${id}`

  return (
    <>
      <PageHeader
        title={member.nickname}
        description={
          canWrite
            ? '회원 정보와 활동을 확인하고 제재를 적용합니다.'
            : '회원 정보와 활동을 확인합니다(읽기 전용).'
        }
        action={
          <Button href="/members" variant="secondary" size="sm">
            목록으로
          </Button>
        }
      />

      {/* 탈퇴·파기 카드가 프로필보다 위에 온다. 이 화면에 들어온 이유가 대개
          "이 계정 왜 이러냐"이고, 그 답이 여기 있다. */}
      <MemberLifecycleCard deletedAt={member.deletedAt} purgedAt={member.purgedAt} />

      <MemberProfileCard
        member={member}
        couponCount={couponCount}
        actions={
          canWrite ? (
            <MemberActions
              memberId={member.id}
              nickname={member.nickname}
              isSuspended={isSuspended(member.suspendedUntil)}
              lifecycle={lifecycle}
              isSuperAdmin={actor.isSuperAdmin}
              isSelf={actor.id === member.id}
            />
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="게시글" value={activity.postCount.toLocaleString('ko-KR')} />
        <StatCard label="댓글" value={activity.commentCount.toLocaleString('ko-KR')} />
        <StatCard label="접수한 신고" value={activity.reportsMadeCount.toLocaleString('ko-KR')} />
        <StatCard
          label="받은 신고"
          value={activity.reportedCount.toLocaleString('ko-KR')}
          tone={activity.reportedCount > 0 ? 'danger' : 'default'}
        />
        <StatCard label="1:1 문의" value={activity.inquiryCount.toLocaleString('ko-KR')} />
      </div>

      <MemberActivityPanel
        active={tab}
        counts={{
          posts: activity.postCount,
          comments: activity.commentCount,
          'reports-made': activity.reportsMadeCount,
          'reports-received': activity.reportedCount,
          inquiries: activity.inquiryCount,
        }}
        buildHref={(next) => buildHref(path, searchParams, { tab: next })}
        posts={activity.posts}
        comments={activity.comments}
        reports={reports}
        inquiries={memberInquiries.rows}
        inquiriesHasError={memberInquiries.hasError}
        canReadInquiries={canReadInquiries}
        inquiriesMoreHref={
          activity.inquiryCount > memberInquiries.rows.length ? `/inquiries?user=${id}` : null
        }
      />
    </>
  )
}

/**
 * 탭에 필요한 신고 목록.
 *
 * "신고받음"은 대상 id 로 되짚어야 한다(`reports` 에 작성자 컬럼이 없다). 최근 활동
 * 40건(게시글·댓글 각 20)만 훑으므로, 카드의 누적 수치보다 적게 나올 수 있다.
 */
async function loadReports(
  tab: ActivityTab,
  memberId: string,
  posts: readonly { id: string }[],
  comments: readonly { id: string }[],
): Promise<readonly ReportItem[]> {
  if (tab === 'reports-made') {
    return getReportsFor({ reporterId: memberId })
  }

  if (tab === 'reports-received') {
    return getReportsFor({
      targetIds: [...posts.map((row) => row.id), ...comments.map((row) => row.id)],
    })
  }

  return []
}

/**
 * 탭에 필요한 문의 목록.
 *
 * `inquiries:read` 가 없으면 조회 자체를 건너뛴다 — RLS 를 믿고 그냥 읽으면
 * 빈 표(0건)와 "권한 없음"을 구분할 수 없어, 권한 없는 운영자에게 "문의가
 * 없다"로 잘못 보일 수 있다.
 */
async function loadMemberInquiries(
  tab: ActivityTab,
  memberId: string,
  canRead: boolean,
): Promise<{ rows: readonly MemberInquirySummary[]; hasError: boolean }> {
  if (tab !== 'inquiries' || !canRead) {
    return { rows: [], hasError: false }
  }

  return getMemberInquiries(memberId)
}
