import { InquiryFilters } from '@/components/inquiries/InquiryFilters'
import { InquiryTable } from '@/components/inquiries/InquiryTable'
import { FormBanner, PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { INQUIRY_SORT_KEYS, getInquiries, getInquiryTabCounts } from '@/lib/data/inquiries'
import { parsePage, parseSort } from '@/lib/utils/table-query'
import { parseInquiryFilters } from '@/lib/validation/inquiries'

import type { InquirySource } from '@/lib/validation/inquiries'
import type { Metadata } from 'next'

/* 문의는 사용자가 실시간으로 남기고 운영자가 곧바로 처리한다. 캐시된 목록을
   보여 주면 "방금 온 문의가 없다"는 오해를 부른다. */
export const dynamic = 'force-dynamic'

/**
 * 출처 프리셋별 제목·설명.
 *
 * 사이드바의 '1:1 문의'·'이메일 문의'는 새 라우트가 아니라 이 화면의 필터 프리셋이다
 * (EMAIL-INQUIRY-PLAN §7). 주소만 다르고 제목이 같으면 운영자가 어느 화면인지 모른다.
 */
const PRESETS: Record<InquirySource | 'all', { title: string; description: string }> = {
  web: {
    title: '1:1 문의',
    description: '접수된 문의를 확인하고 답변합니다. 기본 화면은 아직 처리하지 않은 문의입니다.',
  },
  email: {
    title: '이메일 문의',
    description: '이메일로 들어온 문의입니다. 답신은 사용자의 메일 주소로 발송됩니다.',
  },
  all: {
    title: '문의 전체',
    description: '웹 폼과 이메일로 들어온 문의를 함께 봅니다. 출처 필터로 좁힐 수 있습니다.',
  },
}

function presetFor(source: InquirySource | null) {
  return PRESETS[source ?? 'all']
}

export async function generateMetadata(props: PageProps<'/inquiries'>): Promise<Metadata> {
  const params = await props.searchParams

  return { title: presetFor(parseInquiryFilters(params).source).title }
}

export default async function InquiriesPage(props: PageProps<'/inquiries'>) {
  await requirePermission('inquiries', 'read')
  const params = await props.searchParams
  const filters = parseInquiryFilters(params)
  const sort = parseSort(params.sort, INQUIRY_SORT_KEYS, { key: 'created_at', direction: 'desc' })
  const page = parsePage(params.page)
  const preset = presetFor(filters.source)

  const [{ rows, count, hasError }, counts] = await Promise.all([
    getInquiries(filters, { page, sortKey: sort.key, ascending: sort.direction === 'asc' }),
    getInquiryTabCounts(filters),
  ])

  return (
    <>
      <PageHeader title={preset.title} description={preset.description} />

      <InquiryFilters params={params} filters={filters} counts={counts} />

      {hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <InquiryTable rows={rows} params={params} sort={sort} page={page} count={count} />
    </>
  )
}
