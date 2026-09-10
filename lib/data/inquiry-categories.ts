import { unstable_cache } from 'next/cache'

import { INQUIRY_CATEGORY_FALLBACK } from '@/lib/constants/support'
import { CACHE_TAGS, STATIC_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { createPublicClient } from '@/lib/supabase/public'

import type { InquiryCategoryOption } from '@/types/domain'

/**
 * 1:1 문의 카테고리 데이터 접근 계층 (`inquiry_categories`).
 *
 * 라벨·설명·프리필 양식은 **누가 보든 같은 공개 문구**라 익명 클라이언트로 읽어
 * 캐시에 담는다(FAQ 와 같은 규칙). 관리자가 카테고리를 고치면 관리자 앱이
 * `POST /api/revalidate` 로 `inquiry-categories` 태그를 태워 즉시 반영한다.
 *
 * 조회가 실패하면 폴백 라벨로 떨어진다. 카테고리를 못 읽었다고 접수 폼을 막으면
 * 하필 장애 때 "접속이 안 된다"는 문의가 들어올 길이 사라진다. 폴백에는 프리필이
 * 없으므로 사용자는 빈 칸에 직접 쓰게 된다 — 접수는 되고 양식만 빠진다.
 */

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const CATEGORY_COLUMNS = 'key, label, description, prefill, subtypes'

async function fetchInquiryCategories(): Promise<readonly InquiryCategoryOption[]> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('inquiry_categories')
    .select(CATEGORY_COLUMNS)
    /* RLS(`inquiry_categories_select_active`)가 이미 활성 행만 연다. 조건을 한 번 더
       거는 이유는 이 질의가 무엇을 읽는지 코드에서도 읽히게 하려는 것이다. */
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    // sort_order 가 같으면 먼저 만든 쪽을 위에 둔다(관리자 화면과 같은 순서).
    .order('created_at', { ascending: true })

  if (error !== null) {
    throw new Error(`문의 카테고리를 불러오지 못했습니다: ${error.message}`)
  }

  return data.map((row) => ({
    key: row.key,
    label: row.label,
    description: row.description,
    prefill: row.prefill,
    subtypes: row.subtypes,
  }))
}

const getCachedInquiryCategories = unstable_cache(fetchInquiryCategories, ['inquiry-categories'], {
  tags: [CACHE_TAGS.inquiryCategories],
  revalidate: STATIC_REVALIDATE_SECONDS,
})

/**
 * 활성 카테고리 목록. 폼과 서버 액션(허용 라벨 판정)이 **같은 함수**를 부른다 —
 * 목록이 갈리면 화면에는 보이는데 접수는 거절되는 카테고리가 생긴다.
 *
 * 절대 던지지 않는다. 조회 실패·행 없음은 모두 폴백으로 떨어진다.
 */
export async function getInquiryCategories(): Promise<readonly InquiryCategoryOption[]> {
  try {
    const categories = await getCachedInquiryCategories()

    return categories.length > 0 ? categories : INQUIRY_CATEGORY_FALLBACK
  } catch (error) {
    console.error(
      '[inquiry-categories] 조회 실패',
      error instanceof Error ? error.message : String(error),
    )

    return INQUIRY_CATEGORY_FALLBACK
  }
}

/**
 * 접수·수정 액션이 검사에 쓰는 허용 라벨.
 *
 * 유형(세부 문의 유형) 검사는 카테고리마다 달라 라벨만으로는 할 수 없다 — 액션은
 * `getInquiryCategories()` 를 그대로 넘긴다. 이 함수는 "어떤 라벨을 받는가"만
 * 물어보는 자리(테스트 · 진단)에 남겨 둔다.
 */
export async function getInquiryCategoryLabels(): Promise<readonly string[]> {
  return (await getInquiryCategories()).map((category) => category.label)
}
