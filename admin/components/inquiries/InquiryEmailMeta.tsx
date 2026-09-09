import { MetaList, MetaRow } from '@/components/inquiries/InquiryMetaRow'
import { Badge, type BadgeTone } from '@/components/ui'
import { formatDateTime } from '@/lib/utils/format-date'
import { inquiryCategoryLabel, inquiryTypeLabel } from '@/lib/validation/inquiries'

import type { InquiryEmailAuth, InquiryDetail } from '@/lib/data/inquiries'

/**
 * 이메일 문의의 메타 정보.
 *
 * 계정 ID·작성자 링크는 **일부러 없다.** 발신자 주소는 회원 식별에 쓰지 않기로 했고
 * (`user_id` 를 채우지 않는다 — 사칭 위험, EMAIL-INQUIRY-PLAN §8), 그 자리에 회원
 * 화면으로 가는 링크가 있으면 운영자가 발신자를 회원으로 확정해 버린다.
 *
 * 대신 답신 전에 판단해야 할 것을 보여 준다 — 누가 보냈는지(From), 어느 메일에
 * 이어지는지(Message-ID), 그 메일을 믿을 수 있는지(SPF · DKIM · DMARC).
 */
export function InquiryEmailMeta({ inquiry }: { inquiry: InquiryDetail }) {
  return (
    <MetaList>
      <MetaRow label="From">{formatSender(inquiry)}</MetaRow>
      <MetaRow label="원본 Message-ID">
        {inquiry.emailMessageId === null ? (
          '-'
        ) : (
          /* 잘라서 보여 주되 원문은 title 로 남긴다 — 제공자 문의 때 그대로 필요하다. */
          <span title={inquiry.emailMessageId} className="block truncate font-mono text-[12px]">
            {inquiry.emailMessageId}
          </span>
        )}
      </MetaRow>
      {/* 수신 함수가 'email' · 'general' 로 고정해 넣는다 — 영문 값이 그대로 보이지 않게 한다. */}
      <MetaRow label="카테고리 · 유형">
        {`${inquiryCategoryLabel(inquiry.category)} · ${inquiryTypeLabel(inquiry.type)}`}
      </MetaRow>
      <MetaRow label="수신 시각">{formatDateTime(inquiry.createdAt)}</MetaRow>
      <MetaRow label="인증">
        <span className="flex flex-wrap gap-1.5">
          <AuthChip name="SPF" verdict={inquiry.emailAuth?.spf ?? null} />
          <AuthChip name="DKIM" verdict={inquiry.emailAuth?.dkim ?? null} />
          <AuthChip name="DMARC" verdict={inquiry.emailAuth?.dmarc ?? null} />
        </span>
      </MetaRow>
      <MetaRow label="최근 업데이트">{formatDateTime(inquiry.updatedAt)}</MetaRow>
      {inquiry.answeredAt !== null && (
        <MetaRow label="첫 답변">{formatDateTime(inquiry.answeredAt)}</MetaRow>
      )}
    </MetaList>
  )
}

/** `이름 <주소>`. 이름이 없으면 주소만 — 괄호만 남은 문자열은 오히려 읽기 어렵다. */
function formatSender(inquiry: Pick<InquiryDetail, 'emailFrom' | 'emailFromName'>): string {
  const address = inquiry.emailFrom ?? '(발신자 없음)'

  return inquiry.emailFromName === null ? address : `${inquiry.emailFromName} <${address}>`
}

/* 판정이 없는 것(`none`·null)은 실패가 아니다. 레코드를 두지 않은 정상 도메인까지
   경고색으로 칠하면 뱃지가 곧 의미를 잃는다. */
function toneFor(verdict: string | null): BadgeTone {
  if (verdict === 'pass') {
    return 'success-green'
  }

  return verdict === 'fail' ? 'warn' : 'neutral'
}

function AuthChip({
  name,
  verdict,
}: {
  name: string
  verdict: InquiryEmailAuth[keyof InquiryEmailAuth]
}) {
  return <Badge tone={toneFor(verdict)}>{`${name} ${verdict ?? '판정 없음'}`}</Badge>
}
