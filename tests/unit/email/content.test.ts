import { describe, expect, it } from 'vitest'

import {
  ALLOWED_ATTACHMENT_TYPES,
  CONTENT_MAX_LENGTH,
  EMPTY_CONTENT,
  MAX_ATTACHMENT_BYTES,
  RATE_LIMITED_PREFIX,
  TRUNCATED_NOTE,
  appendAttachmentNotes,
  buildInquiryContent,
  capContent,
  htmlToText,
  markRateLimited,
  safeStorageFilename,
  selectAttachments,
} from '../../../supabase/functions/_shared/email/content'

import type { InboundAttachmentRef } from '../../../supabase/functions/_shared/email/normalize'

function attachment(overrides: Partial<InboundAttachmentRef>): InboundAttachmentRef {
  return {
    id: 'a',
    filename: 'file.png',
    contentType: 'image/png',
    size: 100,
    downloadUrl: null,
    contentDisposition: null,
    ...overrides,
  }
}

describe('htmlToText', () => {
  it('should turn paragraphs and line breaks into newlines', () => {
    expect(htmlToText('<p>첫 줄</p><p>둘째<br>셋째</p>')).toBe('첫 줄\n\n둘째\n셋째')
  })

  it('should drop script, style and head content entirely', () => {
    const html =
      '<head><title>t</title></head><style>p{}</style><script>alert(1)</script><p>본문</p>'

    expect(htmlToText(html)).toBe('본문')
  })

  it('should decode entities', () => {
    expect(htmlToText('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x41;&nbsp;f')).toBe(
      'a & b <c> "d" \'e\' A f',
    )
  })

  it('should render list items and links readably', () => {
    expect(htmlToText('<ul><li>하나</li><li>둘</li></ul>')).toBe('- 하나\n- 둘')
    expect(htmlToText('<a href="https://x.y">문서</a>')).toBe('문서 (https://x.y)')
    expect(htmlToText('<a href="https://x.y">https://x.y</a>')).toBe('https://x.y')
  })

  it('should collapse excessive blank lines', () => {
    expect(htmlToText('<p>a</p><p></p><p></p><p>b</p>')).toBe('a\n\nb')
  })
})

describe('capContent', () => {
  it('should leave short content alone', () => {
    expect(capContent('짧다')).toBe('짧다')
  })

  it('should truncate to the limit including the note', () => {
    const capped = capContent('가'.repeat(CONTENT_MAX_LENGTH + 10))

    expect(capped).toHaveLength(CONTENT_MAX_LENGTH)
    expect(capped.endsWith(TRUNCATED_NOTE)).toBe(true)
  })
})

describe('buildInquiryContent', () => {
  it('should prefer text and normalise CRLF', () => {
    expect(buildInquiryContent('a\r\nb', '<p>ignored</p>')).toBe('a\nb')
  })

  it('should fall back to html-as-text', () => {
    expect(buildInquiryContent('   ', '<p>본문</p>')).toBe('본문')
  })

  it('should use a placeholder when both are empty', () => {
    expect(buildInquiryContent(null, null)).toBe(EMPTY_CONTENT)
    expect(buildInquiryContent('', '<p></p>')).toBe(EMPTY_CONTENT)
  })
})

describe('markRateLimited', () => {
  it('should prefix the auto-close note', () => {
    expect(markRateLimited('본문')).toBe(`${RATE_LIMITED_PREFIX}\n\n본문`)
  })
})

describe('selectAttachments', () => {
  it('should mirror the bucket allow-list', () => {
    expect(ALLOWED_ATTACHMENT_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/zip',
      'text/plain',
    ])
  })

  it('should exclude disallowed types and oversized files with a reason', () => {
    const selection = selectAttachments([
      attachment({ filename: 'ok.pdf', contentType: 'application/pdf' }),
      attachment({ filename: 'evil.exe', contentType: 'application/x-msdownload' }),
      attachment({ filename: 'page.html', contentType: 'text/html' }),
      attachment({
        filename: 'big.zip',
        contentType: 'application/zip',
        size: MAX_ATTACHMENT_BYTES + 1,
      }),
    ])

    expect(selection.accepted.map((entry) => entry.filename)).toEqual(['ok.pdf'])
    expect(selection.excluded).toEqual([
      { filename: 'evil.exe', reason: 'type' },
      { filename: 'page.html', reason: 'type' },
      { filename: 'big.zip', reason: 'size' },
    ])
    expect(selection.overflow).toBe(0)
  })

  it('should keep at most three and count the overflow', () => {
    const selection = selectAttachments(
      Array.from({ length: 5 }, (_, index) => attachment({ filename: `${index}.png` })),
    )

    expect(selection.accepted).toHaveLength(3)
    expect(selection.overflow).toBe(2)
  })

  it('should accept an unknown size (checked again after download)', () => {
    expect(selectAttachments([attachment({ size: null })]).accepted).toHaveLength(1)
  })
})

describe('appendAttachmentNotes', () => {
  it('should leave content alone when nothing was excluded', () => {
    expect(appendAttachmentNotes('본문', { accepted: [], excluded: [], overflow: 0 })).toBe('본문')
  })

  it('should list excluded names and the overflow count', () => {
    const result = appendAttachmentNotes('본문', {
      accepted: [attachment({}), attachment({}), attachment({})],
      excluded: [{ filename: 'evil.exe', reason: 'type' }],
      overflow: 2,
    })

    expect(result).toBe('본문\n\n제외된 첨부: evil.exe\n첨부 5개 중 3개만 저장했습니다.')
  })
})

describe('safeStorageFilename', () => {
  it('should prefix an index and keep a sanitised stem and extension', () => {
    expect(safeStorageFilename('My Receipt (1).PDF', 0)).toBe('1-My-Receipt-1.pdf')
  })

  it('should strip directories and non-ascii, falling back to "file"', () => {
    expect(safeStorageFilename('../../영수증.png', 2)).toBe('3-file.png')
    expect(safeStorageFilename('', 0)).toBe('1-file')
  })

  it('should cap absurdly long names', () => {
    expect(safeStorageFilename(`${'a'.repeat(500)}.txt`, 0).length).toBeLessThan(100)
  })
})
