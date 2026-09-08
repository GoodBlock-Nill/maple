import { FAQ_CATEGORIES } from '@/lib/constants/support'
import { FAQ_ITEMS } from '@/lib/mock/faqs'

import type { FaqGroup } from '@/types/domain'

/**
 * FAQ 데이터 접근 계층.
 * 화면은 카테고리 순서를 상수(`FAQ_CATEGORIES`)에서만 받으므로 목업이 섞여
 * 있어도 표시 순서가 흔들리지 않는다. Phase 4에서 Supabase `faqs` 로 교체된다.
 */
export async function getFaqGroups(): Promise<readonly FaqGroup[]> {
  return FAQ_CATEGORIES.map((category) => ({
    category: category.value,
    label: category.label,
    items: FAQ_ITEMS.filter((item) => item.category === category.value),
  })).filter((group) => group.items.length > 0)
}
