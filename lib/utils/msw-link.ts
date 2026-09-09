import { FEATURES } from '@/lib/constants/features'
import { ACCOUNT_PATH } from '@/lib/validation/auth'

/**
 * "월드 계정 연동 회원만 글쓰기" 게이트(피드백 7).
 *
 * 순수 함수만 담는다 — 서버 액션(폼 오류)과 페이지(안내 배너)가 같은 판정·문구를 쓴다.
 * 플래그 `FEATURES.postingRequiresMswLink` 가 꺼져 있으면(기본) 항상 통과한다.
 */

export const MSW_LINK_REQUIRED_MESSAGE =
  '월드 계정을 연동하면 글을 쓸 수 있습니다. 내 정보에서 연동해 주세요.'

/** 안내 배너의 링크 목적지(내 정보). */
export const MSW_LINK_PATH = ACCOUNT_PATH

export type MswLinkSource = {
  /** 프로필의 msw_uid. 비어 있으면 연동 전이다. */
  mswUid: string | null
}

/** 이 사용자가 글·댓글을 쓰려면 먼저 월드 계정을 연동해야 하는가. */
export function requiresMswLink(
  user: MswLinkSource | null,
  enabled: boolean = FEATURES.postingRequiresMswLink,
): boolean {
  if (!enabled || user === null) {
    return false
  }

  return user.mswUid === null || user.mswUid.trim() === ''
}

/** 게이트에 걸리면 안내 문구, 아니면 null. 정지 안내(`suspensionNotice`)와 같은 꼴이다. */
export function mswLinkNotice(
  user: MswLinkSource | null,
  enabled: boolean = FEATURES.postingRequiresMswLink,
): string | null {
  return requiresMswLink(user, enabled) ? MSW_LINK_REQUIRED_MESSAGE : null
}
