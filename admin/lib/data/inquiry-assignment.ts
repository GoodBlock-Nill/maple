import 'server-only'

import { toAdminRef, toEditingRef } from '@/lib/data/inquiry-refs'
import { createClient } from '@/lib/supabase/server'

import type { InquiryAdminRef, InquiryEditingRef } from '@/lib/data/inquiry-refs'
import type { InquiryStatus } from '@/lib/validation/inquiries'

/**
 * 문의 협업 조회 — 내부 메모 · 담당자/잠금 현재 상태.
 *
 * 전부 **세션 클라이언트**로 읽는다. `inquiry_notes_select_admin` 이 관리자에게만
 * 열려 있으므로 권한이 사라지면 화면도 함께 비는 것이 정상이다. 특히 내부 메모는
 * 서비스 롤로 읽는 순간 "관리자만 본다"는 보장이 앱 코드 한 줄로 내려앉는다.
 */

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const NOTE_COLUMNS = 'id, author_id, author_nickname_snapshot, body, created_at'

/* prettier-ignore */
const COLLAB_COLUMNS = 'status, updated_at, assigned_to, editing_by, editing_at, assignee:profiles!inquiries_assigned_to_fkey(id, nickname), editor:profiles!inquiries_editing_by_fkey(id, nickname), inquiry_replies(count)'

export type InquiryNoteItem = {
  id: string
  /** 지운 뒤에도 남는 표시 이름(작성 시점 스냅샷). */
  authorNickname: string
  /** 작성자 계정. 탈퇴하면 null 이 되고, 그때부터 아무도 이 메모를 지울 수 없다. */
  authorId: string | null
  body: string
  createdAt: string
  /** 보고 있는 관리자가 남긴 메모인가. 삭제 버튼은 이때만 그린다. */
  isMine: boolean
}

/**
 * 20초마다 다시 읽는 협업 상태.
 *
 * 화면 전체를 새로 그리지 않고 이 작은 응답만 갱신한다 — 답변 초안(클라이언트 상태)을
 * 잃지 않으면서 "다른 사람이 쓰고 있다 / 먼저 답변했다"를 알 수 있어야 한다.
 */
export type InquiryCollabState = {
  status: InquiryStatus
  updatedAt: string
  replyCount: number
  assignee: InquiryAdminRef | null
  editing: InquiryEditingRef | null
}

export async function getInquiryNotes(
  inquiryId: string,
  viewerId: string,
): Promise<readonly InquiryNoteItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiry_notes')
    .select(NOTE_COLUMNS)
    .eq('inquiry_id', inquiryId)
    // 최신이 위다. 메모는 "지금 판단"을 찾으려고 보는 것이라 오래된 것부터 읽지 않는다.
    .order('created_at', { ascending: false })

  if (error !== null) {
    console.error('[inquiries] 내부 메모 조회 실패', error.message)

    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    authorNickname: row.author_nickname_snapshot,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    isMine: row.author_id === viewerId,
  }))
}

/** 폴링용 한 줄 조회. 실패하면 null — 화면은 마지막으로 받은 값을 그대로 둔다. */
export async function getInquiryCollabState(inquiryId: string): Promise<InquiryCollabState | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiries')
    .select(COLLAB_COLUMNS)
    .eq('id', inquiryId)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return {
    status: data.status,
    updatedAt: data.updated_at,
    replyCount: data.inquiry_replies[0]?.count ?? 0,
    /* 담당자·잠금 판정은 목록·상세와 **같은 함수**를 쓴다(`inquiry-refs.ts`) —
       폴링 응답만 만료 기준이 다르면 배너가 화면마다 다른 말을 한다. */
    assignee: toAdminRef(data.assigned_to, data.assignee),
    editing: toEditingRef(data.editing_by, data.editing_at, data.editor),
  }
}
