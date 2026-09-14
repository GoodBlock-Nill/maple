import { describe, expect, it } from 'vitest'

import {
  INQUIRY_ATTACHMENT_FILE_MAX_BYTES,
  INQUIRY_ATTACHMENT_MAX_COUNT,
  INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
} from '@/lib/supabase/storage'
import {
  INQUIRY_ATTACHMENT_ACCEPT,
  parsePendingInquiryUploads,
  toUploadCandidates,
  validateInquiryAttachments,
} from '@/lib/validation/inquiry-upload'
import { isVideoAttachment } from '@/lib/validation/inquiry-video'

import type { UploadCandidate } from '@/lib/validation/inquiry-upload'

/**
 * 첨부 규칙 — **형식에 관계없이** 5개 · 합계 200MB(오너 지시, 2026-09-14).
 *
 * 이 판정은 클라이언트(안내)와 서버(신뢰 경계)가 같이 쓴다. 한쪽만 고치면 "화면에서는
 * 되는데 접수는 거절되는" 조합이 생기므로 규칙 자체를 여기서 못 박는다. 숫자는 DB
 * CHECK(`*_attachments_max_5` · `*_attachments_total_bytes_max_200mb`)와 같아야 한다.
 */

const MEGABYTE = 1024 * 1024

function fileOf(name: string, type: string, size: number): UploadCandidate {
  return { name, type, size }
}

const png = fileOf('shot.png', 'image/png', 1024)
const mp4 = fileOf('clip.mp4', 'video/mp4', 2048)
const pdf = fileOf('doc.pdf', 'application/pdf', 4096)

describe('validateInquiryAttachments', () => {
  it('should accept five attachments of any mix', () => {
    // Arrange & Act — 이미지 2 + PDF 1 + 영상 2. 예전 규칙이면 종류별 상한에 걸렸다.
    const result = validateInquiryAttachments([], [png, png, pdf, mp4, mp4])

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should accept five videos — the old 2-video cap is gone', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([], [mp4, mp4, mp4, mp4, mp4])

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should accept five images — the old 3-image cap is gone', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([], [png, png, png, png, png])

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should reject a sixth attachment with one message for every format', () => {
    // Arrange & Act
    const result = validateInquiryAttachments([], [png, png, png, mp4, mp4, pdf])

    // Assert — 종류를 따지지 않으므로 문구도 하나다.
    expect(result).toEqual({
      ok: false,
      message: `첨부파일은 최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개까지 올릴 수 있습니다.`,
    })
  })

  it('should count the attachments kept in the edit form against the limit', () => {
    // Arrange — 수정 화면에서 남기는 기존 첨부도 자리를 차지한다.
    const kept = [{ size: 1024 }, { size: 1024 }, { size: 1024 }, { size: 1024 }]

    // Act
    const withinLimit = validateInquiryAttachments(kept, [png])
    const overLimit = validateInquiryAttachments(kept, [png, mp4])

    // Assert
    expect(withinLimit.ok).toBe(true)
    expect(overLimit.ok).toBe(false)
  })

  it('should reject unsupported types', () => {
    // Arrange & Act — 버킷은 이메일 첨부 때문에 zip 을 받지만 웹 폼은 받지 않는다.
    const result = validateInquiryAttachments([], [fileOf('a.zip', 'application/zip', 10)])

    // Assert
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('PDF')
  })

  it('should accept every format the bucket allows for the web form', () => {
    // Arrange & Act & Assert — 버킷 allowed_mime_types(20260909000300 · 20260910000600)의
    // 웹 폼 몫과 같은 목록이어야 한다.
    for (const mime of [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-m4v',
    ]) {
      expect(validateInquiryAttachments([], [fileOf('file', mime, 1024)]).ok).toBe(true)
    }
  })

  it('should reject a format outside the allow list', () => {
    // Arrange & Act — 버킷에서 걸리면 사용자는 영문 스토리지 오류만 본다.
    const result = validateInquiryAttachments([], [fileOf('clip.avi', 'video/x-msvideo', 1024)])

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should reject empty files', () => {
    // Arrange & Act — 0바이트 오브젝트가 스토리지에 남으면 답변자가 열 수 없다.
    const result = validateInquiryAttachments([], [{ ...png, size: 0 }])

    // Assert
    expect(result).toEqual({ ok: false, message: '빈 파일은 올릴 수 없습니다.' })
  })

  it('should reject a file over the per-file limit and name it', () => {
    // Arrange & Act
    const result = validateInquiryAttachments(
      [],
      [fileOf('long.mp4', 'video/mp4', INQUIRY_ATTACHMENT_FILE_MAX_BYTES + 1)],
    )

    // Assert — 어느 파일이 문제인지 알려 줘야 사용자가 다시 고를 수 있다.
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('long.mp4')
    expect(result.ok === false && result.message).toContain(`${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB`)
  })

  it('should accept a file exactly at the limit', () => {
    // Arrange & Act — 경계값은 통과해야 한다(안내가 "총 200MB"라고 적혀 있다).
    const result = validateInquiryAttachments(
      [],
      [fileOf('edge.mp4', 'video/mp4', INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES)],
    )

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should reject a selection whose total exceeds the shared budget', () => {
    // Arrange — 각 파일은 상한 이내지만 합치면 200MB 를 넘는다.
    const big = fileOf('big.mp4', 'video/mp4', 60 * MEGABYTE)

    // Act
    const result = validateInquiryAttachments([], [big, big, big, big])

    // Assert
    expect(result).toEqual({
      ok: false,
      message: `첨부파일은 합쳐서 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB 이하만 올릴 수 있습니다.`,
    })
  })

  it('should count the bytes of kept attachments in the total', () => {
    // Arrange & Act — 수정 화면에서 남긴 190MB 위에 20MB 를 더 붙일 수는 없다.
    const kept = [{ size: 190 * MEGABYTE }]

    // Assert
    expect(validateInquiryAttachments(kept, [fileOf('a.mp4', 'video/mp4', 20 * MEGABYTE)]).ok).toBe(
      false,
    )
    expect(validateInquiryAttachments(kept, [fileOf('a.mp4', 'video/mp4', 5 * MEGABYTE)]).ok).toBe(
      true,
    )
  })

  it('should keep the per-file limit inside the total budget', () => {
    // Arrange & Act & Assert — 한 파일이 합계를 넘을 수 있으면 규칙이 서로 어긋난다.
    expect(INQUIRY_ATTACHMENT_FILE_MAX_BYTES).toBeLessThanOrEqual(
      INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES,
    )
  })
})

