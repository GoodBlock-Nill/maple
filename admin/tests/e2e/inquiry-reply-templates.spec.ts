import { expect, test } from '@playwright/test'

import { createServiceClient, signInAsAdmin } from './inquiry-faq-helpers'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 답변 템플릿 인수 검증 — 등록 → 문의 답변에 불러오기(자리표시자 치환) → 삭제.
 *
 * 한 줄기라 serial 로 묶는다. 픽스처(일회용 사용자 · 문의 1건)는 서비스 롤로 만들고
 * 끝나면 지운다. 시드 템플릿은 건드리지 않는다 — 운영 문안이다.
 */
const STAMP = Date.now().toString().slice(-6)
const FIXTURE_EMAIL = `e2e-template-${STAMP}@example.com`
/* 닉네임은 회원가입 트리거가 길이 상한으로 자른다. 화면에 실제로 보이는 값을
   beforeAll 에서 다시 읽어 쓴다 — 자리표시자 치환을 그 값으로 검증해야 한다. */
const REQUESTED_NICKNAME = `E2E고객${STAMP}`
const INQUIRY_TITLE = `[E2E] 템플릿 문의 ${STAMP}`
const TEMPLATE_NAME = `E2E템플릿${STAMP}`

/** 문의 카테고리 시드의 라벨. 이 분류의 문의에서만 보이는 템플릿을 만든다. */
const CATEGORY_LABEL = '재화·아이템'

const TEMPLATE_BODY = [
  '안녕하세요, {{닉네임}}님.',
  '접수번호 {{문의번호}} · {{카테고리}} · {{제목}} 건을 확인했습니다.',
].join('\n')

const SHOT_DIR =
  process.env.INQUIRY_REPLY_TEMPLATE_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/reply-templates'

let service: SupabaseClient
let nickname = REQUESTED_NICKNAME
let fixtureUserId = ''
let inquiryId = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  service = createServiceClient()

  const created = await service.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: `${STAMP}-e2e-template-pw`,
    email_confirm: true,
    user_metadata: { nickname: REQUESTED_NICKNAME },
  })

  fixtureUserId = created.data.user?.id ?? ''
  expect(fixtureUserId, '일회용 사용자를 만들지 못했습니다').toBeTruthy()

  const profile = await service.from('profiles').select('nickname').eq('id', fixtureUserId).single()

  nickname = profile.data?.nickname ?? REQUESTED_NICKNAME

  const inquiry = await service
    .from('inquiries')
    .insert({
      user_id: fixtureUserId,
      account_id: '123456789012345',
      category: CATEGORY_LABEL,
      type: '아이템 미지급/소실',
      title: INQUIRY_TITLE,
      content: '아이템이 사라졌습니다.',
      privacy_consent: true,
      status: 'pending',
    })
    .select('id')
    .single()

  inquiryId = inquiry.data?.id ?? ''
  expect(inquiryId, '픽스처 문의를 만들지 못했습니다').toBeTruthy()
})

test.afterAll(async () => {
  // 실패로 중간에 멈춰도 남지 않게 이름으로 한 번 더 훑는다(시드는 'E2E' 로 시작하지 않는다).
  await service.from('inquiry_reply_templates').delete().like('name', 'E2E%')

  if (inquiryId !== '') {
    await service.from('inquiries').delete().eq('id', inquiryId)
  }

  if (fixtureUserId !== '') {
    await service.auth.admin.deleteUser(fixtureUserId)
  }
})

