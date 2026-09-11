/**
 * 접수번호 표기 — `1024` → `#1024`.
 *
 * 사용자와 운영자가 **같은 문자열**을 부를 수 있어야 한다. 한쪽이 `1024`, 다른
 * 쪽이 `#1024` 로 적으면 검색창에 무엇을 넣어야 하는지부터 갈린다. 그래서 이
 * 함수는 관리자 콘솔(`admin/lib/utils/inquiry-no.ts`)에 **같은 내용으로** 한 벌
 * 더 있다 — 두 앱은 서로의 모듈을 가져다 쓰지 않는다(빌드 경계가 다르다).
 *
 * 값이 없으면 `-` 다. 접수번호는 not null 이지만, 목록 질의가 이 열을 고르지 않은
 * 화면에서 `#undefined` 가 새어 나가는 것보다 낫다.
 */
export function formatInquiryNo(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `#${value}` : '-'
}

/** `No. 1024` 표기 앞에 붙는 말. 숫자만 다르고 문구는 목록·상세가 함께 쓴다. */
const INQUIRY_NO_PREFIX = 'No.'

/**
 * 목록·상세의 접수번호 표기 — `1024` → `No. 1024`.
 *
 * 시안 v2 의 목록 카드·상세 메타가 쓰는 모양이다. `#1024`(`formatInquiryNo`)는
 * 접수 완료 모달·관리자처럼 **번호를 받아 적는** 자리에 그대로 남는다 — 두 표기가
 * 같은 숫자를 가리킨다는 것이 눈에 보여야 해서 접두사만 바꾸고 숫자는 손대지 않는다.
 *
 * 값이 없으면 접두사 없이 `-` 다. "No. -" 는 번호가 있는 것처럼 읽힌다.
 */
export function formatInquiryNoLabel(value: number | null | undefined): string {
  const formatted = formatInquiryNo(value)

  return formatted === '-' ? formatted : `${INQUIRY_NO_PREFIX} ${formatted.slice(1)}`
}
