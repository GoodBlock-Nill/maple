import { notFound } from 'next/navigation'

import { InquiryAttachments } from '@/components/inquiries/InquiryAttachments'
import { InquiryCloseButton } from '@/components/inquiries/InquiryCloseButton'
import { InquiryMeta } from '@/components/inquiries/InquiryMeta'
import { InquiryReplyForm } from '@/components/inquiries/InquiryReplyForm'
import { InquiryReplyThread } from '@/components/inquiries/InquiryReplyThread'
import { InquiryStatusBadge } from '@/components/inquiries/InquiryStatusBadge'
import { InquiryStatusForm } from '@/components/inquiries/InquiryStatusForm'
import { Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { getInquiryDetail, getInquiryReplies } from '@/lib/data/inquiries'
import { isCancelledInquiry } from '@/lib/validation/inquiries'

import type { Metadata } from 'next'

/** 제목·내용에 개인정보가 섞이므로 색인하지 않는다(관리자 화면이지만 명시해 둔다). */
export const metadata: Metadata = {
  title: '문의 상세',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function InquiryDetailPage(props: PageProps<'/inquiries/[id]'>) {
  const { id } = await props.params
  const [admin, inquiry] = await Promise.all([
    requirePermission('inquiries', 'read'),
    getInquiryDetail(id),
  ])
  const canWrite = hasPermission(admin.permissions, 'inquiries', 'write')

  if (inquiry === null) {
    notFound()
  }

  const replies = await getInquiryReplies(inquiry.id)
  // 사용자가 스스로 취소한 접수는 읽기 전용이다(액션도 같은 규칙으로 거절한다).
  const isLocked = isCancelledInquiry(inquiry.cancelledAt)

  return (
    <>
      <PageHeader
        title={inquiry.title}
        description={`${inquiry.category} · ${inquiry.type}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* 상태 문구는 화면 곳곳(선택 상자·토스트)에 다시 나오므로 검증용 표식을 둔다. */}
            <span data-testid="inquiry-status">
              <InquiryStatusBadge status={inquiry.status} cancelledAt={inquiry.cancelledAt} />
            </span>
            {canWrite && (
              <InquiryStatusForm
                inquiryId={inquiry.id}
                status={inquiry.status}
                isLocked={isLocked}
              />
            )}
            {canWrite && !isLocked && inquiry.status !== 'closed' && (
              <InquiryCloseButton inquiryId={inquiry.id} />
            )}
            <Button href="/inquiries" variant="ghost" size="sm">
              목록
            </Button>
          </div>
        }
      />

      {isLocked && (
        <p className="border-line bg-page text-muted rounded-card mb-4 border px-4 py-3 text-[13px]">
          사용자가 접수를 취소한 문의입니다. 답변 등록과 상태 변경이 막혀 있습니다.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="문의 정보" />
          <CardBody>
            <InquiryMeta inquiry={inquiry} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="문의 내용" />
          <CardBody className="flex flex-col gap-4">
            {/* 사용자가 쓴 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
            <p className="text-ink text-[14px] leading-relaxed whitespace-pre-line">
              {inquiry.content}
            </p>
            <div className="border-line flex flex-col gap-2 border-t pt-4">
              <span className="text-muted text-[12px] font-semibold">첨부파일</span>
              <InquiryAttachments attachments={inquiry.attachments} />
            </div>
          </CardBody>
        </Card>

        <InquiryReplyThread replies={replies} />

        {!canWrite || isLocked ? null : inquiry.status === 'closed' ? (
          <p className="border-line bg-page text-muted rounded-card border px-4 py-3 text-[13px]">
            종료된 문의입니다. 답변을 이어가려면 상태를 &lsquo;처리 중&rsquo;으로 되돌려 주세요.
          </p>
        ) : (
          <InquiryReplyForm inquiryId={inquiry.id} adminNickname={admin.nickname} />
        )}
      </div>
    </>
  )
}
