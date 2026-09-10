import Link from 'next/link'

import { MemberField } from '@/components/members/MemberField'
import { MemberIdentity, MemberStatusBadges } from '@/components/members/MemberIdentity'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/utils/format-date'
import { memberLifecycle } from '@/lib/validation/member-status'
import { isPermanentSuspension, isSuspended, maskEmail } from '@/lib/validation/members'

import type { MemberProfile } from '@/lib/data/members'
import type { ReactNode } from 'react'

/**
 * 회원 프로필 카드 — 컬럼을 숨기지 않고 전부 보여 준다.
 *
 * 운영자가 문의를 처리할 때 필요한 값(MSW UID·프로필 코드·동의 시각)이 화면에 없으면
 * 결국 DB 콘솔을 열게 되고, 그 순간 감사 로그가 남지 않는 경로가 생긴다.
 *
 * **예외는 개인정보가 파기된 계정뿐이다.** 이메일·공급자 ID·월드 계정 칸은 아예
 * 그리지 않는다 — 값이 비어 있는 칸을 남겨 두면 "조회에 실패했나?"로 읽히고,
 * 혹시 남아 있는 값이 있다면 파기의 취지에 어긋난다.
 */
export function MemberProfileCard({
  member,
  actions,
  couponCount = null,
}: {
  member: MemberProfile
  actions: ReactNode
  /** 쿠폰 등록 건수. 집계가 깨졌거나 권한이 없으면 `null` 이고 칸을 그리지 않는다. */
  couponCount?: number | null
}) {
  /* 현재 시각 비교는 헬퍼에 맡긴다. 컴포넌트 본문에서 `Date.now()` 를 직접 부르면
     렌더가 순수하지 않게 되고(react-hooks/purity) 값이 렌더마다 흔들린다. */
  const suspended = isSuspended(member.suspendedUntil)
  const isPurged = memberLifecycle(member) === 'purged'

  return (
    <Card className="mb-5">
      <CardHeader
        title={<MemberIdentity nickname={member.nickname} provider={member.provider} />}
        description={
          <span className="flex items-center gap-2">
            <MemberStatusBadges
              role={member.role}
              suspendedUntil={member.suspendedUntil}
              deletedAt={member.deletedAt}
              purgedAt={member.purgedAt}
            />
            {!isPurged && <span title={member.email ?? undefined}>{maskEmail(member.email)}</span>}
          </span>
        }
        action={actions}
      />

      <CardBody className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        <MemberField label="회원 ID" value={member.id} mono />
        {/* 이름은 본인이 마이페이지에서 적는 선택 항목이다. 파기된 계정에서는 지워진다. */}
        {!isPurged && <MemberField label="이름" value={member.name ?? '-'} />}
        <MemberField label="가입일" value={formatDateTime(member.createdAt)} />
        <MemberField label="최근 수정" value={formatDateTime(member.updatedAt)} />
        <MemberField label="가입 방식" value={member.provider ?? 'email'} />
        {!isPurged && <MemberField label="공급자 ID" value={member.providerId ?? '-'} mono />}
        <MemberField label="권한" value={member.role === 'admin' ? '관리자' : '일반 사용자'} />
        {!isPurged && (
          <>
            <MemberField label="MSW UID" value={<MswValue value={member.mswUid} />} mono />
            <MemberField
              label="MSW 프로필 코드"
              value={<MswValue value={member.mswProfileCode} />}
              mono
            />
          </>
        )}
        {!isPurged && (
          <MemberField
            label="마케팅 수신거부"
            value={
              <OptOutValue sms={member.marketingSmsOptOut} email={member.marketingEmailOptOut} />
            }
          />
        )}
        {/* 쿠폰 등록 건수. `/coupons` 는 쿠폰 목록이라 회원으로 좁힐 자리가 없다 —
            링크 대신 숫자만 두고, 상세는 쿠폰별 화면에서 본다. */}
        {couponCount !== null && (
          <MemberField label="쿠폰 등록" value={`${couponCount.toLocaleString('ko-KR')}건`} />
        )}
        <MemberField label="이용약관 동의" value={formatDateTime(member.termsAgreedAt)} />
        <MemberField label="개인정보 동의" value={formatDateTime(member.privacyAgreedAt)} />
        <MemberField label="만 14세 확인" value={formatDateTime(member.ageConfirmedAt)} />
        <MemberField
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
        <MemberField
          label="정지 사유"
          value={member.suspensionReason ?? '-'}
          tone={suspended ? 'danger' : 'default'}
          className="sm:col-span-2"
        />
      </CardBody>
    </Card>
  )
}

/**
 * 마케팅 수신거부 두 칸.
 *
 * `false / false` 를 "-" 로 두면 "설정한 적 없음"과 "수신 동의"가 같은 모양이 된다.
 * 광고성 정보 수신 여부는 분쟁이 나는 값이라, 지금 상태를 늘 말로 적는다.
 * 값을 바꾸는 주체는 본인뿐이므로 이 카드에서는 읽기 전용이다.
 */
function OptOutValue({ sms, email }: { sms: boolean; email: boolean }) {
  if (!sms && !email) {
    return <span className="text-muted">없음 (SMS · 이메일 모두 수신)</span>
  }

  return <span>{[sms ? 'SMS' : null, email ? '이메일' : null].filter(Boolean).join(' · ')}</span>
}

/**
 * 월드 계정 값 + 중복 검색 링크.
 *
 * 유니크 인덱스가 붙은 뒤에는 새 중복이 생기지 않지만, 제약 이전에 들어온 과거
 * 데이터는 그대로 남아 있다. 목록을 UID 로 좁혀 볼 수 있어야 점검이 끝난다.
 */
function MswValue({ value }: { value: string | null }) {
  if (value === null || value === '') {
    return '-'
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {value}
      <Link
        href={`/members?msw=${encodeURIComponent(value)}`}
        className="text-accent-strong focus-visible:outline-focus rounded-sm font-sans text-[12px] font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        중복 검색
      </Link>
    </span>
  )
}
