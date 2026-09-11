import path from 'node:path'

import { expect, test } from '@playwright/test'

import { createServiceClient, signInAsAdmin } from './inquiry-faq-helpers'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 카테고리 템플릿 인수 검증 — 관리 화면에서 고친 양식이 **새 글 폼까지** 흘러가는가.
 *
 * 따라가는 길은 하나다.
 *   템플릿 수정 → 저장 → 새 글에서 카테고리 선택 → 제목·본문이 그 양식으로 채워짐 →
 *   쓰던 내용이 있을 때만 확인 모달 → 취소하면 내용 유지 → 적용하면 갈아 끼움 →
 *   기본값으로 되돌리기.
 *
 * 로그인 자격 증명과 서비스 롤은 저장소에 두지 않는다 — 스크래치패드의 env 파일을 읽는
 * 공용 도구(`inquiry-faq-helpers.ts`)를 그대로 쓴다(파일 이름은 고객지원이지만 로그인·
 * 서비스 클라이언트는 모듈과 무관한 공용이다).
 */

const SHOT_DIR =
  process.env.NEWS_TEMPLATE_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/news-templates'

const STAMP = Date.now().toString().slice(-6)

const EDITED_TITLE = `[E2E] 점검 안내 ${STAMP}`
const EDITED_BODY = `E2E 점검 본문 ${STAMP}`
/** 운영자가 직접 쓴 문장. 이것이 남아 있을 때만 확인 모달이 서야 한다. */
const OPERATOR_LINE = ` 운영자가 직접 쓴 문장 ${STAMP}`

/** 마이그레이션 시드와 같은 문안. '기본값으로 되돌리기' 가 여기로 돌아와야 한다. */
const SEED_TITLE = '[점검] {{날짜}} 정기 점검 안내'

let service: SupabaseClient

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  service = createServiceClient()
})

test.afterAll(async () => {
  /* 마지막 단계가 UI 로 되돌리므로 보통은 할 일이 없다. 중간에 실패해 E2E 문안이 남으면
     그 행을 지운다 — 행이 없으면 화면은 코드 시드(= 마이그레이션 시드)로 떨어지므로
     결과적으로 기본값 상태가 된다. */
  const { data } = await service
    .from('news_category_templates')
    .select('category_key, title_template')

  for (const row of data ?? []) {
    if (typeof row.title_template === 'string' && row.title_template.includes('[E2E]')) {
      await service.from('news_category_templates').delete().eq('category_key', row.category_key)
    }
  }

  /* '사용 안 함' 검증이 끄는 유일한 카테고리를 되돌린다. 중간에 실패하면 그 카테고리의
     템플릿이 꺼진 채 남아, 다음 사람이 이유 없이 프리필이 안 되는 화면을 만난다. */
  await service
    .from('news_category_templates')
    .update({ is_active: true })
    .eq('category_key', 'info')

  // 검증 중 실수로 글이 저장됐다면 함께 치운다(소프트 삭제가 아니라 물리 삭제).
  await service.from('posts').delete().eq('board', 'news').like('title', '[E2E]%')
})

test('고친 템플릿이 새 글 폼을 채우고, 쓰던 내용이 있으면 확인을 받는다', async ({ page }) => {
  /* 관리자 셸은 `max-w-[1440px]` 기준이다. 기본 1280 으로 찍으면 실제 운영 화면과 다른
     그림이 남는다. */
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signInAsAdmin(page)

  // Act — 진입점은 뉴스 목록 헤더의 '카테고리 템플릿'
  await page.goto('/news')
  await page.getByRole('link', { name: '카테고리 템플릿' }).first().click()
  await expect(page.getByRole('heading', { name: '카테고리 템플릿 관리' })).toBeVisible()

  // Assert — 카테고리 6종이 모두 한 줄씩 있다(저장된 적 없는 카테고리도 기본값으로 보인다)
  await expect(page.locator('[data-testid^="news-template-"]')).toHaveCount(6)
  await page.screenshot({ path: path.join(SHOT_DIR, '01-templates-list.png'), fullPage: true })

  // Act — 점검안내 템플릿을 고친다
  await page.getByTestId('news-template-maintenance').getByRole('link', { name: '수정' }).click()
  await expect(page.getByRole('heading', { name: '점검안내 템플릿' })).toBeVisible()

  await page.getByRole('textbox', { name: '제목 템플릿', exact: true }).fill(EDITED_TITLE)

  const templateEditor = page.getByRole('textbox', { name: '본문 템플릿', exact: true })

  await templateEditor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(EDITED_BODY)

  await page.getByRole('button', { name: '저장', exact: true }).click()

  // Assert — 저장 뒤 미리보기가 새 문안을 그린다(미리보기는 저장된 값을 그린다)
  await expect(page.getByText('템플릿을 저장했습니다')).toBeVisible()
  await expect(page.getByTestId('news-template-preview')).toContainText(EDITED_BODY)
  await page.screenshot({ path: path.join(SHOT_DIR, '02-template-edit.png'), fullPage: true })

  // Act — 새 글에서 그 카테고리를 고른다
  await page.goto('/news/new')
  await page.getByLabel('카테고리').selectOption('maintenance')

  const title = page.getByRole('textbox', { name: '제목', exact: true })
  const body = page.getByRole('textbox', { name: '본문', exact: true })

  // Assert — 제목과 본문이 방금 고친 양식으로 채워진다
  await expect(title).toHaveValue(EDITED_TITLE)
  await expect(body).toContainText(EDITED_BODY)
  await page.screenshot({ path: path.join(SHOT_DIR, '03-news-new-prefill.png'), fullPage: true })

  // Act — 운영자가 본문을 손본 뒤 카테고리를 바꾼다
  await body.click()
  await page.keyboard.press('ControlOrMeta+ArrowDown')
  await page.keyboard.type(OPERATOR_LINE)
  await page.getByLabel('카테고리').selectOption('event')

  // Assert — 이때만 확인 모달이 선다
  const dialog = page.getByRole('dialog')

  await expect(dialog).toContainText('작성 중인 내용이 지워집니다.')
  await page.screenshot({ path: path.join(SHOT_DIR, '04-confirm-dialog.png') })

  // Act — 취소하면 쓰던 내용이 남는다(카테고리 변경만 남는다)
  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(body).toContainText(OPERATOR_LINE.trim())
  await expect(page.getByLabel('카테고리')).toHaveValue('event')

  // Act — 다시 고르고 이번에는 적용한다
  await page.getByLabel('카테고리').selectOption('maintenance')
  await page.getByRole('dialog').getByRole('button', { name: '적용' }).click()

  // Assert — 본문은 양식으로 갈아 끼워지고, 운영자가 쓴 제목은 그대로 남는다
  await expect(body).toContainText(EDITED_BODY)
  await expect(body).not.toContainText(OPERATOR_LINE.trim())
  await expect(title).toHaveValue(EDITED_TITLE)
  await page.screenshot({ path: path.join(SHOT_DIR, '05-after-apply.png'), fullPage: true })
})

