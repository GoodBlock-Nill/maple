import 'server-only'

import { getSignedAttachments, toAttachments } from '@/lib/data/inquiries'
import { createClient } from '@/lib/supabase/server'

import type {
  InquiryAttachment,
  InquiryReply,
  InquiryReplyDirection,
  SignedInquiryAttachment,
} from '@/types/domain'

/**
 * 문의 대화 스레드(`inquiry_replies`) 조회.
 *
 * 문의 본문 쪽(`lib/data/inquiries.ts`)에서 떼어 낸 이유는 답장이 생기면서 이 함수만
 * 두 가지 일을 더 하게 됐기 때문이다 — 방향·작성자 판정과 **첨부 서명**. 한 파일에
 * 두면 "문의를 읽는 코드"와 "대화를 읽는 코드"가 섞여 어느 쪽 규칙인지 흐려진다.
 */

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const REPLY_COLUMNS = 'id, author_name, content, created_at, direction, author_id, attachments'

/** 저장된 값은 text 라 생성 타입도 `string` 이다. 모르는 값은 운영자 쪽으로 둔다. */
function toDirection(value: string): InquiryReplyDirection {
  return value === 'inbound' ? 'inbound' : 'outbound'
}

/**
 * 스레드 전체의 첨부를 **한 번에** 서명한다.
 *
 * 답변마다 `getSignedAttachments` 를 부르면 대화가 길어질수록 스토리지 왕복이
 * 그만큼 늘어난다. 경로는 버킷 안에서 유일하므로(업로드 때 uuid 를 붙인다) 한 번
 * 발급받아 경로로 되찾아 나눠 주면 결과가 같다.
 */
async function signThreadAttachments(
  attachments: readonly InquiryAttachment[],
): Promise<Map<string, SignedInquiryAttachment>> {
  const signed = await getSignedAttachments(attachments)

  return new Map(signed.map((attachment) => [attachment.path, attachment]))
}

/**
 * 문의의 대화(오래된 순).
 *
 * 답변을 못 읽었다고 문의 본문까지 감출 이유는 없어서 오류는 빈 목록으로 삼킨다.
 *
 * `userId` 를 받는 이유는 "내 답장"을 가려내기 위해서다. 방향만으로는 갈리지 않는다 —
 * 이메일로 들어온 회신도 `inbound` 이지만 작성자가 없다. 판정을 화면이 아니라 여기서
 * 하는 이유는 답장 가능 여부(`canUserReply`)가 같은 값을 세기 때문이다.
 */
export async function getInquiryReplies(
  inquiryId: string,
  userId: string,
): Promise<readonly InquiryReply[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inquiry_replies')
    .select(REPLY_COLUMNS)
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })

  if (error !== null) {
    return []
  }

  const rows = data.map((row) => ({ row, attachments: toAttachments(row.attachments) }))
  const signed = await signThreadAttachments(rows.flatMap((item) => item.attachments))

  return rows.map(({ row, attachments }) => ({
    id: row.id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
    direction: toDirection(row.direction),
    isMine: row.direction === 'inbound' && row.author_id !== null && row.author_id === userId,
    /* 서명에 실패한 항목도 목록에는 남긴다(이름만 보이고 링크가 없다). */
    attachments: attachments.map(
      (attachment) => signed.get(attachment.path) ?? { ...attachment, url: null },
    ),
  }))
}
