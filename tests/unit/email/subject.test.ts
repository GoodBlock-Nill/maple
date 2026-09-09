import { describe, expect, it } from 'vitest'

import {
  EMPTY_SUBJECT_TITLE,
  INQUIRY_TITLE_MAX_LENGTH,
  inquiryTitleFromSubject,
  replySubject,
  shortInquiryId,
} from '../../../supabase/functions/_shared/email/subject'

const INQUIRY_ID = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b'

describe('shortInquiryId', () => {
  it('should take the first 8 hex characters without dashes', () => {
    expect(shortInquiryId(INQUIRY_ID)).toBe('3f2a9c1e')
  })
})

describe('inquiryTitleFromSubject', () => {
  it('should trim and collapse whitespace', () => {
    expect(inquiryTitleFromSubject('  결제가   안 돼요 \n')).toBe('결제가 안 돼요')
  })

  it('should substitute a placeholder for an empty subject', () => {
    expect(inquiryTitleFromSubject('')).toBe(EMPTY_SUBJECT_TITLE)
    expect(inquiryTitleFromSubject(null)).toBe(EMPTY_SUBJECT_TITLE)
    expect(inquiryTitleFromSubject('   ')).toBe(EMPTY_SUBJECT_TITLE)
  })

  it('should cap very long subjects', () => {
    const title = inquiryTitleFromSubject('가'.repeat(INQUIRY_TITLE_MAX_LENGTH + 50))

    expect(title).toHaveLength(INQUIRY_TITLE_MAX_LENGTH)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('replySubject', () => {
  it('should prefix Re: and append the inquiry tag', () => {
    expect(replySubject('결제 문의', INQUIRY_ID)).toBe('Re: 결제 문의 [문의 #3f2a9c1e]')
  })

  it('should not stack reply prefixes', () => {
    expect(replySubject('Re: RE: 답장: 결제 문의', INQUIRY_ID)).toBe(
      'Re: 결제 문의 [문의 #3f2a9c1e]',
    )
  })

  it('should not duplicate an existing inquiry tag', () => {
    expect(replySubject('Re: 결제 문의 [문의 #3f2a9c1e]', INQUIRY_ID)).toBe(
      'Re: 결제 문의 [문의 #3f2a9c1e]',
    )
  })

  it('should handle an empty subject', () => {
    expect(replySubject('', INQUIRY_ID)).toBe(`Re: ${EMPTY_SUBJECT_TITLE} [문의 #3f2a9c1e]`)
    expect(replySubject('Re:', INQUIRY_ID)).toBe(`Re: ${EMPTY_SUBJECT_TITLE} [문의 #3f2a9c1e]`)
  })
})
