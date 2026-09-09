/* eslint-disable @next/next/no-img-element -- 이미지 주소는 Storage 공개 URL 과
   사용자 사이트의 정적 경로가 섞여 next/image 의 원격 패턴 밖이다. 관리자 화면의
   썸네일·미리보기라 최적화도 필요 없다. */
import { DeleteGachaButton } from '@/components/gacha/DeleteGachaButton'
import { GachaToolbar } from '@/components/gacha/GachaToolbar'
import { siteAssetSrc } from '@/components/settings/site-assets'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Table, type Column } from '@/components/ui/Table'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import {
  DEFAULT_GACHA_SORT,
  GACHA_SORT_KEYS,
  getGachaList,
  type GachaAdminItem,
} from '@/lib/data/gacha'
import { formatDateTime } from '@/lib/utils/format-date'
import {
  buildHref,
  DEFAULT_PAGE_SIZE,
  firstValue,
  parsePage,
  parseSort,
  sortHref,
  totalPages,
} from '@/lib/utils/table-query'
import { DEFAULT_GACHA_TAB, gachaTabLabel, isGachaTab } from '@/lib/validation/gacha'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '가이드',
}

/* 목록은 매 요청 최신 상태여야 한다. 공개 전환·삭제 직후 옛 목록이 보이면
   운영자가 같은 작업을 반복한다. */
export const dynamic = 'force-dynamic'

const PATH = '/gacha'

export default async function GachaPage(props: PageProps<'/gacha'>) {
  const { permissions } = await requirePermission('gacha', 'read')
  const canWrite = hasPermission(permissions, 'gacha', 'write')
  const searchParams = await props.searchParams
  const rawTab = firstValue(searchParams.tab) ?? ''
  const tab = isGachaTab(rawTab) ? rawTab : DEFAULT_GACHA_TAB
  const q = firstValue(searchParams.q) ?? ''
  const sort = parseSort(searchParams.sort, GACHA_SORT_KEYS, DEFAULT_GACHA_SORT)
  const page = parsePage(searchParams.page)

  const { items, count } = await getGachaList({ tab, q, sort, page })

  const columnDefs: (Column<GachaAdminItem> | null)[] = [
    {
      key: 'icon',
      header: '아이콘',
      className: 'w-20',
      cell: (row) => <ItemIcon url={row.iconUrl} name={row.name} />,
    },
    {
      key: 'name',
      header: '이름',
      sortKey: 'name',
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{row.name}</span>
          <span className="text-muted text-[12px]">확률표 {row.rows.length}행</span>
        </span>
      ),
    },
    {
      key: 'probability',
      header: '확률 %',
      sortKey: 'probability',
      align: 'right',
      className: 'w-28',
      cell: (row) => <span>{row.probability.toFixed(3)}</span>,
    },
    {
      key: 'published',
      header: '공개',
      align: 'center',
      className: 'w-24',
      cell: (row) =>
        row.isPublished ? <Badge tone="success">공개</Badge> : <Badge tone="neutral">비공개</Badge>,
    },
    {
      key: 'publishedAt',
      header: '게시일',
      sortKey: 'published_at',
      className: 'w-40',
      cell: (row) => <span className="text-muted">{formatDateTime(row.publishedAt)}</span>,
    },
    {
      key: 'updatedAt',
      header: '수정일',
      sortKey: 'updated_at',
      className: 'w-40',
      cell: (row) => <span className="text-muted">{formatDateTime(row.updatedAt)}</span>,
    },
    canWrite === false
      ? null
      : {
          key: 'actions',
          header: '',
          align: 'right',
          className: 'w-40',
          cell: (row) => (
            <span className="flex items-center justify-end gap-1.5">
              <Button href={`/gacha/${row.id}`} size="sm" variant="secondary">
                수정
              </Button>
              <DeleteGachaButton id={row.id} name={row.name} />
            </span>
          ),
        },
  ]

  const columns = columnDefs.filter((column): column is Column<GachaAdminItem> => column !== null)

  return (
    <>
      <PageHeader
        title="가이드"
        description="확률형 아이템 공시를 등록·수정합니다. 저장 즉시 사용자 사이트 가이드에 반영됩니다."
      />

      <GachaToolbar tab={tab} q={q} searchParams={searchParams} />

      <Card>
        <CardHeader
          title={`${gachaTabLabel(tab)} ${count}건`}
          description={q === '' ? undefined : `"${q}" 검색 결과`}
        />
        <Table
          columns={columns}
          rows={items}
          getRowKey={(row) => row.id}
          sort={sort}
          buildSortHref={(key) => sortHref(PATH, searchParams, sort, key)}
          caption="확률형 아이템 목록"
          emptyMessage="등록된 아이템이 없습니다."
        />
        <Pagination
          page={page}
          total={totalPages(count, DEFAULT_PAGE_SIZE)}
          buildHref={(target) => buildHref(PATH, searchParams, { page: String(target) })}
        />
      </Card>
    </>
  )
}

/**
 * 아이콘 미리보기.
 *
 * `next/image` 를 쓰지 않는다. 아이콘 주소는 Storage 공개 URL 일 수도, 사용자
 * 사이트의 정적 경로(`/images/guide/...`)일 수도 있는데 후자는 이 앱에 존재하지
 * 않아 최적화기가 404 를 낸다. 표의 32px 썸네일에 최적화는 필요하지도 않다.
 */
function ItemIcon({ url, name }: { url: string | null; name: string }) {
  if (url === null || url === '') {
    return <span className="bg-page rounded-panel block h-8 w-8" aria-hidden="true" />
  }

  return (
    <img
      src={siteAssetSrc(url)}
      alt={`${name} 아이콘`}
      width={32}
      height={32}
      className="rounded-panel h-8 w-8 object-contain"
    />
  )
}
