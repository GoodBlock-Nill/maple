import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

import { expect, test } from '@playwright/test'

import { createServiceClient } from './service-role'
import { makeTestVideo } from './video-fixture'

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

/** 세부 문의 유형·필수 항목 검증 화면. 리포트에 함께 싣는다. */
const SUBTYPE_SHOT_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-subtypes'

/** 카테고리·프리필 검증 화면. 리포트에 함께 싣는다. */
const CATEGORY_SHOT_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-categories'

/** 동의 체크박스 회귀 화면. 리포트에 함께 싣는다. */
const CONSENT_SHOT_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-consent/e2e'

const REPLY_CONTENT = '문의 주신 내용 확인했습니다. 순차적으로 처리해 드리겠습니다.'

/** 처리 중 상태에서 운영자가 추가 정보를 묻는 답변. 회원 답장의 전제다. */
const OPERATOR_QUESTION = '확인을 위해 계정 ID 와 발생 시각을 알려 주세요.'

const USER_REPLY_CONTENT = '계정 ID 는 20123456789000000 이고, 어제 21시에 발생했습니다.'

const USER_REPLY_SUBMIT_LABEL = '답장 보내기'

const THREAD_CLOSED_NOTICE = '답변이 완료된 문의입니다. 추가 문의는 새 문의로 접수해 주세요.'

/** 답장 창이 닫혔을 때의 안내. 오너 결정(2026-09-15)으로 운영자 답변 하나에 답장 하나다. */
const REPLY_TOO_MANY_NOTICE =
  '운영자 답변을 기다려 주세요. 운영자 답변 하나에 답장은 1건만 보낼 수 있습니다.'

/** 영상 픽스처를 만들 자리. 저장소에 바이너리를 넣지 않는다. */
const VIDEO_FIXTURE_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-video'

/**
 * 크기만 큰 희소 파일.
 *
 * 상한을 넘는 선택이 **올라가기 전에** 거절되는지 보려면 200MB 짜리 파일이 필요하다.
 * 내용은 아무 상관이 없고(거절돼서 전송 자체가 없다) 희소 파일은 디스크를 실제로
 * 차지하지 않는다 — 저장소에 200MB 바이너리를 넣을 이유는 더더욱 없다.
 */
function makeSparseFile(target: string, megabytes: number): string | null {
  try {
    mkdirSync(dirname(target), { recursive: true })
    rmSync(target, { force: true })
    execFileSync('dd', ['if=/dev/zero', `of=${target}`, 'bs=1m', 'count=0', `seek=${megabytes}`], {
      stdio: 'pipe',
    })

    return existsSync(target) ? target : null
  } catch {
    return null
  }
}

/** 접수된 문의와 그 첨부를 지운다. 남겨 두면 실행할 때마다 비공개 버킷에 쌓인다. */
async function cleanUpInquiry(inquiryId: string): Promise<void> {
  const service = createServiceClient()

  if (service === null || inquiryId === '') {
    return
  }

  const stored = await service.from('inquiries').select('attachments').eq('id', inquiryId).single()
  const attachments = (stored.data?.attachments ?? []) as { path: string }[]

  if (attachments.length > 0) {
    await service.storage.from('inquiry-attachments').remove(attachments.map((item) => item.path))
  }

  await service.from('inquiries').delete().eq('id', inquiryId)
}

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

/**
 * 1:1 문의 창구(`/support`)의 시드 카테고리.
 *
 * 접속·서버 등 네 종은 2026-09-14 부터 **버그제보** 창구로 옮겨졌다(마이그레이션
 * 20260914000100) — 이 화면의 셀렉트에는 더 이상 없다. 그래서 1:1 에 남은 분류로
 * 고른다. 고르면 내용에 그 카테고리의 양식이 채워진다.
 */
const CATEGORY_LABEL = '재화·아이템'

/** 셀렉트 아래 한 줄 안내(그 카테고리의 설명). 프리필과 함께 바뀐다. */
const CATEGORY_DESCRIPTION = '아이템 미지급·소실, 재화 증감 오류, 비정상 획득, 거래 오류.'

/** 세부 유형이 없는 시드 카테고리 — 폼이 유형 셀렉트를 잠그고 '기타' 로 접수한다. */
const OTHER_CATEGORY_LABEL = '기타·건의'

/** 그 카테고리의 세부 문의 유형(마이그레이션 20260910000700 시드). */
const SUBTYPES = ['아이템 미지급/소실', '재화 증가/감소 오류', '거래 오류'] as const

const [SUBTYPE_LABEL, OTHER_SUBTYPE_LABEL] = SUBTYPES

/* 버그제보 · 불법이용제보 창구. 라우트만 다르고 폼·규칙은 1:1 문의와 같다. */
const BUG_PATH = '/support/bug'
const REPORT_PATH = '/support/report'

