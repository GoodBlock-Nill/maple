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
const pretendard = read('app/styles/pretendard.css')

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

  it('should register every next/font CSS variable on <html>', () => {
    // Assert — Pretendard 는 next/font 가 아니라 app/styles/pretendard.css 가 소유한다.
    for (const variable of ['--font-switzer', '--font-inter', '--font-noto-kr', '--font-maple']) {
      expect(layout).toContain(`variable: '${variable}'`)
    }
    for (const applied of [
      'switzer.variable',
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

  it('should not preload Maplestory (619KB used only by two lines on /about)', () => {
    // Assert — next/font 는 선언한 파일을 모두 <link rel=preload> 로 박는다.
    expect(flat(layout)).toContain(
      'localFont({ preload: false, src: [ { path: ' + "'./fonts/Maplestory",
    )
  })
})

/**
 * Pretendard 는 next/font/local 단일 파일(2,009KB)에서 공식 동적 서브셋으로
 * 바꿨다. 실기기(LTE)에서 그 2MB 가 모든 페이지의 초기 대역폭을 잡아먹어
 * 하이드레이션이 늦어졌고, 그동안 누른 탭이 아무 반응 없이 버려졌다.
 */
describe('Pretendard 동적 서브셋 (app/styles/pretendard.css)', () => {
  it('should split faces by unicode-range instead of shipping one 2MB file', () => {
    // Arrange
    const faces = pretendard.match(/@font-face/g) ?? []

    // Assert
    expect(faces.length).toBeGreaterThan(50)
    expect(pretendard).toContain('unicode-range:')

    // 어떤 face 도 통짜 파일을 가리키면 안 된다(서브셋 조각만 참조한다).
    const sources = pretendard.match(/src:\s*url\(([^)]+)\)/g) ?? []
    expect(sources.length).toBe(faces.length)
    for (const source of sources) {
      expect(source).toContain('.subset.')
    }
  })

  it('should declare every face as woff2 with swap so text is never invisible', () => {
    // Arrange
    const faces = pretendard.match(/@font-face\s*\{[^}]*\}/g) ?? []

    // Assert
    expect(faces.length).toBeGreaterThan(0)
    for (const face of faces) {
      expect(face).toContain("format('woff2')")
      expect(face).toContain('font-display: swap')
      expect(face).toContain("font-family: 'Pretendard Variable'")
    }
  })

  it('should define --font-pretendard so the tokens.css chain still resolves', () => {
    // Assert — 정의가 없으면 var() 치환이 실패해 font-family 선언 전체가 무효가 된다.
    expect(flat(pretendard)).toContain("--font-pretendard: 'Pretendard Variable'")
    expect(flat(globals)).toContain("@import './styles/pretendard.css'")
  })
})
