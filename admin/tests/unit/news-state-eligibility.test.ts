import { describe, expect, it } from 'vitest'

import {
  NEWS_HIDE_ONLY_PUBLISHED_MESSAGE,
  NEWS_UNHIDE_ONLY_HIDDEN_MESSAGE,
  NEWS_STATUSES,
} from '@/lib/constants/news'
import {
  isNewsIntent,
  isNewsIntentEligible,
  newsHideIntent,
  newsIneligibleMessage,
  newsSkippedNotice,
} from '@/lib/validation/news-state-eligibility'

/**
 * 자격 규칙은 한 벌뿐이어야 한다 — 행 버튼 · 일괄 바 · 서버 액션이 모두 이 함수를
 * 부른다. 여기서 규칙이 흔들리면 버튼은 보이는데 서버가 거절하는(또는 그 반대의)
 * 화면이 만들어진다.
 */
describe('isNewsIntentEligible', () => {
  it('should allow hiding only a published post', () => {
    // Arrange & Act & Assert
    expect(isNewsIntentEligible('hide', 'published')).toBe(true)
    expect(isNewsIntentEligible('hide', 'draft')).toBe(false)
    expect(isNewsIntentEligible('hide', 'scheduled')).toBe(false)
    expect(isNewsIntentEligible('hide', 'hidden')).toBe(false)
    expect(isNewsIntentEligible('hide', 'deleted')).toBe(false)
  })

  it('should allow unhiding only a hidden post', () => {
    expect(isNewsIntentEligible('unhide', 'hidden')).toBe(true)
    expect(isNewsIntentEligible('unhide', 'published')).toBe(false)
    expect(isNewsIntentEligible('unhide', 'draft')).toBe(false)
  })

  it('should let delete and restore run on every status', () => {
    // 휴지통은 모든 상태를 받는다 — 이 조작들은 자격 검사를 넣기 전과 같아야 한다.
    for (const status of NEWS_STATUSES) {
      expect(isNewsIntentEligible('delete', status)).toBe(true)
      expect(isNewsIntentEligible('restore', status)).toBe(true)
    }
  })
})

describe('isNewsIntent', () => {
  it('should reject a value outside the four intents', () => {
    expect(isNewsIntent('hide')).toBe(true)
    expect(isNewsIntent('purge')).toBe(false)
  })
})

describe('newsHideIntent', () => {
  it('should offer 숨김 for a published post and 숨김 해제 for a hidden one', () => {
    expect(newsHideIntent('published')).toBe('hide')
    expect(newsHideIntent('hidden')).toBe('unhide')
  })

  it('should offer nothing when the post is not visible to readers anyway', () => {
    expect(newsHideIntent('draft')).toBeNull()
    expect(newsHideIntent('scheduled')).toBeNull()
    expect(newsHideIntent('deleted')).toBeNull()
  })
})

describe('newsIneligibleMessage', () => {
  it('should explain the rule in the operator wording', () => {
    expect(newsIneligibleMessage('hide')).toBe(NEWS_HIDE_ONLY_PUBLISHED_MESSAGE)
    expect(newsIneligibleMessage('unhide')).toBe(NEWS_UNHIDE_ONLY_HIDDEN_MESSAGE)
  })
})

describe('newsSkippedNotice', () => {
  it('should return an empty string when nothing was skipped', () => {
    expect(newsSkippedNotice('hide', 0)).toBe('')
  })

  it('should name the reason per intent when some rows were skipped', () => {
    expect(newsSkippedNotice('hide', 2)).toBe(' 발행되지 않은 2건은 제외했습니다.')
    expect(newsSkippedNotice('unhide', 1)).toBe(' 숨김이 아닌 1건은 제외했습니다.')
  })
})