const BUG_CATEGORY_LABEL = '접속·서버'
const BUG_SUBTYPE_LABEL = '로그인/접속 불가'

const REPORT_CATEGORY_LABEL = '불법 프로그램'
const REPORT_SUBTYPE_LABEL = '핵/치트 프로그램'

/** 목록·상세가 그리는 종류 라벨(`lib/constants/inquiry-kind.ts`). */
const BUG_KIND_LABEL = '버그제보'
const REPORT_KIND_LABEL = '불법이용제보'

/** 제출 버튼 문구도 창구를 따라간다 — 제보는 "문의하기"가 아니다. */
const SUBMIT_LABEL = '문의하기'
const REPORT_SUBMIT_LABEL = '제보하기'

/**
 * 필수 항목을 모두 채운다(2026-09-11 제품 결정 — 첨부만 선택).
 *
 * 하나라도 비면 제출 버튼이 잠기므로, 첨부·영상 시나리오도 이 함수를 먼저 부른 뒤에야
 * "첨부 때문에 잠겼는가"를 물어볼 수 있다.
 */
async function fillRequiredFields(
  page: Page,
  title: string,
  category: string = CATEGORY_LABEL,
  subtype: string = SUBTYPE_LABEL,
): Promise<void> {
  await page.locator('input[name="accountId"]').fill(randomDigits(17))
  await page.locator('select[name="category"]').selectOption(category)
  await page.locator('select[name="type"]').selectOption(subtype)
  await page.locator('input[name="title"]').fill(title)
  await page.locator('textarea[name="content"]').fill('E2E 로 접수한 문의입니다.\n두 번째 줄.')
  await page.locator('input[name="consent"]').check()
}

/** 접수 버튼. 창구마다 문구가 다르다(1:1 문의 "문의하기" · 제보 "제보하기"). */
function submitControl(page: Page, label: string = SUBMIT_LABEL) {
  return page.getByRole('button', { name: label })
}

async function submitInquiry(page: Page, title: string): Promise<string> {
  await fillRequiredFields(page, title)
  await submitControl(page).click()

  await page.waitForURL(/\/support\/inquiries\/[0-9a-f-]{36}/)

  return page.url().split('/').pop()?.split('?')[0] ?? ''
}

/** 서비스 롤 클라이언트(널이 아님이 확인된 자리에서만 쓴다). */
type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>

/**
 * "운영자가 처리 중 상태로 답했다"를 만든다.
 *
 * 접수 시각도 함께 뒤로 민다. 답장에는 쿨다운이 없지만(오너 결정 2026-09-15 — 1건
 * 규칙이 대신 막는다) 실제 운영에서 운영자 답변은 몇 시간 뒤에 온다 — 접수 1초 뒤에
 * 답변이 달리는 상황은 테스트에서만 만들어지는 것이라 그 시간차까지 함께 흉내 낸다.
 */
async function seedOperatorQuestion(
  service: ServiceClient | null,
  inquiryId: string,
): Promise<void> {
  await service?.from('inquiry_replies').insert({
    inquiry_id: inquiryId,
    author_name: '운영자',
    content: OPERATOR_QUESTION,
    direction: 'outbound',
  })

  await service
    ?.from('inquiries')
    .update({
      status: 'in_progress',
      created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    })
    .eq('id', inquiryId)
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
  const type = page.locator('select[name="type"]')
  const content = page.locator('textarea[name="content"]')

  // Assert — 카테고리 이전에는 고를 것이 없다(셀렉트가 잠겨 있다)
  await expect(type).toBeDisabled()

  // Act — 카테고리를 고르면 그 카테고리의 양식이 내용에 들어간다
  await category.selectOption(CATEGORY_LABEL)

  // Assert — 양식 + 설명(셀렉트 아래 한 줄)
  await expect(content).toHaveValue(/글자월드 캐릭터 닉네임:/)
  /* 세부 유형 목록은 이제 셀렉트가 갖는다 — 양식에 다시 적지 않는다(같은 것을
     두 번 고르게 되고, 둘이 어긋난 문의가 들어온다). */
  await expect(content).not.toHaveValue(/세부 문의 유형/)
  await expect(page.getByText(CATEGORY_DESCRIPTION)).toBeVisible()

  // Assert — 유형 셀렉트가 그 카테고리의 세부 유형으로 채워진다
  await expect(type).toBeEnabled()
  expect(await type.locator('option').allTextContents()).toEqual([
    '세부 문의 유형을 선택해주세요',
    ...SUBTYPES,
  ])
  await page.screenshot({
    path: `${CATEGORY_SHOT_DIR}/client-support-prefilled-${isDesktop ? '1440' : 'pixel7'}.png`,
    fullPage: true,
  })

  // Act — 고른 유형은 카테고리를 바꾸면 비워진다
  await type.selectOption(OTHER_SUBTYPE_LABEL)
  await expect(type).toHaveValue(OTHER_SUBTYPE_LABEL)

  // Act — 양식을 건드리지 않은 채 바꾸면 묻지 않고 갈아 끼운다
  await category.selectOption(OTHER_CATEGORY_LABEL)

  // Assert
  await expect(page.getByRole('dialog', { name: '작성 중인 내용이 지워집니다' })).toHaveCount(0)
  await expect(content).toHaveValue(/건의 주제:/)

  /* 세부 유형이 없는 카테고리 — 셀렉트는 잠기고 저장될 값('기타')만 보여 준다.
     값은 hidden 이 싣는다(잠긴 셀렉트는 전송되지 않는다). */
  await expect(type).toBeDisabled()
  expect(await type.locator('option').allTextContents()).toEqual(['기타'])
  await expect(page.locator('input[type="hidden"][name="type"]')).toHaveValue('기타')
  await page.screenshot({
    path: `${SUBTYPE_SHOT_DIR}/client-support-no-subtype-${isDesktop ? '1440' : 'pixel7'}.png`,
    fullPage: true,
  })

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
  await expect(content).toHaveValue(/글자월드 캐릭터 닉네임:/)
  await expect(type).toHaveValue('')
  await page.screenshot({
    path: `${SUBTYPE_SHOT_DIR}/client-support-subtypes-${isDesktop ? '1440' : 'pixel7'}.png`,
    fullPage: true,
  })
})

