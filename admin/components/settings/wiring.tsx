import type { ReactNode } from 'react'

/**
 * 사용자 사이트 연동 현황.
 *
 * 2026-09-09 기준 모든 필드가 사용자 사이트에 연동돼 있다(푸터·소개·정책·메타).
 * 표는 "어디에 보이는지"를 운영자에게 알려 주는 용도로 남긴다. 새 열을 추가했는데
 * 사용자 사이트가 아직 읽지 않으면 `isLive: false` 로 넣어 그 사실을 드러낸다.
 */

export type FieldWiring = {
  isLive: boolean
  /** LIVE 면 어디에 보이는지, 미연동이면 어느 파일을 고쳐야 하는지. */
  where: string
}

export const SETTINGS_WIRING: Record<string, FieldWiring> = {
  gameName: { isLive: true, where: 'app/layout.tsx 의 메타데이터(제목·OG)' },
  worldId: { isLive: true, where: 'app/(public)/play/route.ts 의 /play 리다이렉트' },
  discordUrl: { isLive: true, where: '/discord · /sns/discord 리다이렉트' },
  youtubeUrl: { isLive: true, where: '/sns/youtube 리다이렉트' },
  contactEmail: {
    isLive: true,
    where: '홈·전체 푸터의 이메일 버튼(components/layout/SiteFooter.tsx)',
  },
  ipNotice: { isLive: true, where: '개인정보처리방침 하단 지식재산권 고지(/policy/privacy)' },
  copyright: { isLive: true, where: '푸터 하단 저작권 한 줄(components/layout/SiteFooter.tsx)' },
  creatorName: { isLive: true, where: '소개 화면 양피지 패널의 큰 제목(/about)' },
  creatorSlogan: { isLive: true, where: '소개 화면 패널의 주황색 한 줄(/about)' },
  creatorIntro: { isLive: true, where: '소개 화면 패널 본문(/about)' },
  creatorPhotoUrl: { isLive: true, where: '소개 화면 패널의 크리에이터 사진(/about)' },
}

/** 필드 오른쪽 위의 작은 태그. 라벨 줄과 같은 높이에 놓인다. */
export function WiringTag({ field }: { field: string }) {
  const wiring = SETTINGS_WIRING[field]

  if (wiring === undefined) {
    return null
  }

  return (
    <span
      title={wiring.where}
      className={
        wiring.isLive
          ? 'text-success bg-success-soft rounded-pill absolute top-0 right-0 px-1.5 py-0.5 text-[11px] font-semibold'
          : 'text-muted bg-page border-line rounded-pill absolute top-0 right-0 border px-1.5 py-0.5 text-[11px] font-semibold'
      }
    >
      {wiring.isLive ? '사이트 반영' : '미연동'}
    </span>
  )
}

/** 태그를 얹기 위한 상대 위치 래퍼. 하단에 연동 위치 설명을 한 줄 덧붙인다. */
export function WiredField({ field, children }: { field: string; children: ReactNode }) {
  const wiring = SETTINGS_WIRING[field]

  return (
    <div className="relative flex flex-col">
      <WiringTag field={field} />
      {children}
      {wiring !== undefined && !wiring.isLive && (
        <p className="text-muted mt-1 text-[11px] leading-relaxed">{wiring.where}</p>
      )}
    </div>
  )
}
