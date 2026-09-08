import { MemberIdentity, MemberStatusBadge } from '@/components/members/MemberIdentity'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format-date'
import { isPermanentSuspension, isSuspended, maskEmail } from '@/lib/validation/members'

import type { MemberProfile } from '@/lib/data/members'
import type { ReactNode } from 'react'

/**
 * 회원 프로필 카드 — 컬럼을 숨기지 않고 전부 보여 준다.
 *
 * 운영자가 문의를 처리할 때 필요한 값(MSW UID·프로필 코드·동의 시각)이 화면에 없으면
 * 결국 DB 콘솔을 열게 되고, 그 순간 감사 로그가 남지 않는 경로가 생긴다.
 */
export function MemberProfileCard({
  member,
  actions,
}: {
  member: MemberProfile
  actions: ReactNode
}) {
  /* 현재 시각 비교는 헬퍼에 맡긴다. 컴포넌트 본문에서 `Date.now()` 를 직접 부르면
     렌더가 순수하지 않게 되고(react-hooks/purity) 값이 렌더마다 흔들린다. */
  const suspended = isSuspended(member.suspendedUntil)

  return (
    <Card className="mb-5">
      <CardHeader
        title={
          <MemberIdentity nickname={member.nickname} provider={member.provider} />
        }
        description={
          <span className="flex items-center gap-2">
            <MemberStatusBadge role={member.role} suspendedUntil={member.suspendedUntil} />
            <span title={member.email ?? undefined}>{maskEmail(member.email)}</span>
          </span>
        }
        action={actions}
      />

      <CardBody className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="회원 ID" value={member.id} mono />
        <Field label="가입일" value={formatDateTime(member.createdAt)} />
        <Field label="최근 수정" value={formatDateTime(member.updatedAt)} />
        <Field label="가입 방식" value={member.provider ?? 'email'} />
        <Field label="공급자 ID" value={member.providerId ?? '-'} mono />
        <Field label="권한" value={member.role === 'admin' ? '관리자' : '일반 사용자'} />
        <Field label="MSW UID" value={member.mswUid ?? '-'} mono />
        <Field label="MSW 프로필 코드" value={member.mswProfileCode ?? '-'} mono />
        <Field label="이용약관 동의" value={formatDateTime(member.termsAgreedAt)} />
        <Field label="개인정보 동의" value={formatDateTime(member.privacyAgreedAt)} />
        <Field label="만 14세 확인" value={formatDateTime(member.ageConfirmedAt)} />
        <Field
          label="정지 종료"
          value={
            member.suspendedUntil === null
              ? '-'
              : isPermanentSuspension(member.suspendedUntil)
                ? '영구'
                : formatDateTime(member.suspendedUntil)
          }
          tone={suspended ? 'danger' : 'default'}
        />
        <Field
          label="정지 사유"
          value={member.suspensionReason ?? '-'}
          tone={suspended ? 'danger' : 'default'}
          className="sm:col-span-2"
        />
      </CardBody>
    </Card>
  )
}

function Field({
  label,
  value,
  mono = false,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  mono?: boolean
  tone?: 'default' | 'danger'
  className?: string
}) {
  /* `<dl>` 이 아니라 div/p 로 그린다 — CardBody 가 `<div>` 라 dt/dd 를 직접 넣으면
     문서 구조가 깨진다(dl 자식이 아닌 dt 는 유효하지 않다). */
  return (
    <div className={className}>
      <p className="text-muted text-[12px] font-semibold">{label}</p>
      <p
        className={cn(
          'text-[13px] break-all',
          mono && 'font-mono',
          tone === 'danger' ? 'text-danger font-semibold' : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  )
}
