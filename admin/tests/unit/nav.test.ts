import { describe, expect, it } from 'vitest'

import { uniformPermissions } from '@/lib/auth/permissions'
import { isNavItemActive, isPathActive, NAV_ITEMS, navBreadcrumb, visibleNavItems } from '@/lib/nav'

describe('NAV_ITEMS', () => {
  it('should cover every menu in PLAN.md §3', () => {
    const hrefs = NAV_ITEMS.map((item) => item.href)

    expect(hrefs).toEqual([
      '/',
      '/news',
      '/community/posts',
      '/reports',
      '/members',
      '/inquiries',
      '/gacha',
      '/rankings',
      '/settings',
      '/legal',
      '/admins',
      '/audit',
    ])
  })

  it('should not point two menus at the same destination', () => {
    // 부모가 첫 하위 항목과 같은 경로를 갖는 것은 의도된 설계다(부모 클릭 = 첫 화면).
    const destinations = NAV_ITEMS.flatMap((item) =>
      item.children === undefined ? [item.href] : item.children.map((child) => child.href),
    )

    expect(new Set(destinations).size).toBe(destinations.length)
  })

  it('should make each parent link land on its first child', () => {
    for (const item of NAV_ITEMS) {
      if (item.children !== undefined) {
        expect(item.href).toBe(item.children[0]?.href)
      }
    }
  })

  it('should tag every menu with a permission module', () => {
    for (const item of NAV_ITEMS) {
      expect(item.module, item.label).toBeDefined()
    }
  })
})

/**
 * 메뉴 필터링은 **편의**이지 인가가 아니다(주소를 직접 쳐도 페이지가 막는다).
 * 그래도 'none' 인 모듈을 흐리게 남겨 두면 운영자가 눌러 보고 대시보드로 튕기는
 * 경험을 반복하므로, 아예 지운다.
 */
describe('visibleNavItems', () => {
  it('should show everything to a full-write role', () => {
    expect(visibleNavItems(uniformPermissions('write'))).toHaveLength(NAV_ITEMS.length)
  })

  it('should show nothing when no module is open', () => {
    expect(visibleNavItems({})).toHaveLength(0)
  })

  it('should drop modules the role cannot read', () => {
    const labels = visibleNavItems({ news: 'read', audit: 'read' }).map((item) => item.label)

    expect(labels).toEqual(['뉴스', '감사 로그'])
  })

  it('should hide the write-only child of a read-only module', () => {
    const news = visibleNavItems({ news: 'read' })[0]

    expect(news?.children?.map((child) => child.label)).toEqual(['목록'])
  })

  it('should keep the write-only child when the role can write', () => {
    const news = visibleNavItems({ news: 'write' })[0]

    expect(news?.children?.map((child) => child.label)).toEqual(['목록', '새 글 작성'])
  })

  /* 고객지원은 1:1 문의(inquiries)와 FAQ(faqs) 두 모듈을 한 메뉴에 담는다. 첫 하위가
     닫혔는데 부모 링크를 그대로 두면 눌렀을 때 볼 수 없는 화면으로 간다. */
  it('should move the parent link onto the first visible child', () => {
    const support = visibleNavItems({ faqs: 'write' })[0]

    expect(support?.label).toBe('고객지원')
    expect(support?.href).toBe('/faqs')
    expect(support?.children?.map((child) => child.label)).toEqual(['FAQ'])
  })

  it('should drop a parent whose children are all closed', () => {
    expect(visibleNavItems({ dashboard: 'read' }).map((item) => item.label)).toEqual(['대시보드'])
  })
})

describe('isPathActive', () => {
  it('should match the exact path', () => {
    expect(isPathActive('/news', '/news')).toBe(true)
  })

  it('should match a descendant path', () => {
    expect(isPathActive('/news', '/news/123')).toBe(true)
  })

  it('should not match a path that merely shares a prefix', () => {
    expect(isPathActive('/news', '/newsletter')).toBe(false)
  })
})

describe('isNavItemActive', () => {
  const dashboard = NAV_ITEMS[0]
  const community = NAV_ITEMS[2]

  it('should treat the dashboard as active only on the exact root path', () => {
    expect(dashboard).toBeDefined()
    expect(isNavItemActive(dashboard!, '/')).toBe(true)
    expect(isNavItemActive(dashboard!, '/news')).toBe(false)
  })

  it('should stay active while a child route is open', () => {
    expect(community).toBeDefined()
    expect(isNavItemActive(community!, '/community/comments')).toBe(true)
  })
})

describe('navBreadcrumb', () => {
  it('should return the parent and child labels for a child route', () => {
    expect(navBreadcrumb('/community/comments')).toEqual(['커뮤니티', '댓글'])
  })

  it('should return a single label for a top level route', () => {
    expect(navBreadcrumb('/members')).toEqual(['회원'])
  })

  it('should return an empty array for an unknown route', () => {
    expect(navBreadcrumb('/nowhere')).toEqual([])
  })
})
