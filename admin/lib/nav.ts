/**
 * 사이드바 정보 구조 — docs/admin/PLAN.md §3 의 표를 그대로 옮긴 것.
 *
 * 이 배열이 관리자 사이트 내비게이션의 **단일 출처**다. 2단계에서 각 모듈을
 * 병렬로 붙일 때, 화면을 추가하는 쪽은 라우트 폴더와 여기 한 줄만 건드리면 된다.
 * 사이드바·브레드크럼·활성 상태가 모두 이 배열에서 파생된다.
 */

import { hasPermission } from '@/lib/auth/permissions'

import type { AdminModule, ModulePermissions, PermissionLevel } from '@/lib/auth/permissions'

export type NavIcon =
  | 'dashboard'
  | 'news'
  | 'community'
  | 'report'
  | 'member'
  | 'coupon'
  | 'support'
  | 'guide'
  | 'ranking'
  | 'settings'
  | 'legal'
  | 'admin'
  | 'audit'

export type NavChild = {
  label: string
  href: string
  /** 부모와 다른 모듈일 때만 적는다(예: 고객지원 아래 FAQ). */
  module?: AdminModule
  /** 이 화면을 열기 위해 필요한 등급. 기본 `read`. 작성 화면은 `write`. */
  level?: PermissionLevel
}

export type NavItem = {
  label: string
  href: string
  icon: NavIcon
  /** 권한 판정에 쓰는 모듈. `lib/auth/permissions.ts` 의 `ADMIN_MODULES` 키. */
  module: AdminModule
  /** 하위 메뉴. 활성 판정은 부모 `href` 의 접두사 일치로 한다. */
  children?: readonly NavChild[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: '대시보드', href: '/', icon: 'dashboard', module: 'dashboard' },
  {
    label: '뉴스',
    href: '/news',
    icon: 'news',
    module: 'news',
    children: [
      { label: '목록', href: '/news' },
      { label: '새 글 작성', href: '/news/new', level: 'write' },
    ],
  },
  {
    label: '커뮤니티',
    href: '/community/posts',
    icon: 'community',
    module: 'community',
    children: [
      { label: '게시글', href: '/community/posts' },
      { label: '댓글', href: '/community/comments' },
    ],
  },
  { label: '신고', href: '/reports', icon: 'report', module: 'reports' },
  { label: '회원', href: '/members', icon: 'member', module: 'members' },
  /* 쿠폰은 회원 바로 아래다 — 등록 내역이 회원과 1:1 로 이어지고, 운영자가 두 화면을
     오가며 같은 사람을 확인한다. 하위 메뉴를 두지 않는 이유는 '쿠폰 만들기'가 별도
     라우트가 아니라 목록 위의 다이얼로그이기 때문이다(FAQ 와 같은 형태). */
  { label: '쿠폰', href: '/coupons', icon: 'coupon', module: 'coupons' },
  {
    label: '고객지원',
    href: '/inquiries?source=web',
    icon: 'support',
    module: 'inquiries',
    children: [
      /* 이메일 문의는 새 라우트가 아니라 목록의 출처 필터 프리셋이다(EMAIL-INQUIRY-PLAN §7).
         부모 링크는 첫 하위와 같아야 하므로 부모도 `?source=web` 을 가리킨다. */
      { label: '1:1 문의', href: '/inquiries?source=web' },
      { label: '이메일 문의', href: '/inquiries?source=email' },
      /* 카테고리 관리는 문의 목록과 같은 모듈(`inquiries`)이다. 사용자 폼의 분류와
         프리필 양식을 여기서 고친다 — 문의를 처리하는 사람과 분류를 정하는 사람이
         같기 때문에 별도 모듈로 쪼개지 않는다. */
      { label: '문의 카테고리', href: '/inquiries/categories' },
      { label: 'FAQ', href: '/faqs', module: 'faqs' },
    ],
  },
  {
    label: '가이드',
    href: '/gacha',
    icon: 'guide',
    module: 'gacha',
    children: [
      { label: '목록', href: '/gacha' },
      { label: '새 아이템', href: '/gacha/new', level: 'write' },
    ],
  },
  { label: '랭킹', href: '/rankings', icon: 'ranking', module: 'rankings' },
  { label: '사이트 설정', href: '/settings', icon: 'settings', module: 'settings' },
  { label: 'Legal', href: '/legal', icon: 'legal', module: 'legal' },
  { label: '관리자', href: '/admins', icon: 'admin', module: 'admins' },
  { label: '감사 로그', href: '/audit', icon: 'audit', module: 'audit' },
] as const

