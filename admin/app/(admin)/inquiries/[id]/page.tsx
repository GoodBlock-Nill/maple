import { notFound } from 'next/navigation'

import { InquiryAssignmentCard } from '@/components/inquiries/InquiryAssignmentCard'
import { InquiryAttachments } from '@/components/inquiries/InquiryAttachments'
import { InquiryCloseButton } from '@/components/inquiries/InquiryCloseButton'
import { InquiryMeta } from '@/components/inquiries/InquiryMeta'
import { InquiryNotes } from '@/components/inquiries/InquiryNotes'
import { InquiryReplyForm } from '@/components/inquiries/InquiryReplyForm'
import { InquiryReplyThread } from '@/components/inquiries/InquiryReplyThread'
import { InquiryStatusBadge } from '@/components/inquiries/InquiryStatusBadge'
import { InquiryStatusForm } from '@/components/inquiries/InquiryStatusForm'
import { Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { getAdmins } from '@/lib/data/admins'
import { getInquiryNotes } from '@/lib/data/inquiry-assignment'
import { getInquiryDetail, getInquiryReplies } from '@/lib/data/inquiries'
import { getInquiryReplyTemplateOptions } from '@/lib/data/inquiry-reply-templates'
import { formatInquiryNo } from '@/lib/utils/inquiry-no'
import {
  inquiryCategoryLabel,
  inquiryTypeLabel,
  isCancelledInquiry,
} from '@/lib/validation/inquiries'

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

  /* 답변 템플릿은 이 문의의 카테고리에 매여 있다(공통 + 같은 카테고리 · 사용 중인 것).
     답변 폼을 그리지 않는 경우(읽기 전용 · 취소 · 종료)에도 함께 읽는다 — 한 번의
     왕복이고, 조건을 나누면 "답변 폼이 보이는데 선택지는 비어 있는" 경로가 생긴다. */
  const [replies, templates, notes, admins] = await Promise.all([
    getInquiryReplies(inquiry.id),
    getInquiryReplyTemplateOptions(inquiry.category),
    /* 내부 메모는 관리자 전용 테이블이다(`inquiry_notes`). 읽기 권한만 있어도 보이고,
       남기고 지우는 것은 쓰기 권한이 필요하다. */
    getInquiryNotes(inquiry.id, admin.id),
    getAdmins(),
  ])
  // 사용자가 스스로 취소한 접수는 읽기 전용이다(액션도 같은 규칙으로 거절한다).
  const isLocked = isCancelledInquiry(inquiry.cancelledAt)
  /* 이메일 문의에는 취소할 사용자가 없으므로 위 잠금은 항상 false 다 — 그래도 규칙을
     한 줄로 유지한다. 출처는 **라벨로 보여 주지 않고**(사이드바가 이미 갈라 두었다) 화면
     곳곳(메타·스레드·답신 폼)의 문구를 가르는 데만 쓴다. */
  const isEmail = inquiry.source === 'email'

  return (
    <>
      <PageHeader
        title={inquiry.title}
        /* 접수번호를 맨 앞에 둔다 — 사용자가 "1024번 문의요"라고 부르는 값이라,
           운영자가 화면을 열자마자 같은 문의인지 확인할 수 있어야 한다. */
        description={
          isEmail
            ? `${formatInquiryNo(inquiry.inquiryNo)} · ${inquiry.emailFrom ?? '(발신자 없음)'}`
            : `${formatInquiryNo(inquiry.inquiryNo)} · ${inquiryCategoryLabel(inquiry.category)} · ${inquiryTypeLabel(inquiry.type)}`
        }
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
                replyCount={replies.length}
              />
            )}
            {canWrite && !isLocked && inquiry.status !== 'closed' && (
              <InquiryCloseButton
                inquiryId={inquiry.id}
                status={inquiry.status}
                replyCount={replies.length}
              />
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
        <InquiryAssignmentCard
          inquiryId={inquiry.id}
          assignee={inquiry.assignee}
          assignedAt={inquiry.assignedAt}
          admins={admins}
          currentAdminId={admin.id}
          canWrite={canWrite}
          isLocked={isLocked}
        />

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

        <InquiryReplyThread replies={replies} isEmail={isEmail} canWrite={canWrite} />

        <InquiryNotes inquiryId={inquiry.id} notes={notes} canWrite={canWrite} />

        {!canWrite || isLocked ? null : inquiry.status === 'closed' ? (
          <p className="border-line bg-page text-muted rounded-card border px-4 py-3 text-[13px]">
            종료된 문의입니다. 답변을 이어가려면 상태를 &lsquo;처리 중&rsquo;으로 되돌려 주세요.
          </p>
        ) : (
          <InquiryReplyForm
            inquiryId={inquiry.id}
            adminId={admin.id}
            adminNickname={admin.nickname}
            isEmail={isEmail}
            templates={templates}
            inquiry={{
              id: inquiry.id,
              inquiryNo: inquiry.inquiryNo,
              title: inquiry.title,
              category: inquiry.category,
              nickname: inquiry.nickname,
            }}
            /* 화면을 연 시점의 스레드. 저장할 때 이 값과 DB 를 비교해 "다른 운영자가
               먼저 처리했는지"를 가른다(`add_inquiry_reply`). */
            snapshot={{
              replyCount: replies.length,
              status: inquiry.status,
              updatedAt: inquiry.updatedAt,
            }}
          />
        )}
      </div>
    </>
  )
}
