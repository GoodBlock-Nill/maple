import { unstable_cache } from 'next/cache'

import { FAQ_CATEGORIES } from '@/lib/constants/support'
import { CACHE_TAGS, STATIC_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { toFaqItem } from '@/lib/data/mappers'
import { createPublicClient } from '@/lib/supabase/public'

import type { FaqGroup } from '@/types/domain'

/**
 * FAQ 데이터 접근 계층 (`faqs`).
 *
 * 표시 순서는 상수(`FAQ_CATEGORIES`)가 소유한다. DB 의 `sort_order` 는 카테고리
 * **안에서의** 순서만 결정하므로, 운영자가 항목을 추가해도 아코디언의 카테고리
 * 배열이 흔들리지 않는다. 항목이 하나도 없는 카테고리는 그리지 않는다.
 */
async function fetchFaqGroups(): Promise<readonly FaqGroup[]> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })

  if (error !== null) {
    throw new Error(`자주 묻는 질문을 불러오지 못했습니다: ${error.message}`)
  }

  const items = data.map(toFaqItem)

  return FAQ_CATEGORIES.map((category) => ({
    category: category.value,
    label: category.label,
    items: items.filter((item) => item.category === category.value),
  })).filter((group) => group.items.length > 0)
}

const getCachedFaqGroups = unstable_cache(fetchFaqGroups, ['faq-groups'], {
  tags: [CACHE_TAGS.faqs],
  revalidate: STATIC_REVALIDATE_SECONDS,
})

export async function getFaqGroups(): Promise<readonly FaqGroup[]> {
  return getCachedFaqGroups()
}
