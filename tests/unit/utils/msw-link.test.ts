import { describe, expect, it } from 'vitest'

import {
  MSW_LINK_PATH,
  MSW_LINK_REQUIRED_MESSAGE,
  mswLinkNotice,
  requiresMswLink,
} from '@/lib/utils/msw-link'

const LINKED = { mswUid: '20123000000000000' }
const UNLINKED = { mswUid: null }

describe('requiresMswLink', () => {
  it('should never gate anyone while the flag is off (the default)', () => {
    expect(requiresMswLink(UNLINKED)).toBe(false)
    expect(requiresMswLink(UNLINKED, false)).toBe(false)
  })

  it('should gate an unlinked member when the flag is on', () => {
    expect(requiresMswLink(UNLINKED, true)).toBe(true)
    expect(requiresMswLink({ mswUid: '   ' }, true)).toBe(true)
  })

  it('should let a linked member through when the flag is on', () => {
    expect(requiresMswLink(LINKED, true)).toBe(false)
  })

  it('should not gate a visitor — the login check comes first', () => {
    expect(requiresMswLink(null, true)).toBe(false)
  })
})

describe('mswLinkNotice', () => {
  it('should return the approved message with a pointer to the account page', () => {
    expect(mswLinkNotice(UNLINKED, true)).toBe(MSW_LINK_REQUIRED_MESSAGE)
    expect(MSW_LINK_REQUIRED_MESSAGE).toBe(
      '월드 계정을 연동하면 글을 쓸 수 있습니다. 내 정보에서 연동해 주세요.',
    )
    expect(MSW_LINK_PATH).toBe('/account')
  })

  it('should return null when there is nothing to say', () => {
    expect(mswLinkNotice(LINKED, true)).toBeNull()
    expect(mswLinkNotice(UNLINKED, false)).toBeNull()
  })
})
