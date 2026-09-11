import { describe, expect, it } from 'vitest'

import {
  INQUIRY_REPLY_PLACEHOLDERS,
  SAMPLE_INQUIRY,
  applyReplyTemplate,
  inquiryNumber,
  toPlaceholderValues,
} from '@/lib/utils/inquiry-reply-template'

/**
 * 자리표시자 치환.
 *
 * 이 함수 하나를 관리 화면의 미리보기와 문의 상세의 '템플릿 불러오기' 가 함께 쓴다 —
 * 두 곳이 다른 결과를 내면 저장 전에 본 문장과 실제로 발송되는 문장이 갈린다.
 */

const INQUIRY = {
  id: 'abcd1234-5678-4000-8000-000000000000',
  inquiryNo: 1024,
  title: '아이템이 사라졌어요',
  category: '재화·아이템',
  nickname: '글자용사',
}

describe('inquiryNumber', () => {
  it('should write the receipt number the user sees', () => {
    /* Arrange & Act & Assert — 2026-09-11 이전에는 UUID 앞 8자리였다. 이제는
       사용자 화면·메일·관리자 목록과 **같은 값**이어야 한다. */
    expect(inquiryNumber(INQUIRY.inquiryNo)).toBe('#1024')
  })
})

describe('applyReplyTemplate', () => {
  it('should fill every documented placeholder', () => {
    // Arrange
    const body = INQUIRY_REPLY_PLACEHOLDERS.map((placeholder) => placeholder.token).join(' / ')

    // Act
    const result = applyReplyTemplate(body, INQUIRY)

    // Assert
    expect(result).toBe('글자용사 / #1024 / 재화·아이템 / 아이템이 사라졌어요')
  })

  it('should replace every occurrence and keep the line breaks', () => {
    // Arrange
    const body = '안녕하세요, {{닉네임}}님.\n\n{{닉네임}}님의 문의({{문의번호}})를 확인했습니다.'

    // Act
    const result = applyReplyTemplate(body, INQUIRY)

    // Assert
    expect(result).toBe('안녕하세요, 글자용사님.\n\n글자용사님의 문의(#1024)를 확인했습니다.')
  })

  it('should tolerate spaces inside the braces', () => {
    // Arrange & Act — 운영자가 손으로 적을 때 흔한 모양이다.
    const result = applyReplyTemplate('{{ 닉네임 }}님', INQUIRY)

    // Assert
    expect(result).toBe('글자용사님')
  })

  it('should leave unknown placeholders untouched', () => {
    // Arrange & Act — 운영자가 손으로 채우려고 적어 둔 표시일 수 있다.
    const result = applyReplyTemplate('{{점검일}} 에 처리됩니다.', INQUIRY)

    // Assert
    expect(result).toBe('{{점검일}} 에 처리됩니다.')
  })

  it('should fall back when a value is empty', () => {
    // Arrange — 이메일 문의는 발신자 이름이 비어 있을 수 있다.
    const result = applyReplyTemplate('안녕하세요, {{닉네임}}님.', { ...INQUIRY, nickname: '  ' })

    // Assert — 빈칸으로 두면 "안녕하세요, 님." 이 발송된다.
    expect(result).toBe('안녕하세요, 고객님.')
  })

  it('should leave no placeholder behind for the sample preview', () => {
    // Arrange
    const body = INQUIRY_REPLY_PLACEHOLDERS.map((placeholder) => placeholder.token).join('\n')

    // Act
    const preview = applyReplyTemplate(body, SAMPLE_INQUIRY)

    // Assert — 미리보기에 {{…}} 가 남으면 운영자가 치환을 믿지 못한다.
    expect(preview).not.toContain('{{')
  })
})

describe('toPlaceholderValues', () => {
  it('should expose exactly the documented names', () => {
    // Arrange & Act
    const values = toPlaceholderValues(INQUIRY)

    // Assert — 화면 안내(INQUIRY_REPLY_PLACEHOLDERS)와 코드가 어긋나면 안내가 거짓이 된다.
    expect(Object.keys(values).sort()).toEqual(
      INQUIRY_REPLY_PLACEHOLDERS.map((placeholder) =>
        placeholder.token.replace('{{', '').replace('}}', ''),
      ).sort(),
    )
  })
})
