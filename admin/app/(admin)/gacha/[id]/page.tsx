import { notFound } from 'next/navigation'

import { GachaForm } from '@/components/gacha/GachaForm'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { requirePermission } from '@/lib/auth/require-admin'
import { getGachaItem } from '@/lib/data/gacha'
import { formatDateTime } from '@/lib/utils/format-date'
import { gachaTabLabel } from '@/lib/validation/gacha'
import { kstDateTimeLocal } from '@/lib/validation/settings'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '확률형 아이템 수정',
}

export const dynamic = 'force-dynamic'

export default async function EditGachaPage(props: PageProps<'/gacha/[id]'>) {
  await requirePermission('gacha', 'write')
  const { id } = await props.params
  const item = await getGachaItem(id)

  if (item === null) {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${gachaTabLabel(item.tab)} · 최종 수정 ${formatDateTime(item.updatedAt)}`}
      />
      <Card>
        <CardBody>
          <GachaForm
            item={item}
            defaultTab={item.tab}
            publishedAtLocal={kstDateTimeLocal(item.publishedAt)}
          />
        </CardBody>
      </Card>
    </>
  )
}
