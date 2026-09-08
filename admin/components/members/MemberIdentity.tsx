import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/format-date'
import {
  isPermanentSuspension,
  maskEmail,
  MEMBER_STATUS_LABEL,
  memberStatus,
  providerLabel,
} from '@/lib/validation/members'

import type { BadgeTone } from '@/components/ui/Badge'
import type { UserRole } from '@/lib/supabase/types'
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

  return (
    <Badge tone="danger">
      정지 {isPermanentSuspension(suspendedUntil) ? '영구' : `~${formatDate(suspendedUntil)}`}
    </Badge>
  )
}
