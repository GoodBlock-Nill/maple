import { describe, expect, it } from 'vitest'

import {
  normalizeHeaders,
  normalizeInbound,
  parseAuthenticationResults,
  parseEmailAddress,
} from '../../../supabase/functions/_shared/email/normalize'

/* Resend `email.received` 웹훅 data — 문서 예시 모양(본문·헤더 없음). */
const WEBHOOK_DATA = {
  email_id: 'e-123',
  created_at: '2026-09-09T01:02:03.000Z',
  from: '"홍길동" <Hong@Example.com>',
  to: ['contact@example.co.kr'],
  cc: [],
  bcc: [],
  received_for: ['reply+abcdef0123456789abcdef01@in.example.co.kr'],
  message_id: '<orig-1@mail.example.com>',
  subject: '결제 문의',
  attachments: [{ id: 'att-1', filename: '영수증.pdf', content_type: 'application/pdf' }],
}

/* GET /emails/receiving/{id} — 본문·헤더·첨부(size 포함). */
const FULL_EMAIL = {
  object: 'email',
  id: 'e-123',
  text: '안녕하세요\r\n결제가 두 번 됐어요',
  html: '<p>안녕하세요</p>',
  headers: {
    'In-Reply-To': '<sent-9@resend.dev>',
    References: '<sent-8@resend.dev> <sent-9@resend.dev>',
    'Authentication-Results':
      'mx.example; spf=pass smtp.mailfrom=example.com; dkim=fail; dmarc=none',
  },
  attachments: [
    { id: 'att-1', filename: '영수증.pdf', content_type: 'application/pdf; name=x', size: 1234 },
  ],
}

describe('parseEmailAddress', () => {
  it('should split display name and lower-cased address', () => {
    expect(parseEmailAddress('"홍길동" <Hong@Example.com>')).toEqual({
      address: 'hong@example.com',
      name: '홍길동',
    })
  })

  it('should return a null name for a bare address', () => {
    expect(parseEmailAddress('a@b.co')).toEqual({ address: 'a@b.co', name: null })
  })

  it('should not crash on garbage', () => {
    expect(parseEmailAddress(undefined)).toEqual({ address: '', name: null })
  })
})

describe('normalizeHeaders', () => {
  it('should lower-case object keys', () => {
    expect(normalizeHeaders({ 'Message-ID': '<a>', From: 'x' })).toEqual({
      'message-id': '<a>',
      from: 'x',
    })
  })

  it('should accept {name,value} arrays', () => {
    expect(normalizeHeaders([{ name: 'Subject', value: 'hi' }])).toEqual({ subject: 'hi' })
  })

  it('should keep the first Received header and the last of any other repeated header', () => {
    const headers = normalizeHeaders([
      { name: 'Received', value: 'outer' },
      { name: 'Received', value: 'inner' },
      { name: 'X-Test', value: '1' },
      { name: 'X-Test', value: '2' },
    ])

    expect(headers.received).toBe('outer')
    expect(headers['x-test']).toBe('2')
  })

  it('should return an empty object for anything else', () => {
    expect(normalizeHeaders(null)).toEqual({})
    expect(normalizeHeaders('nope')).toEqual({})
  })
})

describe('parseAuthenticationResults', () => {
  it('should read spf/dkim/dmarc verdicts', () => {
    expect(parseAuthenticationResults(FULL_EMAIL.headers['Authentication-Results'])).toEqual({
      spf: 'pass',
      dkim: 'fail',
      dmarc: 'none',
    })
  })

  it('should return nulls when the header is missing', () => {
    expect(parseAuthenticationResults(undefined)).toEqual({ spf: null, dkim: null, dmarc: null })
  })
})

describe('normalizeInbound', () => {
  it('should merge webhook metadata with the fetched full email', () => {
    const email = normalizeInbound(WEBHOOK_DATA, FULL_EMAIL)

    expect(email.providerEmailId).toBe('e-123')
    expect(email.messageId).toBe('orig-1@mail.example.com')
    expect(email.from).toEqual({ address: 'hong@example.com', name: '홍길동' })
    expect(email.to).toEqual([
      'contact@example.co.kr',
      'reply+abcdef0123456789abcdef01@in.example.co.kr',
    ])
    expect(email.subject).toBe('결제 문의')
    expect(email.text).toBe('안녕하세요\r\n결제가 두 번 됐어요')
    expect(email.html).toBe('<p>안녕하세요</p>')
    expect(email.inReplyTo).toBe('sent-9@resend.dev')
    expect(email.references).toEqual(['sent-8@resend.dev', 'sent-9@resend.dev'])
    expect(email.auth).toEqual({ spf: 'pass', dkim: 'fail', dmarc: 'none' })
    expect(email.receivedAt).toBe('2026-09-09T01:02:03.000Z')
  })

  it('should prefer the fetched attachment list (it carries size and a clean content type)', () => {
    const email = normalizeInbound(WEBHOOK_DATA, FULL_EMAIL)

    expect(email.attachments).toEqual([
      {
        id: 'att-1',
        filename: '영수증.pdf',
        contentType: 'application/pdf',
        size: 1234,
        downloadUrl: null,
        contentDisposition: null,
      },
    ])
  })

  it('should work from the webhook payload alone when the body is inline', () => {
    const email = normalizeInbound({
      ...WEBHOOK_DATA,
      text: 'inline body',
      headers: [{ name: 'X-A', value: '1' }],
    })

    expect(email.text).toBe('inline body')
    expect(email.html).toBeNull()
    expect(email.headers).toEqual({ 'x-a': '1' })
    expect(email.attachments[0]?.size).toBeNull()
    expect(email.auth).toEqual({ spf: null, dkim: null, dmarc: null })
  })

  it('should prefer explicit provider auth fields over the header', () => {
    const email = normalizeInbound({ ...WEBHOOK_DATA, spf: 'FAIL' }, FULL_EMAIL)

    expect(email.auth.spf).toBe('fail')
    expect(email.auth.dkim).toBe('fail')
  })

  it('should fall back to the Message-ID header when the field is absent', () => {
    const email = normalizeInbound({ from: 'a@b.co' }, { headers: { 'Message-Id': '<h@x>' } })

    expect(email.messageId).toBe('h@x')
    expect(email.providerEmailId).toBeNull()
    expect(email.subject).toBe('')
  })
})
