import { describe, expect, it } from 'vitest'

import {
  decideNewsTemplateApply,
  findNewsTemplate,
  isBlankPostHtml,
  newsTemplatePatch,
  type NewsTemplate,
} from '@/lib/utils/news-template-prefill'

/**
 * 템플릿 적용 판정 — **내용을 지울 수도 있는** 결정이라 규칙을 여기서 고정한다.
 *
 * 확인 모달이 뜨는 조건이 흔들리면 두 방향으로 사고가 난다. 너무 자주 물으면 운영자가
 * 습관적으로 '적용'을 눌러 확인이 의미를 잃고, 묻지 않으면 쓰던 글이 말없이 사라진다.
 */

const TEMPLATE: NewsTemplate = {
  categoryKey: 'maintenance',
  title: '[점검] {{날짜}} 정기 점검 안내',
  summary: '{{날짜}} 점검 안내',
  body: '<h3>점검 일시</h3><p>{{날짜}}</p>',
  isActive: true,
}

describe('isBlankPostHtml', () => {
  it('should treat an empty editor document as blank', () => {
    // Arrange & Act & Assert — 저장된 글을 열면 `<p></p>` 가 올 수 있다.
    expect(isBlankPostHtml('')).toBe(true)
    expect(isBlankPostHtml('<p></p>')).toBe(true)
    expect(isBlankPostHtml('<p>&nbsp;</p>')).toBe(true)
  })

  it('should treat text as not blank', () => {
    // Arrange & Act & Assert
    expect(isBlankPostHtml('<p>작성 중</p>')).toBe(false)
  })

  it('should treat a media-only body as not blank', () => {
    // Arrange & Act & Assert — 글자가 없다고 붙여 넣은 이미지를 말없이 지우면 안 된다.
    expect(isBlankPostHtml('<p><img src="https://example.com/a.png"></p>')).toBe(false)
    expect(isBlankPostHtml('<div data-video="youtube:abc"></div>')).toBe(false)
  })
})

describe('decideNewsTemplateApply', () => {
  it('should do nothing when the category has no template', () => {
    // Arrange & Act
    const decision = decideNewsTemplateApply({
      template: null,
      currentBody: '<p>작성 중</p>',
      appliedBody: null,
    })

    // Assert
    expect(decision).toBe('none')
  })

  it('should do nothing when the template is switched off', () => {
    // Arrange & Act — 꺼 둔 템플릿은 새 글 폼에서 아무 일도 하지 않는다.
    const decision = decideNewsTemplateApply({
      template: { ...TEMPLATE, isActive: false },
      currentBody: '',
      appliedBody: null,
    })

    // Assert
    expect(decision).toBe('none')
  })

  it('should do nothing when the template has nothing to fill', () => {
    // Arrange & Act
    const decision = decideNewsTemplateApply({
      template: { ...TEMPLATE, title: '', summary: '', body: '' },
      currentBody: '',
      appliedBody: null,
    })

    // Assert
    expect(decision).toBe('none')
  })

  it('should apply straight away when the body is empty', () => {
    // Arrange & Act
    const decision = decideNewsTemplateApply({
      template: TEMPLATE,
      currentBody: '<p></p>',
      appliedBody: null,
    })

    // Assert
    expect(decision).toBe('apply')
  })

  it('should apply without asking when only the title template exists', () => {
    // Arrange & Act — 본문을 건드리지 않으니 지워질 것이 없다.
    const decision = decideNewsTemplateApply({
      template: { ...TEMPLATE, body: '' },
      currentBody: '<p>운영자가 쓴 글</p>',
      appliedBody: null,
    })

    // Assert
    expect(decision).toBe('apply')
  })

  it('should apply without asking when the body is the previous template untouched', () => {
    // Arrange & Act — 카테고리를 연달아 바꿔 보는 흔한 동작. 잃을 내용이 없다.
    const previous = '<h3>기간</h3><p>{{시작일}}</p>'
    const decision = decideNewsTemplateApply({
      template: TEMPLATE,
      currentBody: previous,
      appliedBody: previous,
    })

    // Assert
    expect(decision).toBe('apply')
  })

  it('should ask when the operator has written something', () => {
    // Arrange & Act
    const decision = decideNewsTemplateApply({
      template: TEMPLATE,
      currentBody: '<h3>기간</h3><p>10월 1일부터 진행합니다.</p>',
      appliedBody: '<h3>기간</h3><p>{{시작일}}</p>',
    })

    // Assert
    expect(decision).toBe('confirm')
  })
})

describe('newsTemplatePatch', () => {
  it('should fill an empty title and summary', () => {
    // Arrange & Act
    const patch = newsTemplatePatch(TEMPLATE, { title: '', summary: '   ' })

    // Assert
    expect(patch).toEqual({
      title: TEMPLATE.title,
      summary: TEMPLATE.summary,
      body: TEMPLATE.body,
    })
  })

  it('should never overwrite a title the operator typed', () => {
    // Arrange & Act — 지우지 않은 문장이 사라지는 경험을 만들지 않는다.
    const patch = newsTemplatePatch(TEMPLATE, { title: '10월 정기 점검', summary: '요약' })

    // Assert
    expect(patch.title).toBeNull()
    expect(patch.summary).toBeNull()
    expect(patch.body).toBe(TEMPLATE.body)
  })

  it('should leave the body alone when the template body is empty', () => {
    // Arrange & Act
    const patch = newsTemplatePatch({ ...TEMPLATE, body: '' }, { title: '', summary: '' })

    // Assert — null 은 "그대로 둔다"는 뜻이다.
    expect(patch.body).toBeNull()
  })
})

describe('findNewsTemplate', () => {
  it('should return null for a category with no template', () => {
    // Arrange & Act & Assert — 카테고리가 추가돼도 폼이 깨지지 않는다.
    expect(findNewsTemplate([TEMPLATE], 'event')).toBeNull()
    expect(findNewsTemplate([TEMPLATE], 'maintenance')).toBe(TEMPLATE)
  })
})
