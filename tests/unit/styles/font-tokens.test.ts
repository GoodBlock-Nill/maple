import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 서체 회귀 방지.
 *
 * 시안(Figma)은 한 서체로 통일돼 있지 않다 — Switzer(대부분) · Inter(헤더 GNB·
 * 인증 버튼·더보기·확률형 아이템 카드·고객지원 제목) · Noto Sans KR(`/소개`
 * 소개 문단) · Maplestory(`/소개` 이름·한 줄 소개말 두 곳). 예전에 "전 화면
 * Maplestory 통일"로 잘못 구현했다가 오너 지적을 받았으므로, 체인이 다시
 * 뒤집히지 않게 토큰 파일과 로더를 고정한다.
 */
const ROOT = join(__dirname, '../../..')
const read = (relativePath: string) => readFileSync(join(ROOT, relativePath), 'utf8')

const tokens = read('app/styles/tokens.css')
const layout = read('app/layout.tsx')
const globals = read('app/globals.css')

/** 공백/줄바꿈을 한 칸으로 눌러 여러 줄에 걸친 폰트 체인을 한 줄로 비교한다. */
const flat = (source: string) => source.replace(/\s+/g, ' ')

/** 주석 안의 예시 코드가 규칙 검사에 걸리지 않도록 먼저 지운다. */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '')

describe('font tokens', () => {
  it('should put Switzer first and Pretendard second in the body chain', () => {
    // Arrange
    const css = flat(tokens)

    // Assert — 라틴은 Switzer, 한글은 Pretendard 가 받는다.
    expect(css).toContain('--font-body: var(--font-switzer), var(--font-pretendard),')
    expect(css).toContain('--font-display: var(--font-body)')
    expect(css).toContain('--font-sans: var(--font-body)')
  })

  it('should not fall back to Maplestory for body text', () => {
    // Assert
    expect(flat(tokens)).not.toContain('--font-body: var(--font-maple)')
  })

  it('should expose Inter as --font-ui and Noto Sans KR as --font-intro', () => {
    // Arrange
    const css = flat(tokens)

    // Assert
    expect(css).toContain('--font-ui: var(--font-inter), var(--font-pretendard),')
    expect(css).toContain('--font-intro: var(--font-noto-kr), var(--font-pretendard),')
  })

  it('should declare font-maple as a @utility, not a @theme token', () => {
    // Arrange
    const css = flat(tokens)

    // Assert — `@theme` 에 넣으면 next/font 가 <html> 에 심는 변수와 순환 참조가 된다.
    expect(css).toContain('@utility font-maple { font-family: var(--font-maple),')
    expect(flat(stripComments(tokens))).not.toMatch(/@theme[^}]*--font-maple:/)
  })

  it('should keep font synthesis off so missing weights are never faked', () => {
    // Assert
    expect(flat(globals)).toContain('font-synthesis: none')
  })
})

describe('font loading (app/layout.tsx)', () => {
  it('should load all four Switzer weights so Latin matches the Hangul fallback', () => {
    // Assert
    for (const [file, weight] of [
      ['Switzer-Regular.otf', '400'],
      ['Switzer-Medium.otf', '500'],
      ['Switzer-Semibold.otf', '600'],
      ['Switzer-Bold.otf', '700'],
    ]) {
      expect(layout).toContain(file)
      expect(layout).toContain(`weight: '${weight}'`)
    }
  })

  it('should register every font CSS variable on <html>', () => {
    // Assert
    for (const variable of [
      '--font-switzer',
      '--font-pretendard',
      '--font-inter',
      '--font-noto-kr',
      '--font-maple',
    ]) {
      expect(layout).toContain(`variable: '${variable}'`)
    }
    for (const applied of [
      'switzer.variable',
      'pretendard.variable',
      'inter.variable',
      'notoSansKr.variable',
      'maplestory.variable',
    ]) {
      expect(layout).toContain(applied)
    }
  })

  it('should not preload Noto Sans KR (124 unicode-range chunks would spam <head>)', () => {
    // Assert
    expect(flat(layout)).toContain('Noto_Sans_KR({ preload: false')
  })
})
