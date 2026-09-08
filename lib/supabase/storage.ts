/**
 * 스토리지 버킷과 경로 규칙.
 *
 * `post-images` · `inquiry-attachments` 는 RLS 에서
 * `(storage.foldername(name))[1] = auth.uid()::text` 를 검사한다.
 * 즉 **경로 첫 세그먼트가 업로더 uid** 여야 업로드가 통과한다.
 * 클라이언트도 같은 규칙을 만들어야 하므로 그 로직을 여기 한곳에 둔다.
 */

export const STORAGE_BUCKETS = {
  publicAssets: 'public-assets',
  postImages: 'post-images',
  inquiryAttachments: 'inquiry-attachments',
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

/** 시안의 첨부 안내(최대 3개, 각 200MB)와 마이그레이션의 버킷 제한을 함께 반영한다. */
export const INQUIRY_ATTACHMENT_MAX_COUNT = 3
export const INQUIRY_ATTACHMENT_MAX_BYTES = 200 * 1024 * 1024
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024

const PATH_SEPARATORS = /[\\/]/u
const UNSAFE_CHARS = /[^a-zA-Z0-9_-]+/gu
const EDGE_SEPARATORS = /^[-_]+|[-_]+$/gu

const MAX_BASE_LENGTH = 100
const MAX_EXTENSION_LENGTH = 16
const FALLBACK_BASE = 'file'

function normalizeSegment(value: string): string {
  return value.normalize('NFC').replace(UNSAFE_CHARS, '-').replace(EDGE_SEPARATORS, '')
}

/**
 * 업로드 파일명 정규화.
 *
 * 1) 경로 구분자를 잘라 **마지막 세그먼트만** 남긴다. `../../etc/passwd` 같은 입력이
 *    그대로 키가 되면 상위 경로로 탈출하는 오브젝트 키가 만들어진다.
 * 2) 확장자를 분리해 따로 정규화한다. 확장자를 잃으면 스토리지가 content-type 을
 *    추론하지 못해 이미지가 다운로드로 떨어진다.
 * 3) 나머지는 ASCII 안전 문자만 남긴다(한글·공백은 서명 URL 에서 깨진다).
 */
export function sanitizeFileName(fileName: string): string {
  const segments = fileName.split(PATH_SEPARATORS)
  const basename = segments[segments.length - 1] ?? ''
  const lastDot = basename.lastIndexOf('.')
  const hasExtension = lastDot > 0 && lastDot < basename.length - 1

  const base = normalizeSegment(hasExtension ? basename.slice(0, lastDot) : basename)
  const extension = hasExtension ? normalizeSegment(basename.slice(lastDot + 1)).toLowerCase() : ''

  const safeBase = (base === '' ? FALLBACK_BASE : base).slice(0, MAX_BASE_LENGTH)

  return extension === '' ? safeBase : `${safeBase}.${extension.slice(0, MAX_EXTENSION_LENGTH)}`
}

/** `{uid}/{파일명}` 경로를 만든다. RLS 정책이 요구하는 유일한 형태다. */
export function buildUserScopedPath(userId: string, fileName: string): string {
  if (userId.trim() === '') {
    throw new Error('업로드 경로를 만들려면 사용자 id 가 필요합니다.')
  }

  return `${userId}/${sanitizeFileName(fileName)}`
}

/** 경로 첫 세그먼트가 해당 사용자 uid 인지 검사한다(정책과 동일한 판정). */
export function isUserScopedPath(path: string, userId: string): boolean {
  if (userId.trim() === '' || path.startsWith('/')) {
    return false
  }

  const [first, ...rest] = path.split('/')
  const isTraversal = rest.some((segment) => segment === '' || segment === '.' || segment === '..')

  return first === userId && rest.length > 0 && !isTraversal
}
