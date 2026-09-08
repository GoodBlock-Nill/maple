const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * KILOBYTE

/**
 * 사람이 읽는 파일 크기. 소수점은 MB 에서만 의미가 있어 KB 는 정수로 끊는다.
 *
 * 첨부 목록(상세)과 첨부 편집(수정 폼)이 같은 표기를 써야 해서 컴포넌트 밖으로 뺐다.
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return ''
  }

  if (bytes < MEGABYTE) {
    return `${Math.max(1, Math.round(bytes / KILOBYTE))}KB`
  }

  return `${(bytes / MEGABYTE).toFixed(1)}MB`
}
