import { describe, expect, it } from 'vitest'

import {
  EMPTY_SUBJECT_TITLE,
  INQUIRY_TITLE_MAX_LENGTH,
  inquiryNoTag,
  inquiryTitleFromSubject,
  replySubject,
} from '../../../supabase/functions/_shared/email/subject'

/** 접수번호(`inquiries.inquiry_no`). 사용자 화면·관리자 콘솔과 같은 값이다. */
const INQUIRY_NO = 1024

describe('inquiryNoTag', () => {
  it('should name the service so the tag survives in a crowded inbox', () => {
    expect(inquiryNoTag(INQUIRY_NO)).toBe('[글자월드 문의 #1024]')
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
  it('should prefix Re: and append the receipt number tag', () => {
    expect(replySubject('결제 문의', INQUIRY_NO)).toBe('Re: 결제 문의 [글자월드 문의 #1024]')
  })

  it('should not stack reply prefixes', () => {
    expect(replySubject('Re: RE: 답장: 결제 문의', INQUIRY_NO)).toBe(
      'Re: 결제 문의 [글자월드 문의 #1024]',
    )
  })

  it('should not duplicate an existing inquiry tag', () => {
    expect(replySubject('Re: 결제 문의 [글자월드 문의 #1024]', INQUIRY_NO)).toBe(
      'Re: 결제 문의 [글자월드 문의 #1024]',
    )
  })

  it('should strip the old uuid tag left over in older threads', () => {
    /* 2026-09-11 이전에 나간 답신에 사용자가 답장하면 제목에 옛 태그가 남아 있다.
       그대로 두면 `[문의 #3f2a9c1e] [글자월드 문의 #1024]` 가 된다. */
    expect(replySubject('Re: 결제 문의 [문의 #3f2a9c1e]', INQUIRY_NO)).toBe(
      'Re: 결제 문의 [글자월드 문의 #1024]',
    )
  })

  it('should handle an empty subject', () => {
    expect(replySubject('', INQUIRY_NO)).toBe(`Re: ${EMPTY_SUBJECT_TITLE} [글자월드 문의 #1024]`)
    expect(replySubject('Re:', INQUIRY_NO)).toBe(`Re: ${EMPTY_SUBJECT_TITLE} [글자월드 문의 #1024]`)
  })
})
