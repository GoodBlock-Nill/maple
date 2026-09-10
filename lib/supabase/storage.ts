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
  /** 마이페이지 프로필 이미지(공개 읽기 · 경로 첫 세그먼트 = 업로더 uid). */
  avatars: 'avatars',
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]

/**
 * 1:1 문의 첨부 제한.
 *
 * 버킷(`file_size_limit` 200MiB)이 아니라 **서버 액션의 본문 상한**이 실질적인
 * 천장이다. 첨부는 폼과 함께 `multipart/form-data` 로 서버 액션에 실려 오는데,
 * 본문이 상한을 넘으면 액션이 실행되기도 전에 요청이 500 으로 끊긴다 — 사용자는
 * 필드 오류가 아니라 "A server error occurred" 화면을 보고 입력을 통째로 잃는다.
 * 그래서 코드 쪽 상한을 본문 상한 안쪽으로 잡고, 버킷 값은 그 바깥의 보루로 둔다
 * (버킷은 이메일 수신 첨부도 함께 받으므로 좁히지 않는다).
 */
export const INQUIRY_ATTACHMENT_MAX_COUNT = 3
export const INQUIRY_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES = 12 * 1024 * 1024

/**
 * 영상 첨부.
 *
 * 위의 합계 상한이 적용되지 않는다 — 영상은 서버 액션 본문을 **거치지 않기**
 * 때문이다. 브라우저가 세션 클라이언트로 버킷에 직접 올리고, 폼은 올라간 오브젝트의
 * 경로만 실어 보낸다(`lib/supabase/upload-inquiry-video.ts`). 그래서 천장은 본문
 * 상한이 아니라 버킷의 `file_size_limit`(200MiB)과 "운영자가 실제로 열어 볼 만한
 * 길이"다. 100MB 는 폰으로 찍은 1~2분짜리 화면 녹화가 들어가는 크기다.
 *
 * 개수를 따로 두는 이유는 전체 상한(3개)을 영상만으로 채우면 재현 화면과 영상을
 * 함께 낼 수 없기 때문이다. 2개까지만 받아 최소 한 자리를 이미지 쪽에 남긴다.
 */
export const INQUIRY_VIDEO_MAX_BYTES = 100 * 1024 * 1024
export const INQUIRY_VIDEO_MAX_COUNT = 2

/**
 * `next.config.ts` 의 `experimental.serverActions.bodySizeLimit` 값.
 *
 * 첨부 합계(12MB) + 본문 필드 + multipart 경계 문자열이 들어갈 여유를 둔다.
 * 두 값을 한곳에 적어 두어야 한쪽만 올라가 "검증은 통과하는데 요청이 끊기는"
 * 조합이 생기지 않는다.
 */
export const SERVER_ACTION_BODY_SIZE_LIMIT = '14mb'

const MEGABYTE = 1024 * 1024

/* 안내 문구·오류 메시지가 쓰는 MB 표기. 바이트 값과 같은 곳에 두어야 둘이 갈리지 않는다. */
export const INQUIRY_ATTACHMENT_MAX_MB = Math.floor(INQUIRY_ATTACHMENT_MAX_BYTES / MEGABYTE)
export const INQUIRY_ATTACHMENT_TOTAL_MAX_MB = Math.floor(
  INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES / MEGABYTE,
)
export const INQUIRY_VIDEO_MAX_MB = Math.floor(INQUIRY_VIDEO_MAX_BYTES / MEGABYTE)

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

/* ---------------------------------------------------------------------------
 * post-images — 커뮤니티 본문 이미지
 * ------------------------------------------------------------------------ */

/**
 * 버킷의 `allowed_mime_types` 와 1:1 로 맞춘 목록.
 * 확장자는 서버가 붙인다 — 사용자가 보낸 파일명은 MIME 과 다를 수 있고,
 * 확장자가 틀리면 스토리지가 content-type 을 잘못 추론해 이미지가 다운로드로 떨어진다.
 */
export const POST_IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const

export type PostImageMime = keyof typeof POST_IMAGE_MIME_EXTENSIONS

