/**
 * 상태 변경(숨김 · 해제 · 삭제 · 복구)의 **대상 자격**.
 *
 * 규칙이 세 곳에서 쓰인다 — 행 버튼(무엇을 그릴까), 일괄 처리 바(버튼을 열까),
 * 서버 액션(무엇을 실제로 고칠까). 화면이 막더라도 서버 액션은 UI 를 거치지 않는
 * 직접 POST 로 불릴 수 있으므로 판정의 주인은 서버지만, 판정식 자체는 여기 한 벌만
 * 둔다. 버튼은 보이는데 누르면 거절당하는(또는 그 반대의) 어긋남이 생기지 않게.
 *
 * 숨김의 대상을 `published` 하나로 좁히는 이유는 `NEWS_HIDE_ONLY_PUBLISHED_MESSAGE`
 * 위의 주석에 적어 두었다. 삭제·복구는 상태를 가리지 않는다(휴지통은 모든 상태를
 * 받는다).
 */

import {
  NEWS_HIDE_ONLY_PUBLISHED_MESSAGE,
  NEWS_NO_TARGET_MESSAGE,
  NEWS_UNHIDE_ONLY_HIDDEN_MESSAGE,
  type NewsStatus,
} from '@/lib/constants/news'

export const NEWS_STATE_INTENTS = ['hide', 'unhide', 'delete', 'restore'] as const

export type NewsIntent = (typeof NEWS_STATE_INTENTS)[number]

/** 행에 그릴 수 있는 숨김 계열 조작. 숨김과 해제는 한 자리를 번갈아 쓴다. */
export type NewsHideIntent = Extract<NewsIntent, 'hide' | 'unhide'>

export function isNewsIntent(value: string): value is NewsIntent {
  return (NEWS_STATE_INTENTS as readonly string[]).includes(value)
}

/** intent → 조작할 수 있는 상태. `null` 은 "상태를 가리지 않는다"는 뜻이다. */
const ELIGIBLE_STATUSES: Record<NewsIntent, readonly NewsStatus[] | null> = {
  hide: ['published'],
  unhide: ['hidden'],
  delete: null,
  restore: null,
}

export function isNewsIntentEligible(intent: NewsIntent, status: NewsStatus): boolean {
  const allowed = ELIGIBLE_STATUSES[intent]

  return allowed === null || allowed.includes(status)
}

/**
 * 이 상태의 행에 그릴 숨김 계열 버튼. 대상이 아니면 `null` — 임시저장·예약 글에는
 * 숨김도 해제도 그리지 않는다.
 */
export function newsHideIntent(status: NewsStatus): NewsHideIntent | null {
  if (isNewsIntentEligible('hide', status)) {
    return 'hide'
  }

  return isNewsIntentEligible('unhide', status) ? 'unhide' : null
}

/** 일괄 처리 바가 세는 최소 표면. 목록 행 타입 전체를 끌어오지 않는다. */
type NewsSelectableRow = {
  id: string
  status: NewsStatus
}

/** 고른 것 중 숨김·해제가 실제로 걸릴 건수. 두 버튼이 각자 이 값을 본다. */
export type NewsHideCounts = Record<NewsHideIntent, number>

/**
 * 고른 행 중 숨김·해제 대상이 각각 몇 건인가.
 *
 * 선택을 한 번만 추려 두 수를 함께 낸다 — 두 수가 **같은 순간의 같은 목록**에서
 * 나와야 "발행 N건 · 숨김 M건" 과 두 버튼의 활성 여부가 서로 어긋나지 않는다.
 *
 * 두 자격을 따로 세는 이유: 숨김과 해제가 겹치지 않는 것은 `ELIGIBLE_STATUSES` 의
 * 현재 값이 그런 것일 뿐 규칙이 보장하는 성질이 아니다. 한쪽을 다른 쪽의 여집합으로
 * 두면 규칙이 바뀌는 날 조용히 틀린 수가 찍힌다.
 */
export function countEligible(
  rows: readonly NewsSelectableRow[],
  selected: readonly string[],
): NewsHideCounts {
  const chosen = rows.filter((row) => selected.includes(row.id))

  return {
    hide: chosen.filter((row) => isNewsIntentEligible('hide', row.status)).length,
    unhide: chosen.filter((row) => isNewsIntentEligible('unhide', row.status)).length,
  }
}

/* 자격 미달 안내. 삭제·복구는 상태를 가리지 않아 고정 문구가 필요 없다. */
const INELIGIBLE_MESSAGE: Partial<Record<NewsIntent, string>> = {
  hide: NEWS_HIDE_ONLY_PUBLISHED_MESSAGE,
  unhide: NEWS_UNHIDE_ONLY_HIDDEN_MESSAGE,
}

/** 고른 것이 전부 대상이 아닐 때의 폼 오류 문구. */
export function newsIneligibleMessage(intent: NewsIntent): string {
  return INELIGIBLE_MESSAGE[intent] ?? NEWS_NO_TARGET_MESSAGE
}

/* 일부만 걸러졌을 때 덧붙이는 사유. "왜 3건을 골랐는데 2건만 되었나"에 답한다. */
const SKIPPED_REASON: Partial<Record<NewsIntent, string>> = {
  hide: '발행되지 않은',
  unhide: '숨김이 아닌',
}

/**
 * 일부만 처리했을 때 성공 토스트에 덧붙일 한 문장. 제외가 없으면 빈 문자열이라
 * 호출부가 기존 문구(`N건을 …`)를 그대로 쓴다.
 */
export function newsSkippedNotice(intent: NewsIntent, skipped: number): string {
  if (skipped === 0) {
    return ''
  }

  return ` ${SKIPPED_REASON[intent] ?? '대상이 아닌'} ${skipped}건은 제외했습니다.`
}
