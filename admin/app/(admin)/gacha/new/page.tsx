import { GachaForm } from '@/components/gacha/GachaForm'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { requirePermission } from '@/lib/auth/require-admin'
import { firstValue } from '@/lib/utils/table-query'
import { DEFAULT_GACHA_TAB, isGachaTab } from '@/lib/validation/gacha'
import { kstDateTimeLocal } from '@/lib/validation/settings'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '새 확률형 아이템',
}

/* 게시일 기본값이 "지금"이라 정적으로 굳히면 안 된다. */
export const dynamic = 'force-dynamic'

export default async function NewGachaPage(props: PageProps<'/gacha/new'>) {
  await requirePermission('gacha', 'write')
  const searchParams = await props.searchParams
  const rawTab = firstValue(searchParams.tab) ?? ''
  const tab = isGachaTab(rawTab) ? rawTab : DEFAULT_GACHA_TAB

  return (
    <>
      <PageHeader
        title="새 확률형 아이템"
        description="저장하면 사용자 사이트의 가이드 목록에 그대로 나갑니다."
      />
      <Card>
        <CardBody>
          <GachaForm
            item={null}
            defaultTab={tab}
            publishedAtLocal={kstDateTimeLocal(new Date().toISOString())}
          />
        </CardBody>
      </Card>
    </>
  )
}