/**
 * 필수 항목(2026-09-11 제품 결정).
 *
 * 카테고리 · 세부 유형 · 계정 ID · 제목 · 내용 · 동의가 모두 채워질 때까지 제출이
 * 잠긴다. 첨부는 선택이라 없어도 열린다.
 */
test('should keep the submit locked until every required field is filled', async ({
  page,
}, testInfo) => {
  // Arrange
  const isDesktop = testInfo.project.name === 'chromium'

  if (isDesktop) {
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  await stubLogin(page, SUPPORT_PATH)

  const submitButton = page.getByRole('button', { name: SUBMIT_LABEL })

  // Assert — 빈 폼에서는 잠겨 있고 이유가 버튼 아래에 적혀 있다
  await expect(submitButton).toBeDisabled()
  await expect(page.getByText('필수 항목(*)을 모두 입력해 주세요.')).toBeVisible()
  await page.screenshot({
    path: `${SUBTYPE_SHOT_DIR}/client-support-required-${isDesktop ? '1440' : 'pixel7'}.png`,
    fullPage: true,
  })

  // Act — 동의만 빼고 모두 채운다
  await page.locator('input[name="accountId"]').fill(randomDigits(17))
  await page.locator('select[name="category"]').selectOption(CATEGORY_LABEL)
  await page.locator('select[name="type"]').selectOption(SUBTYPE_LABEL)
  await page.locator('input[name="title"]').fill('필수 항목 확인')
  await page.locator('textarea[name="content"]').fill('필수 항목이 모두 채워졌는지 봅니다.')

  // Assert — 약관 동의도 필수다
  await expect(submitButton).toBeDisabled()

  // Act
  await page.locator('input[name="consent"]').check()

  // Assert — 첨부 없이도 열린다(첨부는 선택 항목이다)
  await expect(submitButton).toBeEnabled()
})

/**
 * 동의 체크박스가 눈에 보이는가.
 *
 * 2026-09-11 오너 제보 — `appearance: none` 이 네이티브 체크 표시까지 지워서 켠
 * 상태가 표시 없는 검은 사각형으로 보였다. "체크박스가 DOM 에 있다"로는 다시
 * 잡지 못하는 결함이라, **상자 크기**와 **켜짐 표시**를 화면에서 직접 확인한다.
 */
test('should show a visible consent checkbox that marks itself when checked', async ({
  page,
}, testInfo) => {
  // Arrange
  const isDesktop = testInfo.project.name === 'chromium'

  if (isDesktop) {
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  await stubLogin(page, SUPPORT_PATH)

  const consent = page.locator('input[name="consent"]')
  const mark = page.getByTestId('support-checkbox-mark')

  // Assert — 상자가 보이고 실제로 자리를 차지한다(시안 30×30)
  await expect(consent).toBeVisible()
  await expect(consent).not.toBeChecked()

  const box = await consent.boundingBox()

  expect(box).not.toBeNull()
  expect(box?.width ?? 0).toBeGreaterThan(0)
  expect(box?.height ?? 0).toBeGreaterThan(0)

  // Assert — 꺼진 상태에는 체크 표시가 없다
  await expect(mark).toHaveCount(0)

  // Act — 키보드만으로 켠다(스페이스). 마우스 없이도 동의할 수 있어야 한다
  await consent.focus()
  await page.keyboard.press('Space')

  // Assert — 상태와 표시가 함께 바뀐다
  await expect(consent).toBeChecked()
  await expect(mark).toBeVisible()

  const markBox = await mark.boundingBox()

  expect(markBox?.width ?? 0).toBeGreaterThan(0)
  expect(markBox?.height ?? 0).toBeGreaterThan(0)

  await consent.screenshot({
    path: `${CONSENT_SHOT_DIR}/consent-checked-${isDesktop ? '1440' : 'pixel7'}.png`,
  })

  // Act — 라벨을 눌러 끈다
  await page.getByText('개인정보 수집 및 이용에 동의합니다.').click()

  // Assert
  await expect(consent).not.toBeChecked()
  await expect(mark).toHaveCount(0)
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
  /* 시안 v2: 카테고리와 유형 사이는 가운뎃점이 아니라 꺾쇠 아이콘이고, 접수번호는
     `No. 1024` 로 제목 줄 오른쪽에 선다("답변 N" 표기는 없어졌다). */
  await expect(row).toContainText(CATEGORY_LABEL)
  await expect(row).toContainText(SUBTYPE_LABEL)
  await expect(row).toContainText(/No\. \d+/)
  await expect(row).not.toContainText('답변 0')

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

  // Assert — 답변 스레드에 운영자 답변이 뜬다
  await expect(page.getByText(REPLY_CONTENT)).toBeVisible()
  await expect(page.getByText('운영자', { exact: true })).toBeVisible()

  /* 시안 v2(pc-3): 답변이 달린 상세에는 상태 알약을 그리지 않는다 — 답변 블록이
     상태를 말한다. 상태가 올라갔다는 것은 목록에서 확인한다. */
  await page.goto(LIST_PATH)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toContainText('답변 완료')
  await page.goto(`${LIST_PATH}/${inquiryId}`)

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

  /* 오너 요청(2026-09-11): 취소 후에는 목록으로 돌아간다 — 취소한 문의가 그
     목록에서 사라졌기 때문에 안내도 상세가 아니라 이 화면에 붙는다. */
  await page.waitForURL(new RegExp(`${LIST_PATH}\\?cancelled=1$`))
  await expect(page.getByText('문의 접수를 취소했습니다.')).toBeVisible()

  // Assert — 취소한 문의는 더 이상 목록에 없다
  await expect(page.getByRole('link', { name: new RegExp(editedTitle) })).toHaveCount(0)

  if (isDesktop) {
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/inquiry-cancelled-list-1440.png`,
      fullPage: true,
    })
  }

  // Act — 새로고침해도 안내는 다시 뜨지 않는다(1회성)
  await page.reload()
  await expect(page.getByText('문의 접수를 취소했습니다.')).toHaveCount(0)

  // Assert — 상세는 직접 주소로는 여전히 열린다(이력, 읽기 전용) — 뱃지는 접수
  // 취소, 소유자 액션(수정 · 접수 취소)은 사라진다.
  await page.goto(`${LIST_PATH}/${inquiryId}`)
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible()
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

  // Assert — 목록에는 여전히 보이지 않는다
  await page.goto(LIST_PATH)
  await expect(page.getByRole('link', { name: new RegExp(editedTitle) })).toHaveCount(0)
})

/**
 * 첨부 접수 — 개수 상한과 실제 접수.
 *
 * 2026-09-14 부터 규칙은 하나다: 형식에 관계없이 **5개 · 합계 200MB**. 파일은 폼과
 * 함께 가지 않는다 — 고르는 즉시 브라우저가 버킷으로 올리고 폼에는 경로만 실린다.
 * 그래서 여기서 확인할 것은 셋이다.
 *
 *   1) 여섯 번째는 보내기 전에 거절되고 제출이 잠긴다(첨부가 조용히 빠지지 않게)
 *   2) 칩의 X 로 하나 내리면 다시 열린다
 *   3) 접수된 첨부가 상세에서 서명 URL 링크로 다시 보인다
 */
test('should refuse a sixth attachment before submitting and accept the rest', async ({ page }) => {
  // Arrange
  await stubLogin(page, SUPPORT_PATH)

  const title = `E2E 첨부 상한 ${Date.now()}`

  /* 제출 잠금은 두 가지 이유로 걸린다(첨부 · 필수 항목). 첨부만 남기려면 나머지를
     먼저 채워야 "첨부 때문에 잠겼는가"를 물어볼 수 있다. */
  await fillRequiredFields(page, title)

  const fileInput = page.locator('input[type="file"]')
  const submitButton = page.getByRole('button', { name: SUBMIT_LABEL })

  // Act — 한 번에 여섯 장
  await fileInput.setInputFiles(Array.from({ length: 6 }, () => 'tests/fixtures/pixel.png'))

  // Assert — 종류를 가리지 않는 한 문장으로 거절하고 제출을 잠근다
  await expect(page.getByText('첨부파일은 최대 5개까지 올릴 수 있습니다.')).toBeVisible()
  await expect(submitButton).toBeDisabled()

  /* 다섯 장은 이미 버킷으로 올라간다 — 진행 표시가 끝나야 나머지 판정이 안정된다. */
  await expect(page.getByText('첨부 완료')).toHaveCount(5, { timeout: 60_000 })

  // Act — 칩의 X 로 하나 내리면 다시 열린다(잠긴 폼에서 빠져나오는 길)
  await page.getByRole('button', { name: 'pixel.png 첨부 해제' }).first().click()

  // Assert — 파일은 input 에 남지 않는다(= 서버 액션 본문으로 나가지 않는다)
  await expect(submitButton).toBeEnabled()
  expect(await fileInput.evaluate((input: HTMLInputElement) => input.files?.length ?? -1)).toBe(0)

  // Act — 접수
  const inquiryId = await submitInquiry(page, title)

  await page
    .getByRole('dialog', { name: '문의가 접수되었습니다' })
    .getByRole('button', { name: '확인' })
    .click()

  // Assert — 상세의 첨부 목록에 서명 URL 링크로 뜬다(비공개 버킷이라 링크가 곧 접근 경로다)
  const attachmentLinks = page.getByRole('link', { name: /pixel\.png/u })
  await expect(attachmentLinks).toHaveCount(4)
  await expect(attachmentLinks.first()).toHaveAttribute('href', /inquiry-attachments/u)

  // 뒷정리 — 남겨 두면 실행할 때마다 비공개 버킷에 파일이 쌓인다.
  await cleanUpInquiry(inquiryId)
})

/**
 * 한 파일이 합계 상한을 넘는 경우.
 *
 * 200MB 를 넘는 파일은 **올리기 전에** 거절돼야 한다 — 올리기 시작하면 사용자는
 * 몇 분을 기다린 끝에 스토리지의 영문 오류를 본다. 빈 공간을 차지하지 않는 희소
 * 파일로 만든다(내용은 아무 상관이 없다 — 크기만 보고 거절된다).
 */
test('should refuse a file bigger than the shared budget without uploading it', async ({
  page,
}) => {
  // Arrange
  const oversize = makeSparseFile(`${VIDEO_FIXTURE_DIR}/inquiry-e2e-oversize.mp4`, 201)

  test.skip(oversize === null, '희소 파일을 만들 수 없습니다.')

  await stubLogin(page, SUPPORT_PATH)
  await fillRequiredFields(page, `E2E 용량 초과 ${Date.now()}`)

  const fileInput = page.locator('input[type="file"]')
  const submitButton = page.getByRole('button', { name: SUBMIT_LABEL })

  // Act
  await fileInput.setInputFiles(oversize as string)

  // Assert — 어느 파일이 문제인지 이름과 함께 알려 주고 제출을 잠근다
  await expect(page.getByText(/inquiry-e2e-oversize\.mp4 .*200MB/u)).toBeVisible()
  await expect(submitButton).toBeDisabled()
  await expect(page.getByText('올리는 중 0%')).toHaveCount(0)

  // Act — 문제가 된 선택을 비우면 다시 열린다
  await fileInput.setInputFiles('tests/fixtures/pixel.png')

  // Assert
  await expect(page.getByText('첨부 완료')).toBeVisible({ timeout: 60_000 })
  await expect(submitButton).toBeEnabled()
})

/**
 * 영상 첨부.
 *
 * 첨부는 폼과 함께 가지 **않는다**(2026-09-14 부터 형식 불문). 200MB 짜리 파일이
 * 서버 액션 본문에 실릴 수는 없으므로 브라우저가 파일을 버킷에 직접 올리고, 폼에는
 * 올라간 오브젝트의 경로만 숨은 필드로 싣는다. 이 테스트가 확인하는 것은 그 분리다 —
 *
 *   1) 고른 파일이 input 의 FileList 에 남지 않는다(= 본문에 실리지 않는다)
 *   2) 업로드가 끝나야 제출이 열린다(첨부가 조용히 빠진 접수 방지)
 *   3) 접수 후 상세에서 서명 URL 로 **재생**된다(링크가 아니라 재생기)
 */
test('should upload a video straight to storage and play it on the detail page', async ({
  page,
}) => {
  // Arrange
  const source = makeTestVideo(`${VIDEO_FIXTURE_DIR}/inquiry-e2e.mp4`)

  test.skip(source === null, 'ffmpeg 이 없어 테스트용 mp4 를 만들 수 없습니다.')

  await stubLogin(page, SUPPORT_PATH)

  const title = `E2E 영상 문의 ${Date.now()}`

  // 필수 항목을 먼저 채운다 — 영상 업로드가 끝나도 나머지가 비면 제출은 잠긴 채다.
  await fillRequiredFields(page, title)

  const fileInput = page.locator('input[type="file"]')
  const hiddenField = page.locator('input[name="pendingAttachments"]')
  const submitButton = page.getByRole('button', { name: SUBMIT_LABEL })

  // Act — 고르는 즉시 업로드가 시작된다
  await fileInput.setInputFiles(source as string)

  /* Assert — 진행 상태가 보이고, 끝나면 "첨부 완료"가 된다. 칩은 이름의 앞부분만
     보여 주므로(시안 v2) 전체 이름은 `title` 로 찾는다. */
  await expect(page.getByTitle('inquiry-e2e.mp4')).toBeVisible()
  await expect(page.getByText('첨부 완료')).toBeVisible({ timeout: 60_000 })

  /* 영상은 본문에 실리지 않는다 — input 은 비어 있고, 경로만 숨은 필드에 있다. */
  expect(await fileInput.evaluate((input: HTMLInputElement) => input.files?.length ?? -1)).toBe(0)
  await expect(hiddenField).toHaveValue(/\/pending\/[0-9a-f-]{36}\.mp4/)
  await expect(submitButton).toBeEnabled()

  // Act — 접수
  const inquiryId = await submitInquiry(page, title)

  await page
    .getByRole('dialog', { name: '문의가 접수되었습니다' })
    .getByRole('button', { name: '확인' })
    .click()

  // Assert — 상세는 링크가 아니라 재생기를 그린다(서명 URL 이 주소창에 남지 않게).
  const player = page.locator('video')
  await expect(player).toBeVisible()
  await expect(player).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/inquiry-attachments\//)
  await expect(page.getByRole('link', { name: '내려받기' })).toBeVisible()

  // Assert — 확정된 오브젝트는 pending 을 벗어나 접수된 첨부의 자리로 옮겨져 있다
  const service = createServiceClient()

  if (service !== null) {
    const stored = await service
      .from('inquiries')
      .select('attachments')
      .eq('id', inquiryId)
      .single()
    const attachments = (stored.data?.attachments ?? []) as { path: string; mimeType: string }[]

    expect(attachments).toHaveLength(1)
    expect(attachments[0]?.mimeType).toBe('video/mp4')
    expect(attachments[0]?.path.includes('/pending/')).toBe(false)

    // 뒷정리 — 남겨 두면 실행할 때마다 비공개 버킷에 영상이 쌓인다.
    await service.storage.from('inquiry-attachments').remove([attachments[0]?.path ?? ''])
    await service.from('inquiries').delete().eq('id', inquiryId)
  }
})

/**
 * 다섯 개를 **섞어서** 채우기 — 이미지 4장 + 영상 1편(오너 지시, 2026-09-14).
 *
 * 예전 규칙(이미지·PDF 3 + 영상 2)이면 네 번째 이미지에서 막혔을 조합이다. 지금은
 * 자리가 하나뿐이므로 무엇으로 채우든 다섯 개까지 그대로 접수돼야 한다.
 */
test('should accept four images together with one video', async ({ page }) => {
  // Arrange
  const video = makeTestVideo(`${VIDEO_FIXTURE_DIR}/inquiry-e2e-mix.mp4`)

  test.skip(video === null, 'ffmpeg 이 없어 테스트용 mp4 를 만들 수 없습니다.')

  await stubLogin(page, SUPPORT_PATH)

  const title = `E2E 첨부 조합 ${Date.now()}`

  await fillRequiredFields(page, title)

  const fileInput = page.locator('input[type="file"]')
  const submitButton = page.getByRole('button', { name: SUBMIT_LABEL })

  // Act — 이미지 4장 + 영상 1편을 한 번에 고른다
  await fileInput.setInputFiles([
    'tests/fixtures/pixel.png',
    'tests/fixtures/pixel.png',
    'tests/fixtures/pixel.png',
    'tests/fixtures/pixel.png',
    video as string,
  ])

  // Assert — 다섯 개 모두 올라가야 제출이 열린다(어떤 상한 문구도 뜨지 않는다)
  await expect(page.getByTitle('inquiry-e2e-mix.mp4')).toBeVisible()
  await expect(page.getByText('첨부 완료')).toHaveCount(5, { timeout: 60_000 })
  await expect(page.getByText(/최대 5개까지/u)).toHaveCount(0)
  await expect(submitButton).toBeEnabled()

  // Act — 접수
  const inquiryId = await submitInquiry(page, title)

  await page
    .getByRole('dialog', { name: '문의가 접수되었습니다' })
    .getByRole('button', { name: '확인' })
    .click()

  // Assert — 상세에 이미지 4장 + 영상 1편, 정확히 5개가 뜬다
  await expect(page.getByRole('link', { name: /pixel\.png/u })).toHaveCount(4)
  await expect(page.locator('video')).toHaveCount(1)
  expect(inquiryId).not.toBe('')

  // Assert · 뒷정리 — 저장된 첨부가 정확히 5개인지 서비스 롤로 확인하고 지운다.
  const service = createServiceClient()

  if (service !== null) {
    const stored = await service
      .from('inquiries')
      .select('attachments')
      .eq('id', inquiryId)
      .single()
    const attachments = (stored.data?.attachments ?? []) as { path: string }[]

    expect(attachments).toHaveLength(5)
  }

  await cleanUpInquiry(inquiryId)
})

/**
 * 버그제보 · 불법이용제보 창구(2026-09-14).
 *
 * 세 창구는 같은 폼·같은 목록을 쓰고 **분류 하나(kind)** 만 다르다. 그래서 확인할
 * 것도 그 하나다 —
 *
 *   1) 각 라우트의 카테고리 셀렉트가 그 창구의 카테고리만 들고 있다
 *   2) 제출 문구·완료 모달이 "문의"가 아니라 "제보"로 말한다
 *   3) 접수된 두 건이 **한** 내 문의 내역에 종류 라벨과 함께 선다
 *
 * 두 건을 같은 계정으로 내야 (3)을 볼 수 있어서 접수 사이에 도배 방지 창
 * (`WRITE_COOLDOWN_SECONDS` = 30초)을 그대로 기다린다 — 창을 우회하는 길을 테스트
 * 전용으로 뚫으면 그 길이 운영에도 남는다.
 */
test('should accept a bug report and an illegal-use report and list both by kind', async ({
  page,
}, testInfo) => {
  // Arrange
  test.setTimeout(180_000)

  const isDesktop = testInfo.project.name === 'chromium'

  if (isDesktop) {
    await page.setViewportSize({ width: 1440, height: 1200 })
  }

  await stubLogin(page, BUG_PATH)

  // Assert — 버그제보 창구의 카테고리만 고를 수 있다(1:1 문의 카테고리는 없다)
  const categoryOptions = await page.locator('select[name="category"] option').allTextContents()

  expect(categoryOptions).toContain(BUG_CATEGORY_LABEL)
  expect(categoryOptions).not.toContain(CATEGORY_LABEL)

  // Act — 접수(버튼 문구는 "제보하기")
  const bugTitle = `E2E 버그제보 ${Date.now()}`

  await fillRequiredFields(page, bugTitle, BUG_CATEGORY_LABEL, BUG_SUBTYPE_LABEL)
  await submitControl(page, REPORT_SUBMIT_LABEL).click()
  await page.waitForURL(/\/support\/inquiries\/[0-9a-f-]{36}/)

  // Assert — 완료 모달이 "제보"로 말한다
  const dialog = page.getByRole('dialog', { name: '제보가 접수되었습니다' })

  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '확인' }).click()

  /* Assert — 상세 메타에 종류가 있다. 메타는 PC·폰 두 벌이 DOM 에 있고 한 벌만
     보이므로(시안 v2) 보이는 것으로 좁힌다. 좌측 메뉴·모바일 탭에도 같은 이름이
     있어서 상세 카드(article) 안으로도 한 번 더 좁힌다. */
  await expect(
    page.locator('article').getByText(BUG_KIND_LABEL).locator('visible=true').first(),
  ).toBeVisible()

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiry-bug-detail-1440.png`, fullPage: true })
  }

  /* Act — 도배 방지 창이 지나야 두 번째 접수가 들어간다. 30초 + 여유 1초. */
  await page.waitForTimeout(31_000)

  await page.goto(REPORT_PATH)

  // Assert — 불법이용제보 창구의 카테고리
  const reportOptions = await page.locator('select[name="category"] option').allTextContents()

  expect(reportOptions).toContain(REPORT_CATEGORY_LABEL)
  expect(reportOptions).not.toContain(BUG_CATEGORY_LABEL)

  // Act
  const reportTitle = `E2E 불법이용제보 ${Date.now()}`

  await fillRequiredFields(page, reportTitle, REPORT_CATEGORY_LABEL, REPORT_SUBTYPE_LABEL)
  await submitControl(page, REPORT_SUBMIT_LABEL).click()
  await page.waitForURL(/\/support\/inquiries\/[0-9a-f-]{36}/)

  await page
    .getByRole('dialog', { name: '제보가 접수되었습니다' })
    .getByRole('button', { name: '확인' })
    .click()

  // Act — 내 문의 내역은 세 창구를 함께 보여 준다(필터 없음, 최신순)
  await page.goto(LIST_PATH)

  const reportRow = page.getByRole('link', { name: new RegExp(reportTitle) })
  const bugRow = page.getByRole('link', { name: new RegExp(bugTitle) })

  // Assert — 두 건 모두 자기 종류 라벨을 달고 선다
  await expect(reportRow).toBeVisible()
  await expect(reportRow).toContainText(REPORT_KIND_LABEL)
  await expect(reportRow).toContainText(REPORT_CATEGORY_LABEL)
  await expect(bugRow).toBeVisible()
  await expect(bugRow).toContainText(BUG_KIND_LABEL)
  await expect(bugRow).toContainText(BUG_CATEGORY_LABEL)

  if (isDesktop) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/inquiries-kinds-1440.png`, fullPage: true })
  }
})

/**
 * 회원 답장(2026-09-14).
 *
 * 운영자가 **처리 중** 상태로 답한 문의에서만 열리는 대화다. 관리자 화면은 별도
 * 앱이라 그 상태는 서비스 롤로 만든다 — 확인하려는 것은 콘솔이 아니라 이 화면이
 * 규칙대로 열리고 닫히는가이기 때문이다.
 *
 *   1) 처리 중 + 운영자 답변 → 답장 폼이 열린다(내용이 비면 잠긴 채다)
 *   2) 보낸 답장이 같은 스레드에 "내 답변"으로, 첨부까지 함께 선다
 *   3) 그 한 건으로 창이 닫힌다 — 운영자 답변 하나에 답장 하나(2026-09-15)
 *   4) 답변 완료로 닫히면 폼이 사라지고 완료 안내만 남는다(재개 없음)
 */
test('should let the member reply while in progress and close the thread once answered', async ({
  page,
}) => {
  // Arrange
  const service = createServiceClient()

  test.skip(service === null, '서비스 롤 키가 없어 운영자 답변을 만들 수 없습니다.')

  await stubLogin(page, SUPPORT_PATH)

  const title = `E2E 답장 ${Date.now()}`
  const inquiryId = await submitInquiry(page, title)

  await page
    .getByRole('dialog', { name: '문의가 접수되었습니다' })
    .getByRole('button', { name: '확인' })
    .click()

  // Act — 운영자가 처리 중 상태로 답변을 남긴 상황을 만든다
  await seedOperatorQuestion(service, inquiryId)
  await page.goto(`${LIST_PATH}/${inquiryId}`)

  // Assert — 운영자 답변이 스레드에 서고 답장 폼이 열린다(내용이 비면 잠긴 채다)
  await expect(page.getByText(OPERATOR_QUESTION)).toBeVisible()

  const submit = page.getByRole('button', { name: USER_REPLY_SUBMIT_LABEL })

  await expect(submit).toBeDisabled()

  // Act — 텍스트 + 이미지 한 장으로 답장한다
  await page.getByRole('textbox', { name: /답장 내용/u }).fill(USER_REPLY_CONTENT)
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/pixel.png')
  await expect(page.getByText('pixel.png')).toBeVisible()
  await expect(submit).toBeEnabled()
  await submit.click()

  // Assert — 1회성 안내와 함께 내 답장이 같은 스레드에 붙는다
  await expect(page.getByText('답장을 보냈습니다.')).toBeVisible()
  await expect(page.getByText(USER_REPLY_CONTENT)).toBeVisible()
  await expect(page.getByText('내 답변')).toBeVisible()
  await expect(page.getByRole('link', { name: /pixel\.png/u })).toBeVisible()

  // Assert — 한 건으로 창이 닫힌다(다음 답장은 운영자가 다시 답해야 열린다)
  await expect(page.getByRole('button', { name: USER_REPLY_SUBMIT_LABEL })).toHaveCount(0)
  await expect(page.getByText(REPLY_TOO_MANY_NOTICE)).toBeVisible()

  // Act — 운영자가 답변 완료로 닫는다
  await service
    ?.from('inquiries')
    .update({ status: 'answered', answered_at: new Date().toISOString() })
    .eq('id', inquiryId)
  await page.goto(`${LIST_PATH}/${inquiryId}`)

  // Assert — 폼이 사라지고 완료 안내만 남는다(대화는 다시 열리지 않는다)
  await expect(page.getByRole('button', { name: USER_REPLY_SUBMIT_LABEL })).toHaveCount(0)
  await expect(page.getByText(THREAD_CLOSED_NOTICE)).toBeVisible()
  await expect(page.getByText(USER_REPLY_CONTENT)).toBeVisible()
})
