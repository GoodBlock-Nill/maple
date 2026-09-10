import path from 'node:path'

import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * 본문 에디터 왕복 — 글쓰기 → 서식 · 영상 · 이미지 → 상세 확인 → 삭제.
 *
 * 한 글에 세 가지를 모두 넣고 한 번만 등록한다. 글 등록에는 30초 도배 제한이 걸려
 * 있어서(`WRITE_COOLDOWN_SECONDS`) 시나리오마다 글을 새로 쓰면 두 번째부터 막힌다.
 *
 * chromium 프로젝트에서만 돈다. 두 프로젝트가 나란히 돌면 스텁 로그인이 같은 데모
 * 계정으로 떨어졌을 때 서로의 도배 제한에 걸린다.
 */

/* Playwright 는 스펙을 CJS 로 옮겨 실행하므로 `import.meta` 를 쓸 수 없다.
   실행 디렉터리는 항상 프로젝트 루트다(playwright.config.ts 기준). */
const FIXTURE_PNG = path.resolve(process.cwd(), 'tests/fixtures/pixel.png')

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const BODY_TEXT = '에디터 왕복 확인용 본문입니다'

test.describe.configure({ mode: 'serial' })

/** 스텁 간편로그인 + (최초 1회) 온보딩. 실 OAuth 로 교체되면 이 헬퍼만 바꾸면 된다. */
async function signIn(page: Page, nextPath: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`)
  await page.locator('button[name="provider"][value="google"]').click()

  await page.waitForURL((url) => !url.pathname.startsWith('/login'))

  if (!page.url().includes('/auth/onboarding')) {
    return
  }

  /* 스텁 로그인은 실행할 때마다 새 익명 계정을 만든다. 닉네임 · 메이플스토리 월드
     계정에는 유니크 제약이 걸려 있어서, 고정값을 쓰면 두 번째 실행부터 막힌다. */
  const stamp = Date.now()

  await page.getByRole('textbox', { name: '닉네임' }).fill(`검증${stamp.toString().slice(-8)}`)

  /* 온보딩 항목은 계속 늘어난다. 있으면 채우고 없으면 넘어가도록 해서 항목이
     추가될 때마다 이 테스트가 깨지지 않게 한다. */
  const uid = page.getByRole('textbox', { name: /UID/ })

  if (await uid.isVisible()) {
    await uid.fill(`20${stamp}`)
  }

  const profileCode = page.getByRole('textbox', { name: /프로필 코드/ })

  if (await profileCode.isVisible()) {
    await profileCode.fill(`#${stamp.toString(36)}`)
  }

  for (const checkbox of await page.getByRole('checkbox').all()) {
    await checkbox.check()
  }

  await page.getByRole('button', { name: /시작하기|완료|확인/ }).click()
  await page.waitForURL(nextPath)
}

test('should write, render and delete a rich post', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '도배 제한 때문에 한 프로젝트에서만 돈다.')
  test.setTimeout(120_000)

  // Arrange — 로그인 후 글쓰기 화면
  await signIn(page, '/community/write')

  const title = `에디터 검증 ${Date.now()}`
  const editor = page.getByRole('textbox', { name: '내용' })

  await page.getByRole('textbox', { name: '제목' }).fill(title)

  // Act — 굵은 글씨 한 줄
  await editor.click()
  await page.getByRole('button', { name: '굵게' }).click()
  await editor.pressSequentially(BODY_TEXT)
  await expect(page.getByRole('button', { name: '굵게' })).toHaveAttribute('aria-pressed', 'true')

  // Act — 유튜브 주소를 영상 버튼으로 삽입
  await page.getByRole('button', { name: '영상 첨부' }).click()
  await page.getByRole('textbox', { name: '영상 주소' }).fill(YOUTUBE_URL)
  await page.getByRole('button', { name: '확인' }).click()

  // Assert — 편집 중에도 임베드가 보인다
  await expect(page.locator('iframe[src*="youtube-nocookie.com"]')).toBeVisible()

  // Act — 이미지 첨부(파일 선택창은 숨은 input 이라 setInputFiles 로 직접 준다)
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_PNG)
  await expect(page.locator('.ProseMirror img')).toHaveCount(1, { timeout: 30_000 })

  // Act — 등록
  await page.getByRole('button', { name: '등록' }).click()
  await page.waitForURL(/\/community\/[0-9a-f-]{36}$/u)

  // Assert — 상세에 본문 · 영상 · 이미지가 모두 남는다
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText(BODY_TEXT)).toBeVisible()
  await expect(page.locator('.prose-board strong')).toHaveText(BODY_TEXT)

  const video = page.locator('.prose-board iframe')

  await expect(video).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  await expect(video).toHaveAttribute('loading', 'lazy')
  await expect(video).toHaveAttribute('title', 'YouTube 동영상')

  const image = page.locator('.prose-board img')

  await expect(image).toHaveAttribute('src', /\/storage\/v1\/object\/public\/post-images\//u)

  // Cleanup — 만든 글은 화면의 삭제 버튼(확인 모달 포함)으로 지운다
  await page.getByRole('button', { name: '삭제' }).click()

  const confirm = page.getByRole('dialog')

  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: '삭제' }).click()

  await page.waitForURL(/\/community(\?|$)/u)
  await expect(page.getByRole('link', { name: title })).toHaveCount(0)
})
