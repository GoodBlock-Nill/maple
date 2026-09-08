import { describe, expect, it } from 'vitest'

import { isNavItemActive, isPathActive, NAV_ITEMS, navBreadcrumb } from '@/lib/nav'

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