export function isPostImageMime(value: string): value is PostImageMime {
  return Object.hasOwn(POST_IMAGE_MIME_EXTENSIONS, value)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const YEAR_PATTERN = /^\d{4}$/u

export type PostImagePathInput = {
  userId: string
  mime: PostImageMime
  /** `crypto.randomUUID()` 결과. 원본 파일명은 쓰지 않는다. */
  id: string
  year: number
}

/**
 * `{uid}/{yyyy}/{uuid}.{ext}` 경로.
 *
 * 원본 파일명을 버리는 이유: 파일명 자체가 개인정보가 되는 경우가 있고(사진 앱이
 * 장소·날짜를 파일명에 넣는다), 같은 이름을 두 번 올리면 덮어쓰기가 난다.
 * 연도 폴더는 목록 조회(도배 판정)를 한 폴더 안으로 좁혀 주는 역할도 한다.
 */
export function buildPostImagePath({ userId, mime, id, year }: PostImagePathInput): string {
  if (userId.trim() === '') {
    throw new Error('업로드 경로를 만들려면 사용자 id 가 필요합니다.')
  }

  if (!UUID_PATTERN.test(id)) {
    throw new Error('업로드 경로의 파일명은 uuid 여야 합니다.')
  }

  const folder = String(year)

  if (!YEAR_PATTERN.test(folder)) {
    throw new Error('업로드 경로의 연도가 올바르지 않습니다.')
  }

  return `${userId}/${folder}/${id}.${POST_IMAGE_MIME_EXTENSIONS[mime]}`
}

/** 도배 판정용으로 목록을 훑을 폴더(`{uid}/{yyyy}`). */
export function postImageFolder(userId: string, year: number): string {
  return `${userId}/${year}`
}

/**
 * 공개 버킷의 URL 접두사.
 * 정제기가 "이 접두사로 시작하는 img 만 허용"으로 쓰므로 형식이 곧 보안 경계다.
 */
export function postImagePublicUrlPrefix(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/u, '')}/storage/v1/object/public/${STORAGE_BUCKETS.postImages}/`
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

/* ---------------------------------------------------------------------------
 * inquiry-attachments — 접수 전에 브라우저가 직접 올리는 영상
 * ------------------------------------------------------------------------ */

/**
 * 접수 전 영상이 머무는 폴더 이름.
 *
 * 접수된 첨부(`<uid>/<파일명>`)와 **깊이로** 구분된다. 이 한 세그먼트 차이가
 * 두 가지를 결정한다.
 *   * 야간 배치가 "버려진 파일"로 판정하는 범위
 *     (`public.stale_inquiry_pending_attachments()`)
 *   * 서버가 폼에서 받은 경로를 받아들일지 말지(`isInquiryPendingPath`)
 * 그래서 문자열을 각 파일에 흩뿌리지 않고 여기 한곳에 둔다. 스토리지 정책은
 * `<uid>/` 접두사만 보므로 pending 도 같은 권한으로 올리고 읽고 지운다.
 */
export const INQUIRY_PENDING_FOLDER = 'pending'

/** `<uid>/pending`. 존재 확인(list)이 훑는 폴더다. */
export function inquiryPendingFolder(userId: string): string {
  return `${userId}/${INQUIRY_PENDING_FOLDER}`
}

export type InquiryPendingPathInput = {
  userId: string
  /** `crypto.randomUUID()` 결과. 원본 파일명은 경로에 쓰지 않는다. */
  id: string
  /** 확장자(점 없이). MIME 에서 뽑은 값이라 사용자가 정할 수 없다. */
  extension: string
}

/**
 * `<uid>/pending/<uuid>.<ext>`.
 *
 * 원본 파일명을 버리는 이유는 `buildPostImagePath` 와 같다 — 파일명 자체가
 * 개인정보인 경우가 있고(촬영 앱이 장소·날짜를 넣는다), 같은 이름을 두 번 올리면
 * 덮어쓰기가 난다. 보여 줄 이름은 폼이 따로 실어 보내 DB 메타에 남는다.
 */
export function buildInquiryPendingPath({
  userId,
  id,
  extension,
}: InquiryPendingPathInput): string {
  if (userId.trim() === '') {
    throw new Error('업로드 경로를 만들려면 사용자 id 가 필요합니다.')
  }

  if (!UUID_PATTERN.test(id)) {
    throw new Error('업로드 경로의 파일명은 uuid 여야 합니다.')
  }

  const safeExtension = normalizeSegment(extension).toLowerCase()

  if (safeExtension === '') {
    throw new Error('업로드 경로에는 확장자가 필요합니다.')
  }

  return `${inquiryPendingFolder(userId)}/${id}.${safeExtension}`
}

/**
 * 폼이 실어 보낸 경로가 **이 사용자의** pending 오브젝트인지 검사한다.
 *
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출되므로, 경로는 사용자가 정하는
 * 값이라고 봐야 한다. 남의 uid 로 시작하는 경로를 그대로 옮기면 **남의 첨부를 내
 * 문의로 끌어오는** 길이 열린다(옮기는 주체가 서비스 롤이라 RLS 도 막지 않는다).
 * 그래서 여기서 uid · 폴더 · 깊이를 모두 못 박는다.
 */
export function isInquiryPendingPath(path: string, userId: string): boolean {
  if (!isUserScopedPath(path, userId)) {
    return false
  }

  const segments = path.split('/')

  return segments.length === 3 && segments[1] === INQUIRY_PENDING_FOLDER
}
