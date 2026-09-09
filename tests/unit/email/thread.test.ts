import { describe, expect, it } from 'vitest'

import {
  candidateMessageIds,
  extractAddress,
  generateThreadKey,
  isThreadKey,
  parseReplyRecipient,
  replyAddress,
  splitMessageIds,
  stripAngleBrackets,
} from '../../../supabase/functions/_shared/email/thread'

describe('generateThreadKey', () => {
  it('should produce a 24-char lowercase hex key', () => {
    const key = generateThreadKey()

    expect(key).toHaveLength(24)
    expect(key).toMatch(/^[a-f0-9]{24}$/)
    expect(isThreadKey(key)).toBe(true)
  })

  it('should be deterministic for a given byte source', () => {
    expect(generateThreadKey((length) => new Uint8Array(length).fill(0xfb))).toBe('fb'.repeat(12))
  })

  it('should survive case folding by a relay', () => {
    expect(isThreadKey('ABCDEF0123456789ABCDEF01')).toBe(true)
    expect(isThreadKey('zz'.repeat(12))).toBe(false)
  })

  it('should not repeat across calls', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateThreadKey()))

    expect(keys.size).toBe(50)
  })
})

describe('extractAddress', () => {
  it('should lower-case a bare address', () => {
    expect(extractAddress('User@Example.COM')).toBe('user@example.com')
  })

  it('should pull the address out of a display-name form', () => {
    expect(extractAddress('"홍길동" <Hong@example.com>')).toBe('hong@example.com')
  })

  it('should return null for text that is not an address', () => {
    expect(extractAddress('not an address')).toBeNull()
    expect(extractAddress('')).toBeNull()
  })
})

describe('parseReplyRecipient', () => {
  const key = 'abcdef0123456789abcdef01'

  it('should find the thread key in a reply+ recipient', () => {
    expect(parseReplyRecipient([`reply+${key}@in.example.com`])).toBe(key)
  })

  it('should read the key from a display-name recipient', () => {
    expect(parseReplyRecipient([`글자월드 <REPLY+${key.toUpperCase()}@In.Example.com>`])).toBe(key)
  })

  it('should ignore reply+ on another domain when a reply domain is given', () => {
    expect(parseReplyRecipient([`reply+${key}@evil.example`], 'in.example.com')).toBeNull()
    expect(parseReplyRecipient([`reply+${key}@in.example.com`], 'IN.example.com')).toBe(key)
  })

  it('should ignore malformed keys and plain recipients', () => {
    expect(parseReplyRecipient(['reply+short@in.example.com'])).toBeNull()
    expect(parseReplyRecipient(['contact@example.com'])).toBeNull()
    expect(parseReplyRecipient([])).toBeNull()
  })

  it('should search every recipient', () => {
    expect(parseReplyRecipient(['contact@example.com', `reply+${key}@in.example.com`])).toBe(key)
  })
})

describe('replyAddress', () => {
  it('should build reply+<key>@<domain>', () => {
    expect(replyAddress('k'.repeat(24), 'in.example.com')).toBe(
      `reply+${'k'.repeat(24)}@in.example.com`,
    )
  })
})

describe('message id helpers', () => {
  it('should strip angle brackets and whitespace', () => {
    expect(stripAngleBrackets('  <abc@x.y> ')).toBe('abc@x.y')
  })

  it('should split a References header on whitespace and commas', () => {
    expect(splitMessageIds('<a@x> <b@x>,<c@x>')).toEqual(['a@x', 'b@x', 'c@x'])
    expect(splitMessageIds(null)).toEqual([])
  })

  it('should list in-reply-to first, then references newest-first, with and without brackets', () => {
    const ids = candidateMessageIds('<c@x>', ['a@x', 'b@x'])

    expect(ids.slice(0, 3)).toEqual(['c@x', '<c@x>', 'c'])
    expect(ids).toContain('b@x')
    expect(ids).toContain('<a@x>')
    expect(ids.indexOf('b@x')).toBeLessThan(ids.indexOf('a@x'))
  })

  it('should de-duplicate candidates', () => {
    const ids = candidateMessageIds('<a@x>', ['a@x'])

    expect(ids).toEqual(['a@x', '<a@x>', 'a'])
  })
})
