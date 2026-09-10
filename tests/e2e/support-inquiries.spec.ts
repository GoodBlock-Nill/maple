import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

/**
 * 내 문의 내역.
 *
 * 접수(스텁 로그인 → 폼 제출) → 상세의 접수 안내 → 목록 노출 → 운영자 답변 표시까지
 * 한 흐름으로 확인하고, 소유자가 아닌 접근(비로그인 · 다른 계정)이 각각 로그인
 * 유도와 404 로 끝나는지 본다.
 *
 * 답변은 관리자 화면이 아직 없어 서비스 롤 스크립트로 넣는다
 * (`tests/manual/inquiry-reply-insert.mjs`).
 */

const SUPPORT_PATH = '/support'
const LIST_PATH = '/support/inquiries'
const SCREENSHOT_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/verify'

/** 카테고리·프리필 검증 화면. 리포트에 함께 싣는다. */
const CATEGORY_SHOT_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-categories'

const REPLY_CONTENT = '문의 주신 내용 확인했습니다. 순차적으로 처리해 드리겠습니다.'

/** 실행마다 새 계정이 생기므로 유니크 제약에 걸리지 않게 매번 다른 값을 만든다. */
function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
}

/** 폼에 있을 때만 채운다. 온보딩 항목은 늘어날 수 있다. */
async function fillIfPresent(page: Page, name: string, value: string): Promise<void> {
  const field = page.locator(`input[name="${name}"]`)

  if ((await field.count()) > 0) {
    await field.fill(value)
  }
}

/**
 * 스텁 간편로그인 + 온보딩.
 *
 * 익명 로그인이 켜져 있으면 실행할 때마다 새 계정이 생겨 온보딩을 거치고,
 * 데모 계정 폴백이면 이미 온보딩을 마친 상태로 곧장 목적지에 도착한다.
 */
async function stubLogin(page: Page, nextPath: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`)
  await page.locator('button[name="provider"][value="google"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))

  if (page.url().includes('/auth/onboarding')) {
    const suffix = Math.random().toString(36).slice(2, 10)

    await fillIfPresent(page, 'nickname', `e2e${suffix}`)
    await fillIfPresent(page, 'mswUid', `2012${randomDigits(13)}`)
    await fillIfPresent(page, 'mswProfileCode', `#${suffix}`)
    await page.locator('input[name="termsAgreed"]').check()
    await page.locator('input[name="privacyAgreed"]').check()
    await page.locator('input[name="ageConfirmed"]').check()
    await page.getByRole('button', { name: '시작하기' }).click()
  }

  await page.waitForURL(`**${nextPath}`)
}

/** 시드 카테고리(마이그레이션 20260910000400). 고르면 내용에 양식이 채워진다. */
const CATEGORY_LABEL = '접속·서버'

const OTHER_CATEGORY_LABEL = '기타·건의'

async function submitInquiry(page: Page, title: string): Promise<string> {
  await page.locator('input[name="accountId"]').fill(randomDigits(15))
  await page.locator('select[name="category"]').selectOption(CATEGORY_LABEL)
  await page.locator('select[name="type"]').selectOption('문의')
  await page.locator('input[name="title"]').fill(title)
  await page.locator('textarea[name="content"]').fill('E2E 로 접수한 문의입니다.\n두 번째 줄.')
  await page.locator('input[name="consent"]').check()
  await page.getByRole('button', { name: '문의 등록하기' }).click()

  await page.waitForURL(/\/support\/inquiries\/[0-9a-f-]{36}/)

  return page.url().split('/').pop()?.split('?')[0] ?? ''
}

/**
 * 카테고리 프리필(docs/1on1.md).
 *
 * 로그인 없이도 확인할 수 있는 화면 동작이라 스텁 로그인을 거치지 않는다 — 제출만
 * 로그인이 필요하고, 카테고리·양식은 누구에게나 같은 공개 문구다.
 */
