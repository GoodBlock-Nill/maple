import { describe, expect, it } from 'vitest'

import {
  LOGIN_CHARACTERS,
  LOGIN_STAGE_HEIGHT,
  LOGIN_STAGE_WIDTH,
} from '@/components/auth/login-characters'

/** % 문자열 → 1440×868 무대 위의 px. 시안 좌표와 직접 견주기 위한 역환산이다. */
function toPx(value: string, total: number): number {
  return (Number.parseFloat(value) / 100) * total
}

/** % 문자열은 소수 6자리에서 끊긴다 — 0.001px 오차는 같은 값으로 본다. */
function expectBox(
  actual: { x: number; y: number; width: number; height: number },
  expected: { x: number; y: number; width: number; height: number },
) {
  expect(actual.x).toBeCloseTo(expected.x, 3)
  expect(actual.y).toBeCloseTo(expected.y, 3)
  expect(actual.width).toBeCloseTo(expected.width, 3)
  expect(actual.height).toBeCloseTo(expected.height, 3)
}

/** id 로 고른다 — 배열 인덱스는 `noUncheckedIndexedAccess` 때문에 매번 좁혀야 한다. */
function characterOf(id: string) {
  const character = LOGIN_CHARACTERS.find((item) => item.id === id)
  expect(character, `${id} 캐릭터가 없다`).toBeDefined()

  return character as (typeof LOGIN_CHARACTERS)[number]
}

function boxOf(placement: { left: string; top: string; width: string; height: string }) {
  return {
    x: toPx(placement.left, LOGIN_STAGE_WIDTH),
    y: toPx(placement.top, LOGIN_STAGE_HEIGHT),
    width: toPx(placement.width, LOGIN_STAGE_WIDTH),
    height: toPx(placement.height, LOGIN_STAGE_HEIGHT),
  }
}

describe('로그인 캐릭터 좌표', () => {
  it('should keep the stage at the Figma frame size', () => {
    // Arrange & Act & Assert — 본문 섹션 높이 868 = 푸터가 시작하는 y(프레임 1456 − 588).
    expect(LOGIN_STAGE_WIDTH).toBe(1440)
    expect(LOGIN_STAGE_HEIGHT).toBe(868)
  })

  it('should place the left character exactly where the Figma group sits', () => {
    // Arrange
    const left = characterOf('left')

    // Act
    const character = boxOf(left.placement)
    const bubble = boxOf(left.bubble.placement)

    // Assert — 시안 Group 225: 캐릭터 (325,229) 175×180 · 말풍선 (373,170) 112×64.
    expectBox(character, { x: 325, y: 229, width: 175, height: 180 })
    expectBox(bubble, { x: 373, y: 170, width: 112, height: 64 })
    expect(left.bubble.lines).toEqual(['어서오세요!', '글자월드에요!'])
  })

  it('should place the right character exactly where the Figma group sits', () => {
    // Arrange
    const right = characterOf('right')

    // Act
    const character = boxOf(right.placement)
    const bubble = boxOf(right.bubble.placement)

    // Assert — 시안 Group 226: 캐릭터 (940,475) 205×187 · 말풍선 (1004,409) 127×84.
    expectBox(character, { x: 940, y: 475, width: 205, height: 187 })
    expectBox(bubble, { x: 1004, y: 409, width: 127, height: 84 })
    expect(right.shadows).toHaveLength(2)
  })

  it('should hang each tail off the bottom edge of its bubble', () => {
    for (const character of LOGIN_CHARACTERS) {
      // Arrange & Act
      const bubble = boxOf(character.bubble.placement)
      const tail = boxOf(character.bubble.tail)

      // Assert — 꼬리 10×6 은 말풍선 아래에 맞붙고 좌우로는 말풍선 안에 있다.
      expect(tail.width).toBeCloseTo(10, 3)
      expect(tail.height).toBeCloseTo(6, 3)
      expect(tail.y).toBeCloseTo(bubble.y + bubble.height, 3)
      expect(tail.x).toBeGreaterThan(bubble.x)
      expect(tail.x + tail.width).toBeLessThan(bubble.x + bubble.width)
    }
  })

  it('should never overlap the 424 content column', () => {
    // Arrange — 본문 블록은 (508,300) 폭 424 다.
    const contentLeft = 508
    const contentRight = 508 + 424
    const left = characterOf('left')
    const right = characterOf('right')

    // Act
    const leftEdge = Math.max(
      boxOf(left.placement).x + boxOf(left.placement).width,
      boxOf(left.bubble.placement).x + boxOf(left.bubble.placement).width,
    )
    const rightEdge = Math.min(boxOf(right.placement).x, boxOf(right.bubble.placement).x)

    // Assert
    expect(leftEdge).toBeLessThan(contentLeft + 0.001)
    expect(rightEdge).toBeGreaterThan(contentRight - 0.001)
  })
})
