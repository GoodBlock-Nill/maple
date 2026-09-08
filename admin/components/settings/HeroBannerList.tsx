'use client'

/* eslint-disable @next/next/no-img-element -- 이미지 주소는 Storage 공개 URL 과
   사용자 사이트의 정적 경로가 섞여 next/image 의 원격 패턴 밖이다. 관리자 화면의
   썸네일·미리보기라 최적화도 필요 없다. */
import { BannerActionButton } from '@/components/settings/BannerActionButton'
import { HeroBannerDialog } from '@/components/settings/HeroBannerDialog'
import { siteAssetSrc } from '@/components/settings/site-assets'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  deleteHeroBannerAction,
  moveHeroBannerAction,
  toggleHeroBannerAction,
} from '@/lib/actions/settings-actions'
import { formatDateTime } from '@/lib/utils/format-date'

import type { HeroBannerRecord } from '@/lib/data/settings'

/**
 * 히어로 배너 목록.
 *
 * **사용자 사이트는 아직 이 표를 읽지 않는다** — 홈에 배너 슬라이더가 없다.
 * 그래서 화면도 최소한으로 둔다(추가·수정·순서·노출·삭제). 슬라이더가 붙을 때
 * 필요한 값(제목·부제·이미지·링크·버튼 문구·기간)은 지금 다 받아 둔다.
 */
export function HeroBannerList({ banners }: { banners: readonly HeroBannerRecord[] }) {
  if (banners.length === 0) {
    return (
      <EmptyState
        title="등록된 배너가 없습니다."
        description="배너를 추가해 두면 사용자 사이트에 슬라이더가 붙는 즉시 노출됩니다."
        action={<HeroBannerDialog banner={null} nextSortOrder={0} trigger="배너 추가" />}
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {banners.map((banner, index) => (
        <li
          key={banner.id}
          className="border-line rounded-panel flex flex-wrap items-center gap-3 border p-3"
        >
          <BannerThumb url={banner.imageUrl} title={banner.title} />

          <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-ink text-[14px] font-bold">{banner.title}</span>
              {banner.isActive ? (
                <Badge tone="success">노출</Badge>
              ) : (
                <Badge tone="neutral">숨김</Badge>
              )}
            </span>
            {banner.subtitle !== null && (
              <span className="text-muted text-[12px]">{banner.subtitle}</span>
            )}
            <span className="text-muted text-[12px]">
              기간 {banner.startsAt === null ? '제한 없음' : formatDateTime(banner.startsAt)} ~{' '}
              {banner.endsAt === null ? '제한 없음' : formatDateTime(banner.endsAt)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <BannerActionButton
              action={moveHeroBannerAction}
              fields={{ id: banner.id, direction: 'up' }}
              label="↑"
              ariaLabel={`${banner.title} 위로`}
              disabled={index === 0}
            />
            <BannerActionButton
              action={moveHeroBannerAction}
              fields={{ id: banner.id, direction: 'down' }}
              label="↓"
              ariaLabel={`${banner.title} 아래로`}
              disabled={index === banners.length - 1}
            />
            <BannerActionButton
              action={toggleHeroBannerAction}
              fields={{ id: banner.id, isActive: banner.isActive ? 'false' : 'true' }}
              label={banner.isActive ? '숨기기' : '노출'}
            />
            <HeroBannerDialog banner={banner} nextSortOrder={banner.sortOrder} trigger="수정" />
            <BannerActionButton
              action={deleteHeroBannerAction}
              fields={{ id: banner.id }}
              label="삭제"
              variant="danger"
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function BannerThumb({ url, title }: { url: string; title: string }) {
  if (url === '') {
    return <span className="bg-page rounded-panel block h-12 w-20" aria-hidden="true" />
  }

  return (
    <img
      src={siteAssetSrc(url)}
      alt={`${title} 배너`}
      className="rounded-panel h-12 w-20 object-cover"
    />
  )
}
