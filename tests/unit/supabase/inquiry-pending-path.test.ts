import { describe, expect, it } from 'vitest'

import {
  buildInquiryPendingPath,
  inquiryPendingFolder,
  isInquiryPendingPath,
  isUserScopedPath,
} from '@/lib/supabase/storage'

/**
 * 접수 전 영상이 머무는 경로.
 *
 * 이 경로 모양 하나가 세 가지를 결정한다 — 삭제 정책이 여는 범위, 야간 배치가
 * "버려진 파일"로 보는 범위, 서버가 폼에서 받은 경로를 받아들일지 말지.
 */

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER_ID = 'cccccccc-0000-4000-8000-000000000009'
const FILE_ID = 'bbbbbbbb-0000-4000-8000-000000000002'

describe('buildInquiryPendingPath', () => {
  it('should place the object under {uid}/pending so both policies pass', () => {
    // Arrange & Act
    const path = buildInquiryPendingPath({ userId: USER_ID, id: FILE_ID, extension: 'mp4' })

    // Assert — 정책은 모두 첫 세그먼트(= uid)만 본다. 업로드는
    // `inquiry_attachments_insert_own`, 취소 시 삭제는 `inquiry_attachments_delete_own`.
    // pending 은 그 접두사 안쪽이라 같은 권한으로 통과한다.
    expect(path).toBe(`${USER_ID}/pending/${FILE_ID}.mp4`)
    expect(isUserScopedPath(path, USER_ID)).toBe(true)
    expect(isInquiryPendingPath(path, USER_ID)).toBe(true)
  })

  it('should expose the folder the existence check lists', () => {
    // Arrange & Act & Assert
    expect(inquiryPendingFolder(USER_ID)).toBe(`${USER_ID}/pending`)
  })

  it('should refuse a file name that is not a uuid', () => {
    // Arrange & Act & Assert — 원본 파일명이 새어 들어오면 경로 탈출이 가능해진다.
    expect(() =>
      buildInquiryPendingPath({ userId: USER_ID, id: '../../etc/passwd', extension: 'mp4' }),
    ).toThrow()
  })

  it('should refuse an empty user id and an unusable extension', () => {
    // Arrange & Act & Assert
    expect(() => buildInquiryPendingPath({ userId: '  ', id: FILE_ID, extension: 'mp4' })).toThrow()
    expect(() => buildInquiryPendingPath({ userId: USER_ID, id: FILE_ID, extension: '' })).toThrow()
    expect(() =>
      buildInquiryPendingPath({ userId: USER_ID, id: FILE_ID, extension: '//' }),
    ).toThrow()
  })
})

describe('isInquiryPendingPath', () => {
  it('should refuse another user prefix', () => {
    // Arrange & Act & Assert — 서버는 서비스 롤로 파일을 옮기므로 RLS 가 막아 주지
    // 않는다. 남의 첨부를 내 문의로 끌어오는 길을 여기서 닫는다.
    expect(isInquiryPendingPath(`${OTHER_ID}/pending/${FILE_ID}.mp4`, USER_ID)).toBe(false)
  })

  it('should refuse an already accepted attachment', () => {
    // Arrange & Act & Assert — `<uid>/<파일명>` 은 접수된 첨부의 자리다.
    expect(isInquiryPendingPath(`${USER_ID}/${FILE_ID}.mp4`, USER_ID)).toBe(false)
  })

  it('should refuse a deeper path that only starts with pending', () => {
    // Arrange & Act & Assert — 깊이를 고정하지 않으면 하위 폴더가 정책 밖으로 샌다.
    expect(isInquiryPendingPath(`${USER_ID}/pending/sub/${FILE_ID}.mp4`, USER_ID)).toBe(false)
  })

  it('should refuse traversal and absolute paths', () => {
    // Arrange & Act & Assert
    expect(isInquiryPendingPath(`${USER_ID}/pending/..`, USER_ID)).toBe(false)
    expect(isInquiryPendingPath(`/${USER_ID}/pending/a.mp4`, USER_ID)).toBe(false)
    expect(isInquiryPendingPath(`${USER_ID}/pending/`, USER_ID)).toBe(false)
  })

  it('should refuse any path when the user id is blank', () => {
    // Arrange & Act & Assert — 빈 uid 로 통과하면 모든 경로가 열린다.
    expect(isInquiryPendingPath('/pending/a.mp4', '')).toBe(false)
  })
})
