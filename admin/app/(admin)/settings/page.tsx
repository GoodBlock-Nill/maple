import { HeroBannerDialog } from '@/components/settings/HeroBannerDialog'
import { HeroBannerList } from '@/components/settings/HeroBannerList'
import { SiteSettingsForm } from '@/components/settings/SiteSettingsForm'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { getHeroBanners, getSiteSettings } from '@/lib/data/settings'
import { clientSiteUrl } from '@/lib/supabase/env'
import { formatDateTime } from '@/lib/utils/format-date'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '사이트 설정',
}

export const dynamic = 'force-dynamic'

/** 저장한 값을 곧바로 확인할 수 있는 사용자 사이트 화면. */
const PREVIEW_LINKS: readonly { href: string; label: string }[] = [
  { href: '/', label: '홈' },
  { href: '/about', label: '소개' },
  { href: '/play', label: '/play 리다이렉트' },
  { href: '/discord', label: '/discord 리다이렉트' },
]

export default async function SettingsPage() {
  const [settings, banners] = await Promise.all([getSiteSettings(), getHeroBanners()])
  const siteUrl = clientSiteUrl()

  return (
    <>
      <PageHeader
        title="사이트 설정"
        description="사용자 사이트 전역에 쓰이는 값입니다. 필드마다 실제 연동 여부를 표시합니다."
        action={
          <span className="flex flex-wrap items-center gap-2">
            {PREVIEW_LINKS.map((link) => (
              <a
                key={link.href}
                href={`${siteUrl}${link.href}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent-strong focus-visible:outline-focus rounded-sm text-[13px] font-semibold hover:underline focus-visible:outline-2"
              >
                {link.label} ↗
              </a>
            ))}
          </span>
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="기본 정보"
          description={
            settings === null
              ? '아직 설정 행이 없습니다. 저장하면 새로 만듭니다.'
              : `최종 수정 ${formatDateTime(settings.updatedAt)}`
          }
        />
        <CardBody>
          <SiteSettingsForm settings={settings} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              히어로 배너
              <Badge tone="success">사이트 반영</Badge>
            </span>
          }
          description="소개 화면(/about) 상단 영상 영역에 노출 중인 첫 번째 배너 한 장이 걸립니다. 배너가 없으면 위 기본 정보의 유튜브 주소 영상이 나옵니다. 저장 즉시 사용자 사이트에 반영됩니다."
          action={
            banners.length === 0 ? undefined : (
              <HeroBannerDialog banner={null} nextSortOrder={banners.length} trigger="배너 추가" />
            )
          }
        />
        <CardBody>
          <HeroBannerList banners={banners} />
        </CardBody>
      </Card>
    </>
  )
}
