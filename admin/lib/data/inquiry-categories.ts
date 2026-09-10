import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * 문의 카테고리 조회 계층 (`inquiry_categories`).
 *
 * 세션 클라이언트로 읽는다. 공개 정책(`inquiry_categories_select_active`)은 활성 행만
 * 열어 주고, 비활성 행까지 보이는 근거는 `inquiry_categories_admin_all` 이다 — 관리자
 * 권한이 사라지면 이 화면도 사용자와 같은 것만 보이는 것이 맞다.
 *
 * 사용 건수(`usageCount`)는 `inquiries.category` 를 라벨로 센 값이다
 * (`public.inquiry_category_usage()`). 삭제 가능 여부와 목록 필터 옵션이 이 값에서 나온다.
 */

const CATEGORY_COLUMNS =
  'id, key, label, description, prefill, subtypes, sort_order, is_active, updated_at'

export type AdminInquiryCategory = {
  id: string
  key: string
  label: string
  description: string | null
  prefill: string
  /** 사용자 폼의 유형 셀렉트 선택지. 순서가 곧 표시 순서다. 비면 '기타' 로 접수된다. */
  subtypes: readonly string[]
  sortOrder: number
  isActive: boolean
  /** 이 라벨로 접수된 문의 수. 0 일 때만 삭제할 수 있다. */
  usageCount: number
  updatedAt: string
}

export type InquiryCategoryListResult = {
  rows: readonly AdminInquiryCategory[]
  /** 조회가 깨졌는지. 빈 표를 "카테고리가 없다"로 읽지 않도록 화면이 배너를 세운다. */
  hasError: boolean
}

/** 유형 → 문의 수. 목록 필터가 "데이터에만 남은 옛 유형"을 잃지 않도록 함께 읽는다. */
export async function getInquiryTypeUsage(): Promise<ReadonlyMap<string, number>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('inquiry_type_usage')

  if (error !== null || data === null) {
    console.error('[inquiry-categories] 유형 집계 실패', error?.message)

    return new Map()
  }

  return new Map(data.map((row) => [row.type, Number(row.total)]))
}

/** 라벨 → 문의 수. 집계가 깨지면 빈 표를 돌려준다(0건으로 읽혀 삭제가 열리지 않게 한다). */
export async function getInquiryCategoryUsage(): Promise<ReadonlyMap<string, number>> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('inquiry_category_usage')

  if (error !== null || data === null) {
    console.error('[inquiry-categories] 사용 건수 집계 실패', error?.message)

    return new Map()
  }

  return new Map(data.map((row) => [row.category, Number(row.total)]))
}

export async function getInquiryCategories(): Promise<InquiryCategoryListResult> {
  const supabase = await createClient()
  const [{ data, error }, usage] = await Promise.all([
    supabase
      .from('inquiry_categories')
      .select(CATEGORY_COLUMNS)
      .order('sort_order', { ascending: true })
      // sort_order 가 같으면 먼저 만든 쪽을 위에 둔다(사용자 사이트와 같은 순서).
      .order('created_at', { ascending: true }),
    getInquiryCategoryUsage(),
  ])

  if (error !== null || data === null) {
    console.error('[inquiry-categories] 목록 조회 실패', error?.message)

    return { rows: [], hasError: true }
  }

  return {
    rows: data.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      prefill: row.prefill,
      subtypes: row.subtypes,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      usageCount: usage.get(row.label) ?? 0,
      updatedAt: row.updated_at,
    })),
    hasError: false,
  }
}

/** 새 카테고리를 맨 뒤에 붙이기 위한 다음 순번. */
export async function getNextInquiryCategorySortOrder(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiry_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null || data === null) {
    return 0
  }

  return data.sort_order + 1
}

/**
 * 목록 필터의 카테고리 옵션.
 *
 * 등록된 카테고리(비활성 포함) + **데이터에만 남은 옛 라벨**을 함께 준다. 옛 라벨을
 * 빼면 '계정' 으로 접수된 과거 문의를 필터로 찾을 방법이 사라진다.
 */
export async function getInquiryCategoryFilterOptions(): Promise<readonly string[]> {
  const supabase = await createClient()
  const [{ data }, usage] = await Promise.all([
    supabase.from('inquiry_categories').select('label').order('sort_order', { ascending: true }),
    getInquiryCategoryUsage(),
  ])

  const registered = (data ?? []).map((row) => row.label)
  const legacy = [...usage.keys()].filter((label) => !registered.includes(label)).sort()

  return [...registered, ...legacy]
}

/**
 * 목록 필터의 유형 옵션.
 *
 * 카테고리 필터가 걸려 있으면 **그 카테고리의 세부 유형만** 보여 준다 — 필터 폼은
 * 자바스크립트 없이 도는 GET 폼이라, 카테고리를 고르고 검색을 누른 다음 화면이
 * 좁혀진 목록을 그리는 것이 유일하게 정직한 동작이다.
 *
 * 어느 경우든 **데이터에만 남은 옛 유형**('문의' · '신고' · '제안' · 이메일 문의의
 * 'general')을 뒤에 붙인다. 빼면 그 값으로 접수된 과거 문의를 필터로 찾을 길이 사라진다.
 */
export async function getInquiryTypeFilterOptions(
  category: string | null,
): Promise<readonly string[]> {
  const supabase = await createClient()
  const [{ data }, usage] = await Promise.all([
    supabase
      .from('inquiry_categories')
      .select('label, subtypes')
      .order('sort_order', { ascending: true }),
    getInquiryTypeUsage(),
  ])

  const rows = data ?? []
  const scoped = category === null ? rows : rows.filter((row) => row.label === category)
  const registered = [...new Set(scoped.flatMap((row) => row.subtypes))]
  const legacy = [...usage.keys()].filter((type) => !registered.includes(type)).sort()

  return [...registered, ...legacy]
}
