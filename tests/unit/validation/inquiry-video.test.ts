import { describe, expect, it } from 'vitest'

import {
  INQUIRY_ATTACHMENT_MAX_TOTAL,
  INQUIRY_VIDEO_MAX_BYTES,
  INQUIRY_VIDEO_MAX_COUNT,
  INQUIRY_VIDEO_MAX_MB,
} from '@/lib/supabase/storage'
import { INQUIRY_ATTACHMENT_ACCEPT } from '@/lib/validation/inquiry'
import {
  isVideoAttachment,
  parsePendingInquiryVideos,
  validateInquiryVideo,
} from '@/lib/validation/inquiry-video'

import type { VideoCandidate } from '@/lib/validation/inquiry-video'

/**
 * 영상 첨부 규칙.
 *
 * 이 판정은 클라이언트(안내)와 서버(신뢰 경계)가 같이 쓴다. 한쪽만 고치면
 * "화면에서는 되는데 접수는 거절되는" 조합이 생기므로 규칙 자체를 여기서 못 박는다.
 */

function videoOf(name: string, type: string, size: number): VideoCandidate {
  return { name, type, size }
}

const NO_OTHERS = { videoCount: 0, otherCount: 0 }

describe('validateInquiryVideo', () => {
  it('should accept the four formats the bucket allows', () => {
    // Arrange & Act & Assert — 버킷 allowed_mime_types(20260910000600)와 같은 목록이어야 한다.
    for (const mime of ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']) {
      expect(validateInquiryVideo(videoOf('clip', mime, 1024), NO_OTHERS).ok).toBe(true)
    }
  })

  it('should reject a format outside the allow list', () => {
    // Arrange & Act
    const check = validateInquiryVideo(videoOf('clip.avi', 'video/x-msvideo', 1024), NO_OTHERS)

    // Assert — 버킷에서 걸리면 사용자는 영문 스토리지 오류만 본다.
    expect(check).toEqual({ ok: false, message: 'mp4 · mov · webm · m4v 영상만 올릴 수 있습니다.' })
  })

  it('should reject an empty file', () => {
    // Arrange & Act
    const check = validateInquiryVideo(videoOf('clip.mp4', 'video/mp4', 0), NO_OTHERS)

    // Assert
    expect(check).toEqual({ ok: false, message: '빈 파일은 올릴 수 없습니다.' })
  })

  it('should reject a video over the per-file limit and name the file', () => {
    // Arrange & Act
    const check = validateInquiryVideo(
      videoOf('long.mp4', 'video/mp4', INQUIRY_VIDEO_MAX_BYTES + 1),
      NO_OTHERS,
    )

    // Assert — 어느 파일이 문제인지 보이지 않으면 여러 개를 고른 사용자는 다시 고를 수 없다.
    expect(check.ok).toBe(false)
    expect(check.ok ? '' : check.message).toContain('long.mp4')
    expect(check.ok ? '' : check.message).toContain(`${INQUIRY_VIDEO_MAX_MB}MB`)
  })

  it('should accept a video exactly at the per-file limit', () => {
    // Arrange & Act — 경계값은 통과해야 한다(안내가 "100MB 이하"라고 적혀 있다).
    const check = validateInquiryVideo(
      videoOf('edge.mp4', 'video/mp4', INQUIRY_VIDEO_MAX_BYTES),
      NO_OTHERS,
    )

    // Assert
    expect(check.ok).toBe(true)
  })

  it('should refuse more videos than the video-only limit', () => {
    // Arrange & Act — 3번째 영상(이미지·PDF 는 하나도 없어도 영상 자리는 2개뿐이다).
    const check = validateInquiryVideo(videoOf('third.mp4', 'video/mp4', 1024), {
      videoCount: INQUIRY_VIDEO_MAX_COUNT,
      otherCount: 0,
    })

    // Assert — 2026-09-11 부터 영상은 이미지·PDF 와 별도 자리를 쓴다.
    expect(check).toEqual({
      ok: false,
      message: `영상은 최대 ${INQUIRY_VIDEO_MAX_COUNT}개까지 첨부할 수 있습니다.`,
    })
  })

  it('should accept a video even when the image slots are already full', () => {
    // Arrange & Act — 이미지·PDF 3개가 이미 자리를 잡고 있어도 영상은 별도 자리다.
    const check = validateInquiryVideo(videoOf('clip.mp4', 'video/mp4', 1024), {
      videoCount: 0,
      otherCount: 3,
    })

    // Assert — 3(이미지) + 1(영상) = 4, 전체 상한(5) 이내다.
    expect(check.ok).toBe(true)
  })

  it('should count videos against the overall attachment limit', () => {
    /* Arrange — 영상 자리는 아직 하나 남아 있지만(1/2), 전체로는 이미 5개가 찬 상태다.
       (영상 상한 자체는 넘지 않으므로 이 케이스는 "합계" 검사만 걸린다.) */
    const check = validateInquiryVideo(videoOf('clip.mp4', 'video/mp4', 1024), {
      videoCount: 1,
      otherCount: 4,
    })

    // Assert — DB CHECK(`inquiries_attachments_max_5`)와 같은 숫자다.
    expect(check).toEqual({
      ok: false,
      message: `첨부파일은 최대 ${INQUIRY_ATTACHMENT_MAX_TOTAL}개까지 첨부할 수 있습니다.`,
    })
  })
})

