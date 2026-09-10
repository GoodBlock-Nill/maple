import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * 회원가입(온보딩) 화면 — 시안 auth-v2 27:5172(PC) · 27:5256(모바일).
 *
 * 좌표 기준값은 `docs/reference/figma/auth-v2-spec.md` 실측값이다. Figma 의 스트로크는
 * 프레임 폭을 먹지 않지만 CSS `border` 는 border-box 안쪽을 1px 먹는다 — 카드 안쪽
 * 좌표(452 · 536)가 그 보정까지 맞는지 함께 본다.
 *
 * 스텁 간편로그인은 호출할 때마다 **새 계정**을 만든다(`stub-social.ts`). 온보딩은
 * 계정당 한 번뿐이라 저장된 세션을 재사용할 수 없어, 로그인이 필요한 테스트를 둘로만
 * 묶었다 — Supabase 가입 빈도 제한에 걸리지 않게 하려는 것이다.
 */

/* 스텁 로그인은 부를 때마다 계정을 새로 만든다. 여러 개를 동시에 만들면 Supabase
   가입 빈도 제한에 걸려 무작위로 실패한다 — 이 파일은 순차로 돈다. */
test.describe.configure({ mode: 'serial' })

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/** 시안과 ±2px 안에서 같으면 통과로 본다(서브픽셀 반올림 여유). */
const TOLERANCE = 2

/** 1440 기준 실측값. */
const PC = {
  card: { x: 420, y: 200, width: 600, height: 656 },
  titleY: 232,
  subtitleY: 282,
  labelY: 336,
  input: { x: 452, y: 364, width: 536, height: 54 },
  hintY: 424,
  agreeAllY: 473.4,
  consentY: [573.4, 617.4, 661.4],
  ageY: 716.4,
  submit: { x: 452, y: 770.4, width: 536, height: 54 },
  footerY: 962,
  pageHeight: 1550,
}

/** 390 기준(시안 375 + 좌우 여백 16 → 폭 343). */
const MOBILE = {
  card: { x: 23.5, y: 132, width: 343, height: 546 },
  titleY: 160,
  input: { y: 268, height: 42 },
  submit: { y: 606, width: 279, height: 48 },
}

type Box = { x: number; y: number; width: number; height: number }

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox()
  expect(box, `${selector} 를 찾지 못했다`).not.toBeNull()

  return box as Box
}

function expectNear(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: ${actual} ≠ ${expected}`).toBeLessThanOrEqual(
    TOLERANCE,
  )
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )

  expect(overflow).toBeLessThanOrEqual(0)
}

/** 새 계정으로 스텁 로그인한다. 온보딩을 마치지 않은 계정이라 곧바로 이 화면에 선다. */
async function stubLoginToOnboarding(page: Page, nextPath: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`)
  await page.locator('button[name="provider"][value="google"]').click()
  await page.waitForURL(/\/auth\/onboarding/u, { timeout: 60_000 })
}

const checkbox = (name: string) => `main input[name="${name}"]`
const SUBMIT = 'main button[type="submit"]'
const NICKNAME = 'main input[name="nickname"]'

