import { expect, test } from '@playwright/test'

import { CLIENT_URL, createServiceClient, signInAsAdmin } from './inquiry-faq-helpers'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * 문의 카테고리 인수 검증 — 등록 → 사용자 폼 노출 → 프리필 수정 반영 → 삭제.
 *
 * 사용자 사이트의 카테고리 목록은 `unstable_cache`(태그 'inquiry-categories', 300초)로
 * 감싸여 있다. 관리자 앱은 **다른 프로세스**라 `revalidateTag()` 가 닿지 않으므로,
 * 저장 뒤 `revalidateClient()` 가 사용자 사이트의 `POST /api/revalidate` 를 부른다
 * (`lib/revalidate.ts`). 무효화가 끊겼을 때를 대비해 TTL 한 번 만큼의 예산을 남긴다.
 */
const CLIENT_CACHE_BUDGET_MS = 6 * 60 * 1000

const STAMP = Date.now().toString().slice(-6)
/* 라벨 상한이 20자다. E2E 표식과 타임스탬프를 넣어도 넘지 않게 짧게 만든다. */
const LABEL = `E2E분류${STAMP}`
const RENAMED_LABEL = `E2E개명${STAMP}`
const DESCRIPTION = 'E2E 로 만든 카테고리입니다.'
const PREFILL = '닉네임:\n증상:\n발생 일시:'
const EDITED_PREFILL = '닉네임:\n증상:\n발생 일시:\n첨부:'

const SHOT_DIR =
  process.env.INQUIRY_CATEGORY_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-categories'

let service: SupabaseClient

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  service = createServiceClient()
})

test.afterAll(async () => {
  // 실패로 중간에 멈춰도 남지 않게, 이름이 바뀐 경우까지 함께 지운다.
  await service.from('inquiry_categories').delete().like('label', 'E2E%')
})

/** 사용자 문의 폼이 기대하는 문구를 보여 줄 때까지 기다렸다가 그 HTML 을 돌려준다. */
async function waitForClientSupportHtml(
  request: APIRequestContext,
  visibleText: string,
): Promise<string> {
  let html = ''

  await expect
    .poll(
      async () => {
        const response = await request.get(`${CLIENT_URL}/support`)

        /* 200 이 아닌 응답은 판정에 쓰지 않는다. 오류 페이지를 "없음"으로 세면
           노출/미노출 검증이 거짓으로 통과한다. */
        if (!response.ok()) {
          return false
        }

        html = await response.text()

        return html.includes(visibleText)
      },
      {
        timeout: CLIENT_CACHE_BUDGET_MS,
        intervals: [1_000, 3_000, 10_000, 15_000],
        message: `사용자 폼 ${CLIENT_URL}/support 가 "${visibleText}" 를 보여 주지 않았습니다(카테고리 캐시 TTL 300초).`,
      },
    )
    .toBe(true)

  return html
}

function categoryRow(page: Page, label: string) {
  return page.locator('li').filter({ hasText: label })
}

test('카테고리를 등록·수정·삭제하면 사용자 문의 폼이 따라 바뀐다', async ({ page, request }) => {
  test.setTimeout(CLIENT_CACHE_BUDGET_MS + 180_000)

  await signInAsAdmin(page)

  // Act — 진입점은 문의 목록 헤더의 '카테고리 관리'
  await page.goto('/inquiries?source=web')
  await page.getByRole('link', { name: '카테고리 관리' }).click()
  await expect(page.getByRole('heading', { name: '문의 카테고리' })).toBeVisible()
  await page.screenshot({ path: `${SHOT_DIR}/admin-categories-list.png`, fullPage: true })

  // Act — 추가 다이얼로그
  await page.getByRole('button', { name: '카테고리 등록' }).click()

  const createDialog = page.getByRole('dialog')
  await createDialog.getByLabel('이름').fill(LABEL)
  await createDialog.getByLabel('설명').fill(DESCRIPTION)
  await createDialog.getByLabel('프리필(문의 내용 양식)').fill(PREFILL)

  // Assert — 미리보기가 줄바꿈을 그대로 보여 준다
  await expect(createDialog.getByText('사용자 화면 미리보기')).toBeVisible()
  await page.screenshot({ path: `${SHOT_DIR}/admin-category-create-dialog.png` })

  await createDialog.getByRole('button', { name: '등록', exact: true }).click()
  await expect(categoryRow(page, LABEL)).toBeVisible()

  // Assert — 사용자 폼에 라벨 · 설명이 아니라 옵션으로 들어간다(프리필은 옵션 데이터)
  const html = await waitForClientSupportHtml(request, LABEL)
  expect(html).toContain(LABEL)

  // Act — 수정: 이름과 프리필을 함께 바꾼다
  await categoryRow(page, LABEL).getByRole('button', { name: '수정' }).click()

  const editDialog = page.getByRole('dialog')
  await editDialog.getByLabel('이름').fill(RENAMED_LABEL)
  await editDialog.getByLabel('프리필(문의 내용 양식)').fill(EDITED_PREFILL)
  await page.screenshot({ path: `${SHOT_DIR}/admin-category-edit-dialog.png` })
  await editDialog.getByRole('button', { name: '수정', exact: true }).click()

  await expect(categoryRow(page, RENAMED_LABEL)).toBeVisible()

  // Assert — 사용자 폼이 새 이름을 보여 준다
  await waitForClientSupportHtml(request, RENAMED_LABEL)

  // Assert — 프리필도 새 양식으로 바뀐다(폼이 옵션 데이터로 들고 있다)
  await page.goto(`${CLIENT_URL}/support`)
  await page.locator('select[name="category"]').selectOption(RENAMED_LABEL)
  await expect(page.locator('textarea[name="content"]')).toHaveValue(EDITED_PREFILL)
  await page.screenshot({ path: `${SHOT_DIR}/client-support-prefill.png`, fullPage: true })

  // Act — 삭제 다이얼로그(문의 0건이라 삭제할 수 있다)
  await page.goto('/inquiries/categories')
  await categoryRow(page, RENAMED_LABEL).getByRole('button', { name: '삭제' }).click()

  const deleteDialog = page.getByRole('dialog')
  await expect(deleteDialog).toContainText('접수된 문의 0건')
  await page.screenshot({ path: `${SHOT_DIR}/admin-category-delete-dialog.png` })
  await deleteDialog.getByRole('button', { name: '삭제', exact: true }).click()

  // Assert — 목록에서 사라지고, 사용자 폼에서도 사라진다
  await expect(categoryRow(page, RENAMED_LABEL)).toHaveCount(0)

  await expect
    .poll(
      async () => {
        const response = await request.get(`${CLIENT_URL}/support`)

        return response.ok() ? !(await response.text()).includes(RENAMED_LABEL) : false
      },
      {
        timeout: CLIENT_CACHE_BUDGET_MS,
        intervals: [1_000, 3_000, 10_000, 15_000],
        message: '삭제한 카테고리가 사용자 폼에서 사라지지 않았습니다.',
      },
    )
    .toBe(true)
})

