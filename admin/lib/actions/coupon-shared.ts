import 'server-only'

import { revalidatePath } from 'next/cache'

/**
 * 쿠폰 액션들이 함께 쓰는 상수와 무효화.
 *
 * **`'use server'` 를 붙이지 않는다.** 그 지시어가 붙은 모듈의 export 는 전부 액션
 * 엔드포인트로 열린다 — 인가를 스스로 하지 않는 헬퍼를 그런 모듈에서 내보내면
 * 아무나 직접 POST 로 부를 수 있다(`member-shared.ts` 와 같은 이유).
 *
 * **사용자 사이트 캐시는 태우지 않는다.** 쿠폰 목록은 RLS 에 일반 사용자 select 정책이
 * 없어 사용자 사이트가 읽지 못하고, 마이페이지의 등록 폼·내 등록 내역은 세션마다 직접
 * 읽는다. 부를 태그가 없으므로 `revalidateClient()` 도 없다 — 1:1 문의와 같은 이유다.
 */

export const COUPONS_PATH = '/coupons'

/** 유니크 위반. 운영자가 스스로 고칠 수 있는 유일한 제약이라 문구로 번역한다(§7.1). */
export const UNIQUE_VIOLATION = '23505'

/** FK 위반. 등록 내역이 있는 쿠폰을 지우려 할 때 DB 가 마지막으로 막는다. */
export const FOREIGN_KEY_VIOLATION = '23503'

export const DUPLICATE_CODE_MESSAGE =
  '이미 사용 중인 쿠폰 코드입니다. 코드를 바꾸거나 자동 생성을 눌러 주세요.'

export function couponDetailPath(couponId: string): string {
  return `${COUPONS_PATH}/${couponId}`
}

/** 목록과 상세를 함께 되살린다. 둘 다 `force-dynamic` 이지만 열려 있는 탭이 갱신된다. */
export function revalidateCoupon(couponId?: string): void {
  revalidatePath(COUPONS_PATH)

  if (couponId !== undefined) {
    revalidatePath(couponDetailPath(couponId))
  }
}
