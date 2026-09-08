import type { ReactNode } from 'react'

/**
 * 사용자 사이트 연동 현황.
 *
 * `site_settings` 에는 열이 있지만 사용자 사이트가 아직 **상수를 쓰는 값**이 섞여
 * 있다. 그 사실을 화면에 적어 두지 않으면 운영자는 저장해 놓고 "사이트가 안 바뀐다"
 * 고 계속 되묻게 된다. 각 필드에 어디가 읽는지(또는 어느 파일을 고쳐야 하는지)를
 * 그대로 붙인다.
 *
 * 사용자 사이트 코드를 여기서 고치지는 않는다 — 이 표가 그 작업 목록이다.
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
    isLive: false,
    where:
      '푸터는 components/layout/SiteFooter.tsx 가 lib/constants/site.ts 의 CONTACT_EMAIL 상수를 씁니다.',
  },
  ipNotice: {
    isLive: false,
    where:
      '약관 화면은 app/(public)/policy/[slug]/page.tsx 가 lib/constants/site.ts 의 IP_NOTICE 상수를 씁니다.',
  },
  copyright: {
    isLive: false,
    where: '푸터의 저작권 문구는 components/layout/SiteFooter.tsx 에 하드코딩돼 있습니다.',
  },
  creatorName: { isLive: false, where: '소개 화면은 lib/mock/site.ts 의 CREATOR_NAME 을 씁니다.' },
  creatorSlogan: {
    isLive: false,
    where: '소개 화면은 lib/mock/site.ts 의 CREATOR_SLOGAN 을 씁니다.',
  },
  creatorIntro: {
    isLive: false,
    where: '소개 화면은 lib/mock/site.ts 의 CREATOR_INTRO 를 씁니다.',
  },
  creatorPhotoUrl: {
    isLive: false,
    where: '소개 화면의 사진은 components/about/CreatorPanel.tsx 의 PHOTO_SRC 상수입니다.',
  },
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
