import { describe, expect, it } from 'vitest'

import { checkAutoReply } from '../../../supabase/functions/_shared/email/loop-guard'
import { normalizeInbound } from '../../../supabase/functions/_shared/email/normalize'

const OWN = ['support@example.co.kr', 'contact@example.co.kr']

function email(headers: Record<string, string>, from = 'user@example.com') {
  return normalizeInbound({ from, subject: 'hi' }, { headers })
}

describe('checkAutoReply', () => {
  it('should let a normal human email through', () => {
    expect(checkAutoReply(email({}), OWN)).toEqual({ blocked: false })
  })

  it('should block Auto-Submitted other than "no"', () => {
    expect(checkAutoReply(email({ 'Auto-Submitted': 'auto-replied' }), OWN).blocked).toBe(true)
    expect(checkAutoReply(email({ 'Auto-Submitted': 'auto-generated' }), OWN).blocked).toBe(true)
    expect(checkAutoReply(email({ 'Auto-Submitted': 'no' }), OWN).blocked).toBe(false)
  })

  it('should block bulk, junk and list precedence', () => {
    for (const value of ['bulk', 'junk', 'list', 'Bulk']) {
      expect(checkAutoReply(email({ Precedence: value }), OWN).blocked).toBe(true)
    }

    expect(checkAutoReply(email({ Precedence: 'normal' }), OWN).blocked).toBe(false)
  })

  it('should block X-Autoreply style headers', () => {
    expect(checkAutoReply(email({ 'X-Autoreply': 'yes' }), OWN).blocked).toBe(true)
    expect(checkAutoReply(email({ 'X-Autorespond': '1' }), OWN).blocked).toBe(true)
  })

  it('should block mailing-list traffic and delivery reports', () => {
    expect(checkAutoReply(email({ 'List-Unsubscribe': '<mailto:x>' }), OWN).blocked).toBe(true)
    expect(
      checkAutoReply(
        email({ 'Content-Type': 'multipart/report; report-type=delivery-status' }),
        OWN,
      ).blocked,
    ).toBe(true)
  })

  it('should block system senders', () => {
    expect(checkAutoReply(email({}, 'MAILER-DAEMON@mx.example.com'), OWN).blocked).toBe(true)
    expect(checkAutoReply(email({}, 'no-reply@shop.example'), OWN).blocked).toBe(true)
    expect(checkAutoReply(email({}, 'noreply@shop.example'), OWN).blocked).toBe(true)
    expect(checkAutoReply(email({}, 'postmaster@shop.example'), OWN).blocked).toBe(true)
  })

  it('should block mail from our own sending addresses regardless of case', () => {
    expect(checkAutoReply(email({}, 'Support@Example.co.kr'), OWN)).toEqual({
      blocked: true,
      reason: 'own-address',
    })
  })

  it('should not block a sender whose local part merely contains "reply"', () => {
    expect(checkAutoReply(email({}, 'replyguy@example.com'), OWN).blocked).toBe(false)
  })
})