test('접수된 문의가 있는 카테고리는 삭제 대신 비활성화를 안내한다', async ({ page }) => {
  // Arrange — 이 라벨로 접수된 문의를 하나 심는다(사용자 없이 서비스 롤로).
  const label = `E2E사용중${STAMP}`
  const created = await service
    .from('inquiry_categories')
    .insert({ key: `e2e-inuse-${STAMP}`, label, prefill: '닉네임:', sort_order: 99 })
    .select('id')
    .single()

  expect(created.error, '카테고리 픽스처를 만들지 못했습니다').toBeNull()

  const inquiry = await service
    .from('inquiries')
    .insert({
      category: label,
      type: '문의',
      title: `[E2E] 카테고리 사용 ${STAMP}`,
      content: '삭제 가드 검증용 문의입니다.',
      privacy_consent: true,
    })
    .select('id')
    .single()

  expect(inquiry.error, '문의 픽스처를 만들지 못했습니다').toBeNull()

  try {
    await signInAsAdmin(page)
    await page.goto('/inquiries/categories')

    // Act
    await categoryRow(page, label).getByRole('button', { name: '삭제' }).click()

    const dialog = page.getByRole('dialog')

    // Assert — 무엇이 막고 있는지(건수)와 다음 행동(비활성화)이 그 자리에 있다
    await expect(dialog).toContainText('접수된 문의 1건')
    await expect(dialog).toContainText('비활성화')
    await expect(dialog.getByRole('button', { name: '삭제', exact: true })).toBeDisabled()
    await page.screenshot({ path: `${SHOT_DIR}/admin-category-delete-blocked.png` })

    await dialog.getByRole('button', { name: '취소' }).click()

    // Act — 대신 숨긴다
    await categoryRow(page, label).getByRole('button', { name: '숨기기' }).click()

    // Assert
    await expect(categoryRow(page, label).getByText('숨김', { exact: true })).toBeVisible()

    /* Act — 이름을 바꾸면 이 라벨로 접수된 과거 문의도 함께 옮겨져야 한다
       (`public.update_inquiry_category()` 한 트랜잭션). */
    const renamed = `E2E개명중${STAMP}`

    await categoryRow(page, label).getByRole('button', { name: '수정' }).click()

    const editDialog = page.getByRole('dialog')
    await editDialog.getByLabel('이름').fill(renamed)
    await editDialog.getByRole('button', { name: '수정', exact: true }).click()

    // Assert — 완료 안내가 몇 건을 옮겼는지 말해 준다
    await expect(page.getByText('기존 문의 1건')).toBeVisible()

    const moved = await service
      .from('inquiries')
      .select('category')
      .eq('id', inquiry.data?.id ?? '')
      .single()

    expect(moved.data?.category, '과거 문의의 분류가 새 이름으로 옮겨지지 않았습니다').toBe(renamed)
  } finally {
    await service
      .from('inquiries')
      .delete()
      .eq('id', inquiry.data?.id ?? '')
    await service
      .from('inquiry_categories')
      .delete()
      .eq('id', created.data?.id ?? '')
  }
})