test('카테고리 화면에서 답변 템플릿을 등록한다', async ({ page }) => {
  await signInAsAdmin(page)

  // Act — 진입점은 문의 카테고리 화면 헤더의 '답변 템플릿'
  await page.goto('/inquiries/categories')
  await page.getByRole('link', { name: '답변 템플릿' }).first().click()
  await expect(page.getByRole('heading', { name: '답변 템플릿' })).toBeVisible()

  // Assert — 시드가 공통 묶음에 있다(운영 문안이라 화면이 비어 있으면 안 된다)
  await expect(page.getByText('접수 확인 안내')).toBeVisible()
  await page.screenshot({ path: `${SHOT_DIR}/admin-templates-list.png`, fullPage: true })

  // Act — 등록 다이얼로그
  await page.getByRole('button', { name: '템플릿 등록' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('카테고리').selectOption({ label: CATEGORY_LABEL })
  await dialog.getByLabel('템플릿 이름').fill(TEMPLATE_NAME)
  await dialog.getByLabel('템플릿 내용').fill(TEMPLATE_BODY)

  // Assert — 미리보기는 **치환된 뒤의 문장**을 보여 준다(예시 문의로 채운다)
  await expect(dialog.getByText('안녕하세요, 글자용사님.')).toBeVisible()
  await page.screenshot({ path: `${SHOT_DIR}/admin-template-create-dialog.png` })

  await dialog.getByRole('button', { name: '등록', exact: true }).click()
  await expect(page.locator('li').filter({ hasText: TEMPLATE_NAME })).toBeVisible()
  await page.screenshot({ path: `${SHOT_DIR}/admin-templates-after-create.png`, fullPage: true })
})

test('문의 답변에 템플릿을 불러오면 자리표시자가 그 문의의 값으로 바뀐다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto(`/inquiries/${inquiryId}`)
  await expect(page.getByRole('heading', { name: INQUIRY_TITLE })).toBeVisible()

  const editor = page.getByLabel('답변 내용')

  // Arrange — 쓰던 글이 있는 상태에서 불러오면 확인을 세운다
  await editor.fill('작성 중이던 초안입니다.')
  await page.getByLabel('템플릿 불러오기').selectOption({ label: TEMPLATE_NAME })
  await page.getByRole('button', { name: '불러오기' }).click()

  const confirm = page.getByRole('dialog')
  await expect(confirm).toContainText('작성 중인 답변이 지워집니다')
  await page.screenshot({ path: `${SHOT_DIR}/admin-template-confirm.png` })

  // Act — 쓰던 글을 두고 이어 붙이기
  await confirm.getByRole('button', { name: '끝에 추가' }).click()
  await expect(editor).toHaveValue(/작성 중이던 초안입니다\./)
  await expect(editor).toHaveValue(new RegExp(`안녕하세요, ${nickname}님\\.`))

  // Act — 다시 불러와 템플릿으로 바꾼다
  await page.getByRole('button', { name: '불러오기' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '템플릿으로 바꾸기' }).click()

  // Assert — 치환된 문장만 남는다(자리표시자가 남으면 사용자 화면에 그대로 노출된다)
  const inserted = await editor.inputValue()
  expect(inserted).toContain(`안녕하세요, ${nickname}님.`)
  expect(inserted).toContain(inquiryId.slice(0, 8).toUpperCase())
  expect(inserted).toContain(CATEGORY_LABEL)
  expect(inserted).toContain(INQUIRY_TITLE)
  expect(inserted).not.toContain('{{')
  expect(inserted).not.toContain('작성 중이던 초안')
  await page.screenshot({ path: `${SHOT_DIR}/admin-template-inserted.png`, fullPage: true })

  // Act — 그대로 등록한다(답변 액션은 손대지 않았다)
  await page.getByRole('button', { name: '답변 등록' }).click()
  await expect(page.getByTestId('inquiry-status')).toContainText('답변 완료')

  // Assert — 저장된 답변에도 치환된 문장이 그대로 들어간다
  const { data } = await service
    .from('inquiry_replies')
    .select('content')
    .eq('inquiry_id', inquiryId)
    .single()

  expect(data?.content).toContain(`안녕하세요, ${nickname}님.`)
  expect(data?.content).not.toContain('{{닉네임}}')
  await page.screenshot({ path: `${SHOT_DIR}/admin-reply-saved.png`, fullPage: true })
})

test('템플릿을 삭제하면 답변 화면의 선택지에서도 사라진다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/inquiries/reply-templates')

  const row = page.locator('li').filter({ hasText: TEMPLATE_NAME })
  await row.getByRole('button', { name: '삭제' }).click()

  const dialog = page.getByRole('dialog')
  // 확인 창은 "이미 등록된 답변은 그대로 남는다"를 적는다(삭제의 실제 효과).
  await expect(dialog).toContainText('이미 등록된 답변은 그대로 남고')
  await dialog.getByRole('button', { name: '삭제', exact: true }).click()

  await expect(page.locator('li').filter({ hasText: TEMPLATE_NAME })).toHaveCount(0)

  // Assert — 문의 상세의 선택 상자에서도 사라진다
  await page.goto(`/inquiries/${inquiryId}`)
  await expect(page.getByLabel('템플릿 불러오기')).not.toContainText(TEMPLATE_NAME)
})
