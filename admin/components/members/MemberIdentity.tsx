import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format-date'
import {
  lifecycleLabel,
  MEMBER_LIFECYCLE_LABEL,
  memberLifecycle,
} from '@/lib/validation/member-status'
import {
  isPermanentSuspension,
  isSuspended,
  maskEmail,
  MEMBER_STATUS_LABEL,
  memberStatus,
  providerLabel,
} from '@/lib/validation/members'

import type { BadgeTone } from '@/components/ui/Badge'
import type { UserRole } from '@/lib/supabase/types'
import type { LifecycleSource } from '@/lib/validation/member-status'
import type { MemberStatus } from '@/lib/validation/members'

const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  normal: 'success',
  suspended: 'danger',
  admin: 'accent',
}

/* 공급자 색은 브랜드 색이 아니라 대비만 맞춘 중립 톤이다. 목록에서 여러 개가
   나란히 놓이므로 브랜드 색을 그대로 쓰면 표가 알록달록해져 상태 뱃지가 묻힌다. */
const PROVIDER_MARK: Record<string, string> = {
  kakao: 'bg-warn-soft text-warn',
  google: 'bg-page text-muted',
  naver: 'bg-success-soft text-success',
}

/**
 * 아바타 · 닉네임 · 공급자 마크.
 *
 * 소셜 아바타(카카오·구글 CDN)는 `next.config.ts` 의 remotePatterns 에 없어
 * `next/image` 로 그리면 400 이 난다. 목록에서는 첫 글자와 공급자 마크로 충분하므로
 * 원격 이미지를 아예 요청하지 않는다.
 */
export function MemberIdentity({
  nickname,
  provider,
  href,
}: {
  nickname: string
  provider: string | null
  href?: string
}) {
  const mark = PROVIDER_MARK[provider ?? ''] ?? 'bg-page text-muted'

  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="bg-accent-soft text-accent-strong flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
      >
        {nickname.charAt(0)}
      </span>
      <span className="flex flex-col gap-0.5">
        {href === undefined ? (
          <span className="font-semibold">{nickname}</span>
        ) : (
          <Link
            href={href}
            className="focus-visible:outline-focus rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {nickname}
          </Link>
        )}
        <span className={cn('rounded-pill w-fit px-1.5 text-[11px] font-semibold', mark)}>
          {providerLabel(provider)}
        </span>
      </span>
    </span>
  )
}

/**
 * 마스킹된 이메일.
 *
 * 원문은 `title` 로만 남긴다 — 이 화면에 들어온 사람은 이미 관리자이므로 접근
 * 권한 문제는 아니고, 한 화면에 20명분 원문이 떠 있는 상황만 피하는 것이 목적이다.
 */
export function MaskedEmail({ email }: { email: string | null }) {
  return (
    <span className="text-muted" title={email ?? undefined}>
      {maskEmail(email)}
    </span>
  )
}

/** 정상 / 정지(~까지) / 관리자. */
export function MemberStatusBadge({
  role,
  suspendedUntil,
}: {
  role: UserRole
  suspendedUntil: string | null
}) {
  const status = memberStatus({ role, suspendedUntil })

  if (status !== 'suspended') {
    return <Badge tone={STATUS_TONE[status]}>{MEMBER_STATUS_LABEL[status]}</Badge>
  }

  return <SuspensionBadge suspendedUntil={suspendedUntil} />
}

function SuspensionBadge({ suspendedUntil }: { suspendedUntil: string | null }) {
  return (
    <Badge tone="danger">
      정지 {isPermanentSuspension(suspendedUntil) ? '영구' : `~${formatDate(suspendedUntil)}`}
    </Badge>
  )
}

/**
 * 상태 칸 — 생애주기(정상 · 탈퇴 대기 · 삭제됨)와 제재를 함께 그린다.
 *
 * **파기가 탈퇴를 이긴다**(`member-status.ts` 참고). 파기된 계정은 제재가 이미
 * 비워져 있고 로그인 계정도 없으므로 뱃지를 하나만 세운다 — 남은 제재가 있는
 * 것처럼 보이면 운영자가 해제할 수 있다고 오해한다.
 *
 * 탈퇴 대기는 제재를 **두 번째 뱃지**로 덧붙인다. 탈퇴해도 제재는 유지되고
 * (복구하면 그대로 적용된다), 그 사실이 목록에서 보이지 않으면 "탈퇴하면 제재가
 * 풀린다"는 잘못된 기대가 생긴다.
 */
export function MemberStatusBadges({
  role,
  suspendedUntil,
  deletedAt,
  purgedAt,
}: {
  role: UserRole
  suspendedUntil: string | null
} & LifecycleSource) {
  const lifecycle = memberLifecycle({ deletedAt, purgedAt })

  if (lifecycle === 'purged') {
    return <Badge tone="muted">{MEMBER_LIFECYCLE_LABEL.purged}</Badge>
  }

  if (lifecycle === 'active') {
    return <MemberStatusBadge role={role} suspendedUntil={suspendedUntil} />
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge tone="warn">{lifecycleLabel({ deletedAt, purgedAt })}</Badge>
      {isSuspended(suspendedUntil) && <SuspensionBadge suspendedUntil={suspendedUntil} />}
    </span>
  )
}
