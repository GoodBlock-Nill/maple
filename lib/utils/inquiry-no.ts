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
