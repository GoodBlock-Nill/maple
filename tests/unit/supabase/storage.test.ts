import { describe, expect, it } from 'vitest'

import {
  buildUserScopedPath,
  isUserScopedPath,
  sanitizeFileName,
  STORAGE_BUCKETS,
} from '@/lib/supabase/storage'

const USER_ID = '11111111-2222-4333-8444-555555555555'

describe('STORAGE_BUCKETS', () => {
  it('should match the bucket ids created by the migrations', () => {
    /* 20260908000800_storage_buckets.sql 의 세 개 + 20260910000100_coupons.sql 의 avatars. */
    expect(Object.values(STORAGE_BUCKETS)).toEqual([
      'public-assets',
      'post-images',
      'inquiry-attachments',
      'avatars',
    ])
  })
})

describe('sanitizeFileName', () => {
  it('should keep safe ascii characters as-is', () => {
    expect(sanitizeFileName('screen-shot_01.png')).toBe('screen-shot_01.png')
  })

  it('should replace non-ascii characters but keep the extension', () => {
    expect(sanitizeFileName('스크린 샷.png')).toBe('file.png')
    expect(sanitizeFileName('배경 이미지_01.PNG')).toBe('01.png')
  })

  it('should keep only the last path segment so that traversal is impossible', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('/absolute/path.png')).toBe('path.png')
    expect(sanitizeFileName('a\\b\\c.png')).toBe('c.png')
  })

  it('should collapse repeated dots in the base name', () => {
    expect(sanitizeFileName('a...b.png')).toBe('a-b.png')
  })

  it('should fall back to "file" when nothing safe remains', () => {
    expect(sanitizeFileName('...')).toBe('file')
    expect(sanitizeFileName('')).toBe('file')
    expect(sanitizeFileName('한글.png')).toBe('file.png')
  })

  it('should cap the base name at 100 characters', () => {
    expect(sanitizeFileName(`${'a'.repeat(300)}.png`)).toBe(`${'a'.repeat(100)}.png`)
  })
})

describe('buildUserScopedPath', () => {
  it('should prefix the path with the uploader id', () => {
    expect(buildUserScopedPath(USER_ID, 'shot.png')).toBe(`${USER_ID}/shot.png`)
  })

  it('should sanitize the file name', () => {
    expect(buildUserScopedPath(USER_ID, '../evil.png')).toBe(`${USER_ID}/evil.png`)
  })

  it('should throw when the user id is empty', () => {
    expect(() => buildUserScopedPath('', 'shot.png')).toThrowError()
    expect(() => buildUserScopedPath('   ', 'shot.png')).toThrowError()
  })

  it('should produce a path that passes its own validator', () => {
    expect(isUserScopedPath(buildUserScopedPath(USER_ID, '스샷 1.png'), USER_ID)).toBe(true)
  })
})

describe('isUserScopedPath', () => {
  it('should accept paths whose first segment is the user id', () => {
    expect(isUserScopedPath(`${USER_ID}/shot.png`, USER_ID)).toBe(true)
    expect(isUserScopedPath(`${USER_ID}/2026/shot.png`, USER_ID)).toBe(true)
  })

  it('should reject another users folder', () => {
    expect(isUserScopedPath('99999999-0000-4000-8000-000000000000/shot.png', USER_ID)).toBe(false)
  })

  it('should reject a bare file with no folder', () => {
    expect(isUserScopedPath('shot.png', USER_ID)).toBe(false)
    expect(isUserScopedPath(USER_ID, USER_ID)).toBe(false)
  })

  it('should reject leading slashes and traversal segments', () => {
    expect(isUserScopedPath(`/${USER_ID}/shot.png`, USER_ID)).toBe(false)
    expect(isUserScopedPath(`${USER_ID}/../other/shot.png`, USER_ID)).toBe(false)
    expect(isUserScopedPath(`${USER_ID}//shot.png`, USER_ID)).toBe(false)
    expect(isUserScopedPath(`${USER_ID}/./shot.png`, USER_ID)).toBe(false)
  })

  it('should reject an empty user id', () => {
    expect(isUserScopedPath('/shot.png', '')).toBe(false)
  })
})
