import { GachaImportPanel } from '@/components/gacha/GachaImportPanel'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { firstValue } from '@/lib/utils/table-query'
import { DEFAULT_GACHA_TAB, isGachaTab } from '@/lib/validation/gacha'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CSV 가져오기',
}

/**
 * 열 설명.
 *
 * 사용자 사이트가 실제로 그리는 값과 1:1 이다 — 카드(아이콘·확률·이름·갱신일)와
 * 상세표(rows). 열 하나가 어디에 보이는지 적어 두지 않으면 운영자는 매번
 * 사이트를 열어 대조해야 한다.
 */
const COLUMN_GUIDE: readonly { column: string; description: string }[] = [
  { column: 'id', description: '비우면 새로 만듭니다. 내보낸 파일을 고쳐 올릴 때는 그대로 둡니다.' },
  { column: 'tab', description: 'premium · cube · scroll (사이트의 탭)' },
  { column: 'name', description: '카드 제목' },
  { column: 'icon_url', description: '카드 아이콘. 비우면 사이트가 rows 첫 행 아이콘을 씁니다.' },
  { column: 'probability', description: '카드 확률(%). 0~100, 소수 셋째 자리까지(카드는 둘째 자리 표기).' },
  { column: 'is_published', description: 'true / false. false 면 사이트 목록에서 빠집니다.' },
  { column: 'published_at', description: '카드의 갱신일. 비우면 적용 시각.' },
  { column: 'rows', description: '상세표 JSON 배열 [{grade,itemName,itemIcon,probability,note}]' },
]

export default async function GachaImportPage(props: PageProps<'/gacha/import'>) {
  const searchParams = await props.searchParams
  const rawTab = firstValue(searchParams.tab) ?? ''
  const tab = isGachaTab(rawTab) ? rawTab : DEFAULT_GACHA_TAB

  return (
    <>
      <PageHeader
        title="CSV 가져오기"
        description="파일을 올리면 먼저 검사 결과를 보여 주고, 확인한 뒤에만 적용합니다."
        action={
          <Button href={`/gacha?tab=${tab}`} variant="secondary">
            목록으로
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="파일 선택"
          description="id 가 있으면 그 행을, 없으면 (탭, 이름)이 같은 행을 수정합니다. 둘 다 없으면 새로 만듭니다."
        />
        <CardBody>
          <GachaImportPanel tab={tab} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="열 구성" description="내보내기 파일과 같은 순서입니다." />
        <CardBody>
          <dl className="grid gap-2 text-[13px] md:grid-cols-2">
            {COLUMN_GUIDE.map((guide) => (
              <div key={guide.column} className="flex gap-2">
                <dt className="text-ink w-28 shrink-0 font-semibold">{guide.column}</dt>
                <dd className="text-muted">{guide.description}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </>
  )
}