describe('INQUIRY_ATTACHMENT_ACCEPT', () => {
  it('should list video types and extensions so mobile pickers open the gallery', () => {
    // Arrange & Act & Assert — MIME 만 주면 확장자로 판단하는 환경이, 확장자만 주면
    // 일부 모바일 브라우저가 파일을 잠근다.
    for (const token of ['video/mp4', 'video/quicktime', '.mp4', '.mov', '.webm', '.m4v']) {
      expect(INQUIRY_ATTACHMENT_ACCEPT.split(',')).toContain(token)
    }
  })
})

describe('isVideoAttachment', () => {
  it('should split videos from images by MIME prefix', () => {
    // Arrange & Act & Assert — 화면(상세·관리자)이 재생기를 세울 근거다.
    expect(isVideoAttachment('video/mp4')).toBe(true)
    expect(isVideoAttachment('image/png')).toBe(false)
    expect(isVideoAttachment('')).toBe(false)
  })
})

describe('parsePendingInquiryVideos', () => {
  it('should read an empty field as no videos', () => {
    // Arrange & Act & Assert — 폼은 영상을 안 붙여도 필드를 그린다.
    expect(parsePendingInquiryVideos('')).toEqual([])
    expect(parsePendingInquiryVideos('   ')).toEqual([])
  })

  it('should read a well formed list', () => {
    // Arrange
    const raw = JSON.stringify([
      { path: 'uid/pending/a.mp4', name: '재현.mp4', size: 10, mimeType: 'video/mp4' },
    ])

    // Act
    const parsed = parsePendingInquiryVideos(raw)

    // Assert
    expect(parsed).toEqual([
      { path: 'uid/pending/a.mp4', name: '재현.mp4', size: 10, mimeType: 'video/mp4' },
    ])
  })

  it('should return null for a malformed field instead of silently dropping it', () => {
    // Arrange & Act & Assert — 빈 목록으로 삼키면 영상이 이유 없이 빠진 문의가 접수된다.
    expect(parsePendingInquiryVideos('not json')).toBeNull()
    expect(parsePendingInquiryVideos('{"path":"a"}')).toBeNull()
    expect(parsePendingInquiryVideos('[{"path":"a"}]')).toBeNull()
  })

  it('should refuse a list longer than the video limit', () => {
    // Arrange — 직접 POST 로 목록만 늘리는 시도.
    const raw = JSON.stringify(
      Array.from({ length: INQUIRY_VIDEO_MAX_COUNT + 1 }, (_, index) => ({
        path: `uid/pending/${index}.mp4`,
        name: `${index}.mp4`,
        size: 10,
        mimeType: 'video/mp4',
      })),
    )

    // Act & Assert
    expect(parsePendingInquiryVideos(raw)).toBeNull()
  })
})