test('기본값으로 되돌리면 시드 문안이 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signInAsAdmin(page)
  await page.goto('/news/templates/maintenance')

  // Assert — 앞 테스트가 고쳐 둔 상태
  await expect(page.getByRole('textbox', { name: '제목 템플릿', exact: true })).toHaveValue(
    EDITED_TITLE,
  )

  // Act
  await page.getByRole('button', { name: '기본값으로 되돌리기' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog).toContainText('처음 배포된 기본 템플릿으로 덮어씁니다')
  await page.screenshot({ path: path.join(SHOT_DIR, '06-reset-dialog.png') })
  await dialog.getByRole('button', { name: '되돌리기', exact: true }).click()

  /* Assert — 되돌린 뒤에는 목록으로 돌아온다(편집 화면의 비제어 입력이 옛 문안을 계속
     보여 주지 않도록). 그 줄은 이제 '기본값' 이다. */
  await page.waitForURL('**/news/templates')
  await expect(page.getByTestId('news-template-maintenance')).toContainText('기본값')
  await page.screenshot({
    path: path.join(SHOT_DIR, '07-templates-after-reset.png'),
    fullPage: true,
  })

  // Assert — 다시 열면 시드 문안이고, 이미 기본값이라 되돌리기 버튼도 없다
  await page.goto('/news/templates/maintenance')
  await expect(page.getByRole('textbox', { name: '제목 템플릿', exact: true })).toHaveValue(
    SEED_TITLE,
  )
  await expect(page.getByRole('button', { name: '기본값으로 되돌리기' })).toHaveCount(0)
  await page.screenshot({ path: path.join(SHOT_DIR, '08-template-reset.png'), fullPage: true })
})

test('꺼 둔 템플릿은 새 글 폼에서 아무것도 채우지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signInAsAdmin(page)

  // Act — 안내사항 템플릿을 끈다
  await page.goto('/news/templates/info')
  await page
    .getByRole('checkbox', { name: '새 글 작성 화면에서 이 카테고리를 고르면 템플릿 채우기' })
    .uncheck()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByText('템플릿을 저장했습니다')).toBeVisible()

  // Assert — 목록이 '사용 안 함' 으로 바뀐다
  await page.goto('/news/templates')
  await expect(page.getByTestId('news-template-info')).toContainText('사용 안 함')
  await page.screenshot({ path: path.join(SHOT_DIR, '09-template-inactive.png'), fullPage: true })

  // Assert — 새 글에서 그 카테고리를 골라도 제목·본문이 그대로 비어 있다
  await page.goto('/news/new')
  await page.getByLabel('카테고리').selectOption('info')
  await expect(page.getByRole('textbox', { name: '제목', exact: true })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: '본문', exact: true })).toHaveText('')
  await page.screenshot({ path: path.join(SHOT_DIR, '10-inactive-no-prefill.png'), fullPage: true })

  // Act — 되돌린다(다음 사람이 꺼진 템플릿을 만나지 않게)
  await page.goto('/news/templates/info')
  await page
    .getByRole('checkbox', { name: '새 글 작성 화면에서 이 카테고리를 고르면 템플릿 채우기' })
    .check()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByText('템플릿을 저장했습니다')).toBeVisible()

  await page.goto('/news/templates')
  await expect(page.getByTestId('news-template-info')).toContainText('사용')
})
