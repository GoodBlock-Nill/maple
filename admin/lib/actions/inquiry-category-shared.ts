import { revalidatePath } from 'next/cache'

import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'

/**
 * 문의 카테고리 액션이 함께 쓰는 문구·경로·캐시 무효화.
 *
 * 액션 파일에서 떼어 낸 이유는 길이만이 아니다 — 무효화를 한 곳에 모아 두지 않으면
 * 어느 액션은 사용자 사이트의 태그를 태우고 어느 액션은 태우지 않는 상태가 되고,
 * 그때 운영자가 보는 것은 "고쳤는데 사용자 폼은 그대로"다
 * (`inquiry-reply-template-shared.ts` 와 같은 규격).
 */

export const CATEGORIES_PATH = '/inquiries/categories'

export const CATEGORY_NOT_FOUND = '카테고리를 찾을 수 없습니다.'

/**
 * 사용자 사이트의 문의 폼은 카테고리를 `unstable_cache`(300초)로 읽는다. 저장 뒤
 * 태그를 태우지 않으면 새 프리필이 최대 5분간 반영되지 않는다.
 */
export async function revalidateCategories(): Promise<void> {
  revalidatePath(CATEGORIES_PATH)
  revalidatePath('/inquiries')
  await revalidateClient([CLIENT_CACHE_TAGS.inquiryCategories])
}