test.describe('회원가입 (1440)', () => {
  test('should lay the card, the consents and the footer on the Figma grid', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)

    // Act
    await stubLoginToOnboarding(page, '/community')
    await page.locator(NICKNAME).fill('')

    // Assert
    await expect(page.getByRole('heading', { name: '회원가입', level: 1 })).toBeVisible()

    const card = await boxOf(page, 'main section')
    expectNear(card.x, PC.card.x, '카드 x')
    expectNear(card.y, PC.card.y, '카드 y')
    expectNear(card.width, PC.card.width, '카드 폭')
    expectNear(card.height, PC.card.height, '카드 높이')

    expectNear((await boxOf(page, 'main h1')).y, PC.titleY, '제목 y')
    expectNear((await boxOf(page, 'main h1 + p')).y, PC.subtitleY, '부제 y')
    expectNear((await boxOf(page, 'main label[for^="nickname"]')).y, PC.labelY, '라벨 y')

    const input = await boxOf(page, NICKNAME)
    expectNear(input.x, PC.input.x, '입력 x')
    expectNear(input.y, PC.input.y, '입력 y')
    expectNear(input.width, PC.input.width, '입력 폭')
    expectNear(input.height, PC.input.height, '입력 높이')

    expectNear((await boxOf(page, 'main p[id$="-hint"]')).y, PC.hintY, '도움말 y')
    expectNear((await boxOf(page, checkbox('agreeAll'))).y, PC.agreeAllY, '전체 동의 y')

    const consents = ['termsAgreed', 'privacyAgreed', 'marketingAgreed']
    for (const [index, name] of consents.entries()) {
      const box = await boxOf(page, checkbox(name))
      expectNear(box.y, PC.consentY[index] as number, `${name} y`)
      expectNear(box.width, 22, `${name} 크기`)
    }

    expectNear((await boxOf(page, checkbox('ageConfirmed'))).y, PC.ageY, '만 14세 y')

    const submit = await boxOf(page, SUBMIT)
    expectNear(submit.x, PC.submit.x, '버튼 x')
    expectNear(submit.y, PC.submit.y, '버튼 y')
    expectNear(submit.width, PC.submit.width, '버튼 폭')
    expectNear(submit.height, PC.submit.height, '버튼 높이')

    expectNear((await boxOf(page, 'footer')).y, PC.footerY, '푸터 상단 y')
    expectNear(
      await page.evaluate(() => document.documentElement.scrollHeight),
      PC.pageHeight,
      '페이지 높이',
    )

    await expectNoHorizontalOverflow(page)
  })

  test('should unlock the button only when the rules are met and then finish onboarding', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await stubLoginToOnboarding(page, '/community')

    // Assert — 닉네임은 제공자 값이 채워져 있지만 약관 동의가 없다.
    await expect(page.locator(SUBMIT)).toBeDisabled()

    // Act — 닉네임을 비우면 전체 동의를 해도 잠긴 채다.
    await page.locator(NICKNAME).fill('')
    await page.locator(checkbox('agreeAll')).check()
    await expect(page.locator(SUBMIT)).toBeDisabled()

    // Act — 규칙에 어긋나는 값.
    await page.locator(NICKNAME).fill('^^')
    await expect(page.locator('main [role="alert"]')).toHaveText(
      '한글·영문·숫자·밑줄만 사용할 수 있어요.',
    )
    await expect(page.locator(SUBMIT)).toBeDisabled()

    // Act — 올바른 값.
    await page.locator(NICKNAME).fill(`e2e${Date.now().toString(36).slice(-6)}`)
    await expect(page.locator(SUBMIT)).toBeEnabled()

    // Act
    await page.locator(SUBMIT).click()

    // Assert — 서버가 `next` 로 돌려보낸다.
    await page.waitForURL('**/community')
    expect(new URL(page.url()).pathname).toBe('/community')
  })
})

test.describe('회원가입 (390)', () => {
  test.use({ viewport: PHONE })

  test('should fit the card between the header and the footer', async ({ page }) => {
    // Arrange & Act
    await stubLoginToOnboarding(page, '/')

    // Assert
    const card = await boxOf(page, 'main section')
    expectNear(card.x, MOBILE.card.x, '카드 x')
    expectNear(card.y, MOBILE.card.y, '카드 y')
    expectNear(card.width, MOBILE.card.width, '카드 폭')
    expectNear(card.height, MOBILE.card.height, '카드 높이')

    expectNear((await boxOf(page, 'main h1')).y, MOBILE.titleY, '제목 y')

    const input = await boxOf(page, NICKNAME)
    expectNear(input.y, MOBILE.input.y, '입력 y')
    expectNear(input.height, MOBILE.input.height, '입력 높이')

    const submit = await boxOf(page, SUBMIT)
    expectNear(submit.y, MOBILE.submit.y, '버튼 y')
    expectNear(submit.width, MOBILE.submit.width, '버튼 폭')
    expectNear(submit.height, MOBILE.submit.height, '버튼 높이')

    // 체크박스는 폰에서 18 이다.
    expectNear((await boxOf(page, checkbox('termsAgreed'))).width, 18, '체크박스 크기')

    await expectNoHorizontalOverflow(page)
  })
})

test.describe('마케팅 수신 안내', () => {
  test('should publish the notice at /policy/marketing', async ({ page }) => {
    // Arrange & Act
    const response = await page.goto('/policy/marketing')

    // Assert
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: '마케팅 정보 수신 동의', level: 1 }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: '5. 야간 전송 제한' })).toBeVisible()
    await expect(page.getByText('제62조의3', { exact: false })).toBeVisible()
  })

  test('should open the notice from the onboarding arrow', async ({ page }) => {
    // Arrange
    await page.setViewportSize(DESKTOP)
    await stubLoginToOnboarding(page, '/')

    // Act
    await page.getByRole('button', { name: '마케팅 수신 안내 보기' }).click()

    // Assert — 같은 화면의 모달이라 입력값을 잃지 않는다.
    const dialog = page.locator('[role="dialog"][aria-modal]')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: '5. 야간 전송 제한' })).toBeVisible()

    // Act
    await dialog.getByRole('button', { name: '동의하고 닫기' }).click()

    // Assert
    await expect(page.locator(checkbox('marketingAgreed'))).toBeChecked()
    await expect(dialog).toBeHidden()
  })
})