test('should prefill the content from the selected category and confirm before replacing', async ({
  page,
}, testInfo) => {
  // Arrange
  const isDesktop = testInfo.project.name === 'chromium'

  if (isDesktop) {
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  await page.goto(SUPPORT_PATH)

  const category = page.locator('select[name="category"]')
  const content = page.locator('textarea[name="content"]')

  // Act — 카테고리를 고르면 그 카테고리의 양식이 내용에 들어간다
  await category.selectOption(CATEGORY_LABEL)

  // Assert — 양식 + 설명(셀렉트 아래 한 줄)
  await expect(content).toHaveValue(/글자월드 캐릭터 닉네임:/)
  await expect(content).toHaveValue(/세부 문의 유형/)
  await expect(page.getByText('로그인·접속 불가')).toBeVisible()
  await page.screenshot({
    path: `${CATEGORY_SHOT_DIR}/client-support-prefilled-${isDesktop ? '1440' : 'pixel7'}.png`,
    fullPage: true,
  })

  // Act — 양식을 건드리지 않은 채 바꾸면 묻지 않고 갈아 끼운다
  await category.selectOption(OTHER_CATEGORY_LABEL)

  // Assert
  await expect(page.getByRole('dialog', { name: '작성 중인 내용이 지워집니다' })).toHaveCount(0)
  await expect(content).toHaveValue(/건의 주제:/)

  // Act — 사용자가 쓴 내용이 있으면 확인을 한 번 세운다
  await content.fill('직접 쓴 문의 내용입니다.')
  await category.selectOption(CATEGORY_LABEL)

  const dialog = page.getByRole('dialog', { name: '작성 중인 내용이 지워집니다' })

  // Assert — 확인 전에는 카테고리도 내용도 그대로다
  await expect(dialog).toBeVisible()
  await page.screenshot({
    path: `${CATEGORY_SHOT_DIR}/client-support-confirm-${isDesktop ? '1440' : 'pixel7'}.png`,
  })
  await expect(category).toHaveValue(OTHER_CATEGORY_LABEL)
  await expect(content).toHaveValue('직접 쓴 문의 내용입니다.')

  // Act — 취소하면 아무 일도 일어나지 않는다
  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(category).toHaveValue(OTHER_CATEGORY_LABEL)

  // Act — 다시 바꾸고 이번에는 확인한다
  await category.selectOption(CATEGORY_LABEL)
  await page.getByRole('button', { name: '카테고리 변경' }).click()

  // Assert
  await expect(category).toHaveValue(CATEGORY_LABEL)
  await expect(content).toHaveValue(/세부 문의 유형/)
})

test('should send anonymous visitors to login when they open 내 문의 내역', async ({ page }) => {
  // Arrange & Act
  await page.goto(LIST_PATH)

  // Assert
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(LIST_PATH)}`)
})

test('should show the support menu entry to anonymous visitors as well', async ({ page }) => {
  // Arrange & Act — 메뉴는 항상 보이고, 눌렀을 때 로그인으로 안내한다.
  await page.goto(SUPPORT_PATH)

  const menuLink = page.getByRole('link', { name: '내 문의 내역' })

  // Assert
  await expect(menuLink).toBeVisible()

  await menuLink.click()
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(LIST_PATH)}`)
})

