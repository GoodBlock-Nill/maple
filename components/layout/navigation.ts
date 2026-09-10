import { FEATURES } from '@/lib/constants/features'

/** 현재 경로가 해당 메뉴에 속하는지 판단한다(하위 경로 포함). */
export function matchesPath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * 메뉴에서 완전히 감춰야 하는 항목인지 판단한다. 지금은 소개(`/about`)
 * 하나뿐이지만(오너 요청 — "버튼이 안 보이게"), 데스크톱 GNB·모바일 드로어·
 * 푸터 Menu 열이 모두 이 함수 하나로 같은 판정을 쓰도록 묶어 둔다 — 세 곳
 * 중 하나만 바뀌는 사고를 막는다. 자리표시(회색 비활성)가 아니라 목록에서
 * 빼는 것이라 남은 항목 사이 간격이 자연스럽게 좁혀진다.
 */
export function isNavItemHidden(href: string): boolean {
  return href === '/about' && FEATURES.aboutDisabled
}
