import { describe, expect, it } from 'vitest'

import { FOOTER_CONFIG, FOOTER_PANEL_DEFAULTS } from '@/components/layout/footer-variants'

/**
 * v2 푸터 패널 통일(오너 지시 2026-09-11) — 모든 변형이 고객지원 v2(166:13652)와
 * 같은 어두운 글래스 패널을 쓴다. 뒤섞이면 시안 대비(≥4.5:1)가 무너진다.
 */
describe('FOOTER_CONFIG — panelClass', () => {
  it('should use the dark glass panel for every variant', () => {
    // Arrange & Act & Assert
    expect(FOOTER_CONFIG.home.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.news.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.community.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.guide.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.ranking.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.about.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.mypage.panelClass).toBe('glass-panel-dark')
    // 고객지원 v2(§7)는 이번 통일의 기준이 된 변형이다.
    expect(FOOTER_CONFIG.support.panelClass).toBe('glass-panel-dark')
  })
})

/**
 * v2 통일로 패널이 1300@x=70 → 1200@x=120 으로 좁아졌다. 개별 값을 지운 변형은
 * `FOOTER_PANEL_DEFAULTS` 를 그대로 물려받아야 한다(고객지원·마이페이지 포함).
 */
describe('FOOTER_CONFIG — panel geometry', () => {
  const variants = [
    'home',
    'news',
    'community',
    'guide',
    'ranking',
    'support',
    'about',
    'mypage',
  ] as const

  it('should share the unified 1200 panel geometry across every variant', () => {
    // Arrange & Act & Assert
    for (const variant of variants) {
      const config = FOOTER_CONFIG[variant]
      expect(config.panelMaxWidth ?? FOOTER_PANEL_DEFAULTS.panelMaxWidth).toBe(1200)
      expect(config.panelPaddingX ?? FOOTER_PANEL_DEFAULTS.panelPaddingX).toBe(140)
      expect(config.panelPaddingTop ?? FOOTER_PANEL_DEFAULTS.panelPaddingTop).toBe(40)
      expect(config.brandWidth ?? FOOTER_PANEL_DEFAULTS.brandWidth).toBe(371)
      expect(config.contactStyle ?? FOOTER_PANEL_DEFAULTS.contactStyle).toBe('text')
    }
  })
})

/**
 * 패널 우측 끝이 1370 → 1320 으로 50px 안쪽으로 들어와, 고객지원·마이페이지를
 * 제외한 모든 변형의 마스코트 `left` 가 -50 이동했다(오너 지시 2026-09-11).
 */
describe('FOOTER_CONFIG — mascot left shift for the v2 panel', () => {
  it('should shift every migrated mascot left by 50px to track the panel right edge', () => {
    // Arrange & Act & Assert
    expect(FOOTER_CONFIG.home.mascot.left).toBe(1082)
    expect(FOOTER_CONFIG.news.mascot.left).toBe(1122)
    expect(FOOTER_CONFIG.community.mascot.left).toBe(1132)
    expect(FOOTER_CONFIG.guide.mascot.left).toBe(1193)
    expect(FOOTER_CONFIG.ranking.mascot.left).toBe(1130)
    expect(FOOTER_CONFIG.about.mascot.left).toBe(1152)
  })

  it('should leave support and mypage mascots untouched (already on the v2 panel)', () => {
    // Arrange & Act & Assert
    expect(FOOTER_CONFIG.support.mascot.left).toBe(1094)
    expect(FOOTER_CONFIG.mypage.mascot.left).toBe(1080)
  })
})
