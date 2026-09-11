import 'server-only'

import { signInquiryAttachments, toAttachments } from '@/lib/data/inquiry-attachments'
import { parseEmailAuth } from '@/lib/data/inquiry-email'
import { toAdminRef, toEditingRef } from '@/lib/data/inquiry-refs'
import { createClient } from '@/lib/supabase/server'
import { toInquirySource } from '@/lib/validation/inquiries'

import type { InquiryAttachment } from '@/lib/data/inquiry-attachments'
import type { InquiryEmailAuth } from '@/lib/data/inquiry-email'
import type { InquiryAdminRef, InquiryEditingRef } from '@/lib/data/inquiry-refs'
import type { InquirySource, InquiryStatus } from '@/lib/validation/inquiries'

/**
 * 문의 상세 한 건.
 *
 * 목록(`inquiries.ts`)에서 떼어 낸 것은 담당자·작성 중 잠금·접수번호가 붙으면서 그
 * 파일이 300줄 상한에 닿았기 때문이다. 화면은 계속 `@/lib/data/inquiries` 에서
 * 가져다 쓴다(그쪽이 다시 내보낸다).
 */

/* 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
/* prettier-ignore */
const DETAIL_COLUMNS = 'id, inquiry_no, title, content, account_id, category, type, status, contact_email, attachments, answered_at, cancelled_at, created_at, updated_at, user_id, source, email_from, email_from_name, email_message_id, email_auth, email_thread_key, assigned_to, assigned_at, editing_by, editing_at, author:profiles!inquiries_user_id_fkey(nickname, email), assignee:profiles!inquiries_assigned_to_fkey(id, nickname), editor:profiles!inquiries_editing_by_fkey(id, nickname)'

export type InquiryDetail = {
  id: string
  inquiryNo: number
  title: string
  content: string
  accountId: string | null
  category: string
  type: string
  status: InquiryStatus
  contactEmail: string | null
  answeredAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  userId: string | null
  nickname: string
  email: string | null
  attachments: readonly InquiryAttachment[]
  source: InquirySource
  emailFrom: string | null
  emailFromName: string | null
  /** 원본 메일의 Message-ID. 답신의 In-Reply-To 로 쓰이므로 상세에 그대로 보여 준다. */
  emailMessageId: string | null
  emailAuth: InquiryEmailAuth | null
  /** `reply+<key>@` 회신 주소에 쓰는 토큰. 화면에는 노출하지 않는다. */
  emailThreadKey: string | null
  /** 담당 운영자. null 이면 '미배정'이다. */
  assignee: InquiryAdminRef | null
  assignedAt: string | null
  /** 지금 답변을 쓰고 있는 운영자(살아 있는 잠금일 때만 채운다). */
  editing: InquiryEditingRef | null
}

export async function getInquiryDetail(id: string): Promise<InquiryDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiries')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error !== null || data === null) {
    // uuid 가 아닌 id 는 22P02 로 떨어진다. 화면은 404 로 다룬다.
    return null
  }

  const author = data.author as { nickname: string; email: string | null } | null
  const source = toInquirySource(data.source)

  return {
    id: data.id,
    inquiryNo: data.inquiry_no,
    title: data.title,
    content: data.content,
    accountId: data.account_id,
    category: data.category,
    type: data.type,
    status: data.status,
    contactEmail: data.contact_email,
    answeredAt: data.answered_at,
    cancelledAt: data.cancelled_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    userId: data.user_id,
    /* 이메일 문의에는 회원이 없다(`user_id` 를 일부러 채우지 않는다 — 발신자 위조로
       회원을 사칭할 수 있어서다). '(탈퇴한 회원)'으로 보이면 운영자가 오해하므로
       발신자 이름을 대신 쓴다. */
    nickname:
      source === 'email'
        ? (data.email_from_name ?? data.email_from ?? '(발신자 없음)')
        : (author?.nickname ?? '(탈퇴한 회원)'),
    email: author?.email ?? null,
    attachments: await signInquiryAttachments(toAttachments(data.attachments)),
    source,
    emailFrom: data.email_from,
    emailFromName: data.email_from_name,
    emailMessageId: data.email_message_id,
    emailAuth: parseEmailAuth(data.email_auth),
    emailThreadKey: data.email_thread_key,
    assignee: toAdminRef(data.assigned_to, data.assignee),
    assignedAt: data.assigned_at,
    editing: toEditingRef(data.editing_by, data.editing_at, data.editor),
  }
}
