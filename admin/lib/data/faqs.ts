import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { FAQ_CATEGORIES } from '@/lib/validation/faqs'

import type { FaqCategory } from '@/lib/validation/faqs'

/**
 * FAQ 조회 계층.
 *
 * 세션 클라이언트로 읽는다. 공개 정책(`faqs_select_published`)은 발행된 항목만
 * 열어 주고, 미발행 항목까지 보이는 근거는 `faqs_admin_all` 이다 — 관리자 권한이
 * 사라지면 이 화면도 발행분만 보이는 것이 맞다.
 */

const FAQ_COLUMNS = 'id, category, question, answer, sort_order, is_published, updated_at'

export type FaqItem = {
  id: string
  category: FaqCategory
  question: string
  answer: string
  sortOrder: number
  isPublished: boolean
  updatedAt: string
}

export type FaqGroup = {
  category: FaqCategory
  label: string
  items: readonly FaqItem[]
}

/**
 * 카테고리별 묶음.
 *
 * 카테고리의 **표시 순서는 상수가 소유한다**(사용자 사이트와 같은 규칙). DB 의
 * `sort_order` 는 카테고리 안에서의 순서만 결정한다. 관리자 화면은 비어 있는
 * 카테고리도 그린다 — 첫 항목을 여기서 추가하기 때문이다.
 */
export async function getFaqGroups(): Promise<readonly FaqGroup[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('faqs')
    .select(FAQ_COLUMNS)
    .order('sort_order', { ascending: true })
    // sort_order 가 같으면 등록이 빠른 쪽을 위에 둔다(매번 같은 순서를 보장).
    .order('created_at', { ascending: true })

  if (error !== null) {
    console.error('[faqs] 목록 조회 실패', error.message)

    return FAQ_CATEGORIES.map((option) => ({
      category: option.value,
      label: option.label,
      items: [],
    }))
  }

  const items: readonly FaqItem[] = (data ?? []).map((row) => ({
    id: row.id,
    category: row.category,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    updatedAt: row.updated_at,
  }))

  return FAQ_CATEGORIES.map((category) => ({
    category: category.value,
    label: category.label,
    items: items.filter((item) => item.category === category.value),
  }))
}

/** 새 항목을 카테고리 맨 뒤에 붙이기 위한 다음 순번. */
export async function getNextFaqSortOrder(category: FaqCategory): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('faqs')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null || data === null) {
    return 0
  }

  return data.sort_order + 1
}
