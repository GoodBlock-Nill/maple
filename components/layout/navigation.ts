/** 현재 경로가 해당 메뉴에 속하는지 판단한다(하위 경로 포함). */
export function matchesPath(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