test('should accept an inquiry, list it, and surface the operator reply', async ({
  browser,
  page,
}, testInfo) => {
  // Arrange
  const isDesktop = testInfo.project.name === 'chromium'

  if (isDesktop) {
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  await stubLogin(page, SUPPORT_PATH)

  const title = `E2E 문의 ${Date.now()}`

  // Act — 접수
  const inquiryId = await submitInquiry(page, title)

  /* 모바일 헤더가 오프스크린 내비게이션을 role="dialog" 로 들고 있어서, 이름 없이
     dialog 를 찾으면 두 개가 잡힌다(strict mode 위반). 이름으로 좁힌다. */
  const dialog = page.getByRole('dialog', { name: '문의가 접수되었습니다' })

  // Assert — 접수 완료 모달이 뜬다
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('운영자가 확인 후 답변을 등록하면')
  await expect(dialog.getByRole('link', { name: '내 문의 내역 보기' })).toBeVisible()

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiry-submitted-modal-1440.png` })
  }

  // Act — 확인으로 닫으면 주소에서 1회성 파라미터가 사라진다
  await dialog.getByRole('button', { name: '확인' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(`${LIST_PATH}/${inquiryId}`)

  // Act — 새로고침해도 다시 뜨지 않는다
  await page.reload()
  await expect(page.getByRole('dialog', { name: '문의가 접수되었습니다' })).toHaveCount(0)

  // Assert — 상세 본문: 제목 · 접수 대기 · 답변 대기 문구
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('접수 대기')).toBeVisible()
  await expect(page.getByText('운영자가 확인 중입니다')).toBeVisible()

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiry-detail-1440.png`, fullPage: true })
  }

  // Act — 목록
  await page.goto(LIST_PATH)

  // Assert — 방금 접수한 문의가 접수 대기 상태로 보인다
  const row = page.getByRole('link', { name: new RegExp(title) })
  await expect(row).toBeVisible()
  await expect(row).toContainText('접수 대기')
  await expect(row).toContainText(`${CATEGORY_LABEL} · 문의`)
  await expect(row).toContainText('답변 0')

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiries-list-1440.png`, fullPage: true })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiries-390.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  // Act — 운영자 답변(서비스 롤 스크립트)
  execFileSync(
    'node',
    ['--env-file=.env.local', 'tests/manual/inquiry-reply-insert.mjs', inquiryId],
    { stdio: 'pipe' },
  )

  await page.goto(`${LIST_PATH}/${inquiryId}`)

  // Assert — 답변 스레드에 운영자 답변이 뜨고 상태가 올라간다
  await expect(page.getByText(REPLY_CONTENT)).toBeVisible()
  await expect(page.getByText('운영자', { exact: true })).toBeVisible()
  await expect(page.getByText('답변 완료')).toBeVisible()

  // Assert — 비로그인은 상세에서 로그인으로 안내된다
  const anonymousContext = await browser.newContext()
  const anonymousPage = await anonymousContext.newPage()
  await anonymousPage.goto(`${LIST_PATH}/${inquiryId}`)
  await expect(anonymousPage).toHaveURL(
    `/login?next=${encodeURIComponent(`${LIST_PATH}/${inquiryId}`)}`,
  )
  await anonymousContext.close()

  // Assert — 다른 계정에게는 존재하지 않는 글이다
  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()
  await stubLogin(otherPage, SUPPORT_PATH)
  await otherPage.goto(`${LIST_PATH}/${inquiryId}`)
  await expect(
    otherPage.getByRole('heading', { name: '요청하신 글을 찾을 수 없습니다' }),
  ).toBeVisible()
  await otherContext.close()
})

/**
 * 소유자의 수정 · 접수 취소.
 *
 * 접수 대기에서는 두 버튼이 모두 보이고, 취소하면 뱃지가 "접수 취소"로 바뀌며
 * 버튼이 사라진다(되돌릴 수 없는 상태라 더 할 동작이 없다).
 */
test('should let the owner edit a pending inquiry and then cancel it', async ({
  page,
}, testInfo) => {
  // Arrange
  const isDesktop = testInfo.project.name === 'chromium'

  if (isDesktop) {
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  await stubLogin(page, SUPPORT_PATH)

  const title = `E2E 수정 문의 ${Date.now()}`
  const inquiryId = await submitInquiry(page, title)

  await page
    .getByRole('dialog', { name: '문의가 접수되었습니다' })
    .getByRole('button', { name: '확인' })
    .click()

  /* 액션 버튼은 상세 카드(article) 안에 있다. 확인 모달은 body 로 포털되므로
     같은 이름의 버튼이 둘 잡히는 것을 이 스코프가 막아 준다. */
  const card = page.locator('article')

  // Assert — 접수 대기: 수정 · 접수 취소가 모두 열려 있다
  await expect(card.getByRole('link', { name: '수정' })).toBeVisible()
  await expect(card.getByRole('button', { name: '접수 취소' })).toBeVisible()

  // Act — 제목을 고쳐 저장한다
  await card.getByRole('link', { name: '수정' }).click()
  await page.waitForURL(`**${LIST_PATH}/${inquiryId}/edit`)

  const editedTitle = `${title} 수정본`
  await expect(page.locator('input[name="title"]')).toHaveValue(title)
  await page.locator('input[name="title"]').fill(editedTitle)
  await page.getByRole('button', { name: '수정 완료' }).click()

  await page.waitForURL(new RegExp(`${LIST_PATH}/${inquiryId}`))

  // Assert — 상세가 고친 제목과 1회성 안내를 보여 준다
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible()
  await expect(page.getByText('문의가 수정되었습니다')).toBeVisible()

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiry-edit-1440.png`, fullPage: true })
  }

  // Act — 접수 취소(확인 모달 경유)
  await card.getByRole('button', { name: '접수 취소' }).click()

  const confirmDialog = page.getByRole('dialog', { name: '문의 접수를 취소할까요?' })
  await expect(confirmDialog).toContainText('취소한 문의는 되돌릴 수 없습니다.')
  await confirmDialog.getByRole('button', { name: '접수 취소' }).click()

  await expect(page.getByText('문의 접수를 취소했습니다.')).toBeVisible()

  // Assert — 뱃지는 접수 취소, 소유자 액션은 사라진다
  await expect(card.getByText('접수 취소')).toBeVisible()
  await expect(card.getByText('종료')).toHaveCount(0)
  await expect(card.getByRole('link', { name: '수정' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: '접수 취소' })).toHaveCount(0)

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiry-cancelled-1440.png`, fullPage: true })
  }

  // Assert — 주소를 직접 쳐도 수정 화면은 열리지 않고 이유가 안내된다
  await page.goto(`${LIST_PATH}/${inquiryId}/edit`)
  await expect(page).toHaveURL(new RegExp(`${LIST_PATH}/${inquiryId}`))
  await expect(page.getByText('접수 대기 상태의 문의만 수정할 수 있습니다.')).toBeVisible()

  // Assert — 목록에서도 접수 취소로 보인다
  await page.goto(LIST_PATH)
  await expect(page.getByRole('link', { name: new RegExp(editedTitle) })).toContainText('접수 취소')
})

/**
 * 첨부 접수.
 *
 * 파일은 폼과 함께 서버 액션 본문으로 간다. 본문 상한(`next.config.ts`)을 넘긴
 * 요청은 액션에 닿기도 전에 500 으로 끊겨 사용자가 입력을 통째로 잃으므로, 상한을
 * 넘는 선택은 **보내기 전에** 막혀야 한다. 상한 안쪽의 사진은 그대로 접수되고
 * 상세에서 다시 보여야 한다 — 두 가지를 한 흐름에서 확인한다.
 */
test('should refuse an oversized attachment before submitting and accept a real image', async ({
  page,
}) => {
  // Arrange
  await stubLogin(page, SUPPORT_PATH)

  const fileInput = page.locator('input[name="attachments"]')
  const submitButton = page.getByRole('button', { name: '문의 등록하기' })

  // Act — 상한을 넘는 파일(6MB)
  await fileInput.setInputFiles({
    name: 'oversize.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(6 * 1024 * 1024),
  })

  // Assert — 무엇이 문제인지 한국어로 알려 주고 제출을 잠근다(첨부가 조용히 빠지지 않게).
  await expect(page.getByText(/oversize\.pdf .*MB/)).toBeVisible()
  await expect(submitButton).toBeDisabled()

  // Act — 첨부를 포기하면 다시 열린다
  await page.getByRole('button', { name: '첨부 지우기' }).click()

  // Assert
  await expect(submitButton).toBeEnabled()
  expect(await fileInput.evaluate((input: HTMLInputElement) => input.files?.length ?? -1)).toBe(0)

  // Act — 상한 안쪽의 이미지는 그대로 접수된다
  const title = `E2E 첨부 문의 ${Date.now()}`
  await fileInput.setInputFiles('tests/fixtures/pixel.png')
  await expect(page.getByText('pixel.png')).toBeVisible()

  const inquiryId = await submitInquiry(page, title)

  await page
    .getByRole('dialog', { name: '문의가 접수되었습니다' })
    .getByRole('button', { name: '확인' })
    .click()

  // Assert — 상세의 첨부 목록에 서명 URL 링크로 뜬다(비공개 버킷이라 링크가 곧 접근 경로다).
  const attachmentLink = page.getByRole('link', { name: /pixel\.png/ })
  await expect(attachmentLink).toBeVisible()
  await expect(attachmentLink).toHaveAttribute('href', /inquiry-attachments/)
  expect(inquiryId).not.toBe('')
})
