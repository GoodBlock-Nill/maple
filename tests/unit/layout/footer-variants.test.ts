import { describe, expect, it } from 'vitest'

import { FOOTER_CONFIG } from '@/components/layout/footer-variants'

/**
 * 짙은 배경(숲·언덕) 변형은 `.glass-panel-dark` 를, 밝은 배경 변형은
 * `.glass-panel-sub`(또는 랭킹 전용 `.glass-panel-ranking`)를 써야 한다.
 * 뒤섞이면 시안 대비(≥4.5:1)가 무너진다 — 마이페이지 v2 대비 버그 회귀 방지.
 */
describe('FOOTER_CONFIG — panelClass', () => {
  it('should use the dark glass panel for vivid-background variants', () => {
    // Arrange & Act & Assert
    expect(FOOTER_CONFIG.home.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.about.panelClass).toBe('glass-panel-dark')
    expect(FOOTER_CONFIG.mypage.panelClass).toBe('glass-panel-dark')
  })

  it('should keep the light glass panel for pale-background variants', () => {
    // Arrange & Act & Assert
    expect(FOOTER_CONFIG.news.panelClass).toBe('glass-panel-sub')
    expect(FOOTER_CONFIG.community.panelClass).toBe('glass-panel-sub')
    expect(FOOTER_CONFIG.guide.panelClass).toBe('glass-panel-sub')
    expect(FOOTER_CONFIG.support.panelClass).toBe('glass-panel-sub')
    expect(FOOTER_CONFIG.ranking.panelClass).toBe('glass-panel-ranking')
  })
})