/**
 * 현재 위치의 쿼리스트링. `useSearchParams()` 의 반환값을 그대로 받거나
 * `'source=email'` 같은 문자열을 받는다(서버·테스트에서 쓰기 쉽게).
 */
export type NavSearch = URLSearchParams | string | null | undefined

/** `/inquiries?source=email` → `['/inquiries', 'source=email']`. */
function splitHref(href: string): [string, string] {
  const mark = href.indexOf('?')

  return mark === -1 ? [href, ''] : [href.slice(0, mark), href.slice(mark + 1)]
}

function toSearchParams(search: NavSearch): URLSearchParams {
  if (search === null || search === undefined) {
    return new URLSearchParams()
  }

  return typeof search === 'string' ? new URLSearchParams(search) : search
}

/**
 * 활성 메뉴 판정.
 *
 * 대시보드(`/`)만 완전 일치로 본다. 접두사 일치로 두면 모든 경로에서 대시보드가
 * 활성으로 남는다. 커뮤니티처럼 `/community/posts` 를 대표 경로로 쓰는 항목은
 * 한 단계 위(`/community`)까지 활성으로 인정해야 하위 메뉴 이동 시 강조가 유지된다.
 *
 * 부모는 하위의 **경로 부분만** 본다. 그래야 `/inquiries`(출처 필터 없음)나
 * `/inquiries/<id>`(상세)에서도 고객지원이 열린 채로 남는다 — 프리셋 하위 두 개가
 * 모두 꺼져 메뉴가 접히면 운영자가 상세에서 목록으로 돌아갈 길을 잃는다.
 */
export function isNavItemActive(item: NavItem, pathname: string, search?: NavSearch): boolean {
  if (item.href === '/') {
    return pathname === '/'
  }

  if (item.children !== undefined) {
    return item.children.some((child) => isPathActive(splitHref(child.href)[0], pathname))
  }

  return isPathActive(item.href, pathname, search)
}

/**
 * 경로(+ 쿼리 프리셋) 일치.
 *
 * `href` 에 쿼리가 붙어 있으면 **적힌 키가 모두** 현재 값과 같아야 활성이다.
 * 정렬·페이지 같은 다른 파라미터는 보지 않는다 — 2페이지를 보고 있어도 '이메일 문의'는
 * 여전히 그 화면이기 때문이다.
 */
export function isPathActive(href: string, pathname: string, search?: NavSearch): boolean {
  const [path, query] = splitHref(href)

  if (pathname !== path && !pathname.startsWith(`${path}/`)) {
    return false
  }

  if (query === '') {
    return true
  }

  const current = toSearchParams(search)

  return Array.from(new URLSearchParams(query).entries()).every(
    ([key, value]) => current.get(key) === value,
  )
}

/** 경로 → 브레드크럼(상위 메뉴 · 현재 메뉴). 매칭되지 않으면 빈 배열. */
export function navBreadcrumb(pathname: string, search?: NavSearch): readonly string[] {
  for (const item of NAV_ITEMS) {
    const child = item.children?.find((candidate) => isPathActive(candidate.href, pathname, search))

    if (child !== undefined) {
      return [item.label, child.label]
    }

    if (isNavItemActive(item, pathname, search)) {
      return [item.label]
    }
  }

  return []
}

/** 하위 항목이 부모와 다른 모듈을 가리킬 수 있다(고객지원 → FAQ). */
export function navChildModule(item: NavItem, child: NavChild): AdminModule {
  return child.module ?? item.module
}

/**
 * 이 관리자에게 보여 줄 메뉴만 남긴다.
 *
 * 'none' 인 모듈은 **메뉴에서 지운다.** 흐리게 남겨 두면 운영자가 눌러 보고
 * 대시보드로 튕기는 경험을 반복한다. 하위 항목이 전부 닫힌 부모도 함께 사라지고,
 * 첫 하위가 닫혔다면 부모 링크는 남아 있는 첫 하위로 옮겨 간다 — 그러지 않으면
 * 부모를 눌렀을 때 볼 수 없는 화면으로 간다.
 */
export function visibleNavItems(permissions: ModulePermissions): readonly NavItem[] {
  const visible: NavItem[] = []

  for (const item of NAV_ITEMS) {
    if (item.children === undefined) {
      if (hasPermission(permissions, item.module, 'read')) {
        visible.push(item)
      }

      continue
    }

    const children = item.children.filter((child) =>
      hasPermission(permissions, navChildModule(item, child), childLevel(child)),
    )
    const first = children[0]

    if (first === undefined) {
      continue
    }

    visible.push({ ...item, href: first.href, children })
  }

  return visible
}

function childLevel(child: NavChild): PermissionLevel {
  return child.level ?? 'read'
}