describe('INQUIRY_ATTACHMENT_ACCEPT', () => {
  it('should list MIME types as well as extensions for every format', () => {
    // Arrange & Act — 확장자만 주면 일부 모바일 브라우저가 사진 선택을 잠그고,
    // MIME 만 주면 확장자로만 판단하는 환경이 파일을 잠근다.
    const accept = INQUIRY_ATTACHMENT_ACCEPT.split(',')

    // Assert
    for (const token of [
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'video/mp4',
      'video/quicktime',
      '.jpg',
      '.jpeg',
      '.pdf',
      '.mp4',
      '.mov',
      '.webm',
      '.m4v',
    ]) {
      expect(accept).toContain(token)
    }
  })
})

describe('isVideoAttachment', () => {
  it('should split videos from other files by MIME prefix', () => {
    // Arrange & Act & Assert — 규칙이 아니라 화면(재생기 vs 링크)이 쓰는 판정이다.
    expect(isVideoAttachment('video/mp4')).toBe(true)
    expect(isVideoAttachment('image/png')).toBe(false)
    expect(isVideoAttachment('')).toBe(false)
  })
})

describe('parsePendingInquiryUploads', () => {
  it('should read an empty field as no attachments', () => {
    // Arrange & Act & Assert — 폼은 첨부를 안 붙여도 필드를 그린다.
    expect(parsePendingInquiryUploads('')).toEqual([])
    expect(parsePendingInquiryUploads('   ')).toEqual([])
  })

  it('should read a well formed list of any type', () => {
    // Arrange
    const raw = JSON.stringify([
      { path: 'uid/pending/a.mp4', name: '재현.mp4', size: 10, mimeType: 'video/mp4' },
      { path: 'uid/pending/b.png', name: '화면.png', size: 20, mimeType: 'image/png' },
    ])

    // Act
    const parsed = parsePendingInquiryUploads(raw)

    // Assert
    expect(parsed).toHaveLength(2)
    expect(parsed?.[1]?.mimeType).toBe('image/png')
  })

  it('should return null for a malformed field instead of silently dropping it', () => {
    // Arrange & Act & Assert — 빈 목록으로 삼키면 첨부가 이유 없이 빠진 문의가 접수된다.
    expect(parsePendingInquiryUploads('not json')).toBeNull()
    expect(parsePendingInquiryUploads('{"path":"a"}')).toBeNull()
    expect(parsePendingInquiryUploads('[{"path":"a"}]')).toBeNull()
  })

  it('should refuse a list longer than the attachment limit', () => {
    // Arrange — 직접 POST 로 목록만 늘리는 시도.
    const raw = JSON.stringify(
      Array.from({ length: INQUIRY_ATTACHMENT_MAX_COUNT + 1 }, (_, index) => ({
        path: `uid/pending/${index}.mp4`,
        name: `${index}.mp4`,
        size: 10,
        mimeType: 'video/mp4',
      })),
    )

    // Act & Assert
    expect(parsePendingInquiryUploads(raw)).toBeNull()
  })
})

describe('toUploadCandidates', () => {
  it('should rename mimeType to type so the rules see one shape', () => {
    // Arrange & Act — DB 모양(`mimeType`)과 File 모양(`type`)을 오가는 자리가 네 곳이다.
    const candidates = toUploadCandidates([
      { path: 'uid/pending/a.png', name: 'a.png', size: 10, mimeType: 'image/png' },
    ])

    // Assert
    expect(candidates).toEqual([{ name: 'a.png', type: 'image/png', size: 10 }])
  })
})
