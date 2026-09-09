import { describe, expect, it } from 'vitest'

import {
  readSvixHeaders,
  signSvixPayload,
  verifySvixSignature,
} from '../../../supabase/functions/_shared/email/svix'

/* Svix 문서의 예시 형식(whsec_ + base64). 값은 테스트용이다. */
const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const ID = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
const BODY = '{"type":"email.received","data":{"email_id":"abc"}}'
const NOW = 1_700_000_000

async function signedHeaders(timestamp = String(NOW)) {
  const signature = await signSvixPayload(SECRET, ID, timestamp, BODY)

  return { id: ID, timestamp, signature: `v1,${signature}` }
}

describe('verifySvixSignature', () => {
  it('should accept a payload signed with the shared secret', async () => {
    const headers = await signedHeaders()

    const result = await verifySvixSignature({
      secret: SECRET,
      headers,
      body: BODY,
      nowSeconds: NOW,
    })

    expect(result).toEqual({ ok: true })
  })

  it('should accept when one of several space-separated signatures matches', async () => {
    const headers = await signedHeaders()
    headers.signature = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${headers.signature}`

    const result = await verifySvixSignature({
      secret: SECRET,
      headers,
      body: BODY,
      nowSeconds: NOW,
    })

    expect(result.ok).toBe(true)
  })

  it('should reject when the body was altered', async () => {
    const headers = await signedHeaders()

    const result = await verifySvixSignature({
      secret: SECRET,
      headers,
      body: `${BODY} `,
      nowSeconds: NOW,
    })

    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' })
  })

  it('should reject a different secret', async () => {
    const headers = await signedHeaders()

    const result = await verifySvixSignature({
      secret: 'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      headers,
      body: BODY,
      nowSeconds: NOW,
    })

    expect(result.ok).toBe(false)
  })

  it('should reject a timestamp older than five minutes', async () => {
    const headers = await signedHeaders(String(NOW - 301))

    const result = await verifySvixSignature({
      secret: SECRET,
      headers,
      body: BODY,
      nowSeconds: NOW,
    })

    expect(result).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' })
  })

  it('should accept a timestamp within five minutes either way', async () => {
    const past = await signedHeaders(String(NOW - 299))
    const future = await signedHeaders(String(NOW + 299))

    expect(
      (await verifySvixSignature({ secret: SECRET, headers: past, body: BODY, nowSeconds: NOW }))
        .ok,
    ).toBe(true)
    expect(
      (await verifySvixSignature({ secret: SECRET, headers: future, body: BODY, nowSeconds: NOW }))
        .ok,
    ).toBe(true)
  })

  it('should reject when a header is missing', async () => {
    const result = await verifySvixSignature({
      secret: SECRET,
      headers: { id: ID, timestamp: String(NOW), signature: null },
      body: BODY,
      nowSeconds: NOW,
    })

    expect(result).toEqual({ ok: false, reason: 'missing_headers' })
  })

  it('should reject a non-numeric timestamp', async () => {
    const result = await verifySvixSignature({
      secret: SECRET,
      headers: { id: ID, timestamp: 'yesterday', signature: 'v1,abc' },
      body: BODY,
      nowSeconds: NOW,
    })

    expect(result).toEqual({ ok: false, reason: 'bad_timestamp' })
  })

  it('should reject when no v1 signature is present', async () => {
    const result = await verifySvixSignature({
      secret: SECRET,
      headers: { id: ID, timestamp: String(NOW), signature: 'v2,abc' },
      body: BODY,
      nowSeconds: NOW,
    })

    expect(result).toEqual({ ok: false, reason: 'no_v1_signature' })
  })
})

describe('readSvixHeaders', () => {
  it('should read svix-* headers', () => {
    const headers = new Headers({ 'svix-id': 'a', 'svix-timestamp': '1', 'svix-signature': 'v1,x' })

    expect(readSvixHeaders(headers)).toEqual({ id: 'a', timestamp: '1', signature: 'v1,x' })
  })

  it('should fall back to webhook-* headers', () => {
    const headers = new Headers({
      'webhook-id': 'b',
      'webhook-timestamp': '2',
      'webhook-signature': 'v1,y',
    })

    expect(readSvixHeaders(headers)).toEqual({ id: 'b', timestamp: '2', signature: 'v1,y' })
  })

  it('should return nulls when absent', () => {
    expect(readSvixHeaders(new Headers())).toEqual({ id: null, timestamp: null, signature: null })
  })
})
