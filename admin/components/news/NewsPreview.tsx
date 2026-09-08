import { PREVIEW_PROSE_CLASS } from '@/components/editor/typography'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import {
  NEWS_VISIBILITY_LABEL,
  NEWS_VISIBILITY_TONE,
  newsCategoryLabel,
  newsCategoryTone,
} from '@/lib/constants/news'
import { renderPostHtml } from '@/lib/sanitize/render-post-html'
import { formatDate } from '@/lib/utils/format-date'

import type { NewsDetail } from '@/lib/data/news'

/**
 * 저장된 뉴스를 **사용자 사이트가 그리는 대로** 보여 주는 미리보기.
 *
 * 관리자에서 쓴 것과 독자가 보는 것 사이에 틈이 생기지 않게 하려고, 사용자 사이트의
 * 세 조각을 그대로 옮겼다.
 *  · 말머리 배너 (`components/board/NewsBanner.tsx`)
 *  · 상세 카드 머리 (`components/board/ArticleCard.tsx` — 뱃지 · 제목 · 메타)
 *  · 본문 타이포그래피 (`.prose-board` → `PREVIEW_PROSE_CLASS`)
 *
 * `dangerouslySetInnerHTML` 은 의도된 선택이다. 여기 오는 문자열은 저장 직전에
 * `sanitizePostHtml()` 을 통과한 값뿐이고, `renderPostHtml()` 이 영상 자리표시자를
 * 우리가 만든 iframe 으로 바꾼다 — 사용자 사이트의 `RichContent` 와 같은 계약이다.
 */

const BANNER_DIR = '/images/news/banners'

/** 사용자 사이트가 모르는 말머리는 공지사항 배너로 떨어진다(`getNewsBanner` 와 동일). */
const KNOWN_BANNERS = ['notice', 'maintenance', 'update', 'patch', 'event', 'info']

type NewsPreviewProps = {
  post: NewsDetail
  /** 배너 이미지는 사용자 사이트가 서빙한다. 관리자에는 `public/` 자체가 없다. */
  clientSiteUrl: string
}

export function NewsPreview({ post, clientSiteUrl }: NewsPreviewProps) {
  const bannerKey = KNOWN_BANNERS.includes(post.categoryKey) ? post.categoryKey : 'notice'
  const label = newsCategoryLabel(post.categoryKey)

  return (
    <Card>
      <CardHeader
        title="클라이언트 미리보기"
        description="저장된 내용을 사용자 사이트와 같은 서식으로 그립니다. 편집 중인 내용은 저장해야 반영됩니다."
        action={
          <Badge tone={NEWS_VISIBILITY_TONE[post.visibility]}>
            {NEWS_VISIBILITY_LABEL[post.visibility]}
          </Badge>
        }
      />

      <CardBody className="mx-auto w-full max-w-[860px] py-8">
        {/* next/image 를 쓰지 않는다: 배너 호스트는 환경마다 달라지는 사용자 사이트
            URL 이라 remotePatterns 에 못 박을 수 없다. 비율 고정 장식 이미지다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${clientSiteUrl}${BANNER_DIR}/${bannerKey}.png`}
          alt={`${label} 배너`}
          width={1200}
          height={628}
          className="rounded-card mb-6 aspect-[1200/628] w-full object-cover"
        />

        <header className="border-line flex flex-col gap-4 border-b pb-6">
          {/* 부모가 flex-col 이라 stretch 로 늘어난다. 뱃지는 글자 폭만 차지해야 한다. */}
          <Badge tone={newsCategoryTone(post.categoryKey)} className="self-start">
            {label}
          </Badge>
          <h2 className="text-ink text-[clamp(22px,3vw,32px)] leading-[1.35] font-semibold tracking-[-0.5px]">
            {post.title}
          </h2>
          <p className="text-ink flex items-center gap-3 text-[16px] leading-[19px] font-medium">
            <span>{formatDate(post.publishedAt)}</span>
            <span>조회 {post.viewCount.toLocaleString('ko-KR')}</span>
          </p>
        </header>

        <div
          className={`${PREVIEW_PROSE_CLASS} pt-8`}
          dangerouslySetInnerHTML={{ __html: renderPostHtml(post.content) }}
        />

        {post.summary !== '' && (
          <p className="border-line text-muted mt-8 border-t pt-4 text-[13px]">
            <strong className="text-ink font-semibold">요약</strong> — 본문에는 보이지 않습니다.
            검색 결과·공유 카드의 설명으로만 쓰입니다: {post.summary}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
