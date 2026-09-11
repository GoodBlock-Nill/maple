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

/**
 * "서비스 준비 중"으로 잠겨 있는 메뉴인지 판단한다(가이드 · 랭킹).
 *
 * 헤더 GNB 와 모바일 드로어는 준비 중 항목도 **보여 준다** — 눌러 들어가면
 * 페이지가 "준비 중" 안내 카드를 그린다(시안 v2 §1 도 회색 글자로 남겨 둔다).
 * 반면 푸터는 시안 v2 §5 에서 준비 중 항목을 아예 빼므로, 이 판정은 지금
 * 푸터 링크(`FooterLegalLinks`)와 헤더가 쓴다.
 */
export function isNavItemComingSoon(href: string): boolean {
  if (href === '/guide') {
    return !FEATURES.guideOpen
  }

  if (href === '/ranking') {
    return !FEATURES.rankingOpen
  }

  return false
}
