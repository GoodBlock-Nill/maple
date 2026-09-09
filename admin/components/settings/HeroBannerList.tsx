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
import { youtubeThumbnailUrl } from '@/lib/utils/youtube'

import type { HeroBannerRecord } from '@/lib/data/settings'

/**
 * 히어로 배너 목록.
 *
 * 사용자 사이트의 **소개 화면 상단 영역**은 노출 중인 배너 중 첫 번째 한 장을 읽는다 —
 * `sort_order` 오름차순, 노출 기간 안(`starts_at` ~ `ends_at`), `is_active` 인 것.
 * 그래서 이 목록의 맨 위가 곧 홈에 걸리는 배너이고, ↑ ↓ 버튼이 그것을 고르는
 * 수단이다. 아직 슬라이더는 없으므로 두 번째부터는 대기 상태다.
 *
 * 미디어 유형에 따라 썸네일이 갈린다 — 영상 배너는 유튜브 썸네일에 "영상" 표를
 * 달고, 이미지 배너는 등록한 그림을 그대로 보여 준다.
 */
export function HeroBannerList({ banners }: { banners: readonly HeroBannerRecord[] }) {
  if (banners.length === 0) {
    return (
      <EmptyState
        title="등록된 배너가 없습니다."
        description="이미지 한 장 또는 유튜브 영상을 등록할 수 있습니다. 맨 위의 노출 중인 배너가 소개 화면 상단(영상 영역)에 걸립니다. 없으면 사이트 설정의 유튜브 영상이 나옵니다."
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
          <BannerThumb banner={banner} />

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

function BannerThumb({ banner }: { banner: HeroBannerRecord }) {
  /* 영상 배너는 유튜브 썸네일을 먼저 쓰고, 주소를 알아볼 수 없으면 포스터로 물러난다. */
  const url =
    banner.mediaType === 'youtube' && banner.youtubeId !== null
      ? youtubeThumbnailUrl(banner.youtubeId)
      : siteAssetSrc(banner.imageUrl ?? '')

  return (
    <span className="relative block h-12 w-20 shrink-0">
      {url === '' ? (
        <span className="bg-page rounded-panel block h-full w-full" aria-hidden="true" />
      ) : (
        <img
          src={url}
          alt={`${banner.title} 배너`}
          className="rounded-panel h-full w-full object-cover"
        />
      )}

      {banner.mediaType === 'youtube' && (
        <Badge
          tone="accent"
          className="absolute bottom-0.5 left-0.5 px-1 py-0 text-[10px] leading-4"
        >
          영상
        </Badge>
      )}
    </span>
  )
}
