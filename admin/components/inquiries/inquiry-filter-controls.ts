/**
 * 목록 필터 폼의 공용 컨트롤 클래스.
 *
 * select 는 공용 프리미티브(`Select`)가 아니라 각 폼이 직접 그린다 — 이 폼은
 * 자바스크립트 없이 동작해야 하는 GET 폼이라 이름(name)이 그대로 쿼리 키가 된다.
 * 그래서 모양만 한곳에서 맞춘다(필터가 파일 두 개로 나뉘어도 높이가 어긋나지 않게).
 */
export const CONTROL_CLASS =
  'rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-10 border px-3 text-[14px] focus:outline-2'
