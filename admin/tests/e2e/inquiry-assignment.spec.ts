import path from 'node:path'

import { expect, test } from '@playwright/test'

import { createServiceClient, signInAsAdmin, signInAs } from './inquiry-faq-helpers'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 1:1 문의 협업 인수 검증 — 담당자 배정 · 작성 중 잠금 · 저장 충돌 · 내부 메모.
 *
 * **두 개의 브라우저 컨텍스트**를 쓴다. 이 기능이 막으려는 사고("두 운영자가 같은
 * 문의에 동시에 답한다")는 한 세션으로는 재현되지 않는다.
 *
 * 픽스처(일회용 사용자 · 문의 1건)는 서비스 롤로 만들고 끝나면 지운다. 흐름이 한
 * 줄기라 serial 로 묶는다.
 */
const STAMP = Date.now().toString()
const FIXTURE_EMAIL = `e2e-assign-${STAMP}@example.com`
const INQUIRY_TITLE = `[E2E] 협업 문의 ${STAMP}`
const NOTE_BODY = `E2E 내부 메모 ${STAMP}`
const DRAFT = '두 번째 운영자가 쓰던 답변입니다. 이 글은 사라지면 안 됩니다.'

const CONFLICT_MESSAGE = '다른 운영자가 먼저 처리했습니다. 최신 내용을 확인해 주세요.'

const SHOT_DIR =
  process.env.ADMIN_E2E_ASSIGNMENT_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-assignment'

/** 두 번째 운영자. 첫 번째(부트스트랩 계정)와 반드시 다른 사람이어야 한다. */
const SECOND_ADMIN = { email: 'admin@good-block.com', password: 'qwer1234' }

function shot(name: string): string {
  return path.join(SHOT_DIR, name)
}

let service: SupabaseClient
let fixtureUserId = ''
let inquiryId = ''
let inquiryNo = 0

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  service = createServiceClient()

  const created = await service.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: `${STAMP}-e2e-assign-pw`,
    email_confirm: true,
    user_metadata: { nickname: `E2E협업${STAMP.slice(-6)}` },
  })

  fixtureUserId = created.data.user?.id ?? ''
  expect(fixtureUserId, '일회용 사용자를 만들지 못했습니다').toBeTruthy()

  const { data, error } = await service
    .from('inquiries')
    .insert({
      user_id: fixtureUserId,
      account_id: `${STAMP}00000`.slice(0, 15),
      category: '기타·건의',
      type: '기타',
      title: INQUIRY_TITLE,
      content: '두 운영자가 같은 문의를 여는 상황을 검증합니다.',
      privacy_consent: true,
      status: 'pending',
    })
    .select('id, inquiry_no')
    .single()

  expect(error, '문의 픽스처를 만들지 못했습니다').toBeNull()
  inquiryId = data?.id ?? ''
  inquiryNo = data?.inquiry_no ?? 0
})

test.afterAll(async () => {
  if (inquiryId !== '') {
    // 메모·답변은 on delete cascade 로 함께 사라진다.
    await service.from('inquiries').delete().eq('id', inquiryId)
  }

  if (fixtureUserId !== '') {
    await service.auth.admin.deleteUser(fixtureUserId)
  }
})

test('첫 운영자가 문의를 맡으면 목록의 담당자 칸과 상태가 함께 바뀐다', async ({ page }) => {
  await signInAsAdmin(page)

  // 미배정 필터 + 접수번호 검색으로 찾는다(둘 다 이번에 추가된 경로다).
  await page.goto(`/inquiries?status=open&assignee=none&q=%23${inquiryNo}`)
  await expect(page.getByRole('link', { name: INQUIRY_TITLE })).toBeVisible()
  await expect(page.getByRole('cell', { name: `#${inquiryNo}` })).toBeVisible()
  await page.screenshot({ path: shot('01-list-unassigned.png'), fullPage: true })

  await page.goto(`/inquiries/${inquiryId}`)
  await expect(page.getByTestId('inquiry-assignee')).toContainText('미배정')

  await page.getByRole('button', { name: '나에게 배정' }).click()

  // 미배정 + 접수 대기 문의를 맡으면 상태도 '처리 중'으로 간다.
  await expect(page.getByTestId('inquiry-status')).toContainText('처리 중')
  await expect(page.getByTestId('inquiry-assignee')).toContainText('내가 담당')
  await page.screenshot({ path: shot('02-detail-assignment-card.png'), fullPage: true })

  await page.goto(`/inquiries?status=open&assignee=me&q=%23${inquiryNo}`)
  await expect(page.getByRole('link', { name: INQUIRY_TITLE })).toBeVisible()
  await page.screenshot({ path: shot('03-list-assigned-to-me.png'), fullPage: true })
})

test('두 번째 운영자에게는 "작성 중" 배너가 보이고, 먼저 답변이 달리면 저장이 거절된다', async ({
  browser,
}) => {
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()

  try {
    await signInAsAdmin(first)
    await signInAs(second, SECOND_ADMIN.email, SECOND_ADMIN.password)

    // 첫 운영자가 상세를 연다 → 답변 폼이 뜨면서 잠금을 잡는다.
    await first.goto(`/inquiries/${inquiryId}`)
    await expect(first.getByLabel('답변 내용')).toBeEnabled()

    // 두 번째 운영자가 같은 문의를 연다.
    await second.goto(`/inquiries/${inquiryId}`)
    const lockBanner = second.getByTestId('inquiry-edit-lock')

    await expect(lockBanner).toBeVisible()
    await expect(lockBanner).toContainText('답변을 작성하고 있습니다')
    await expect(second.getByLabel('답변 내용')).toBeDisabled()
    await second.screenshot({ path: shot('04-second-admin-lock-banner.png'), fullPage: true })

    // 목록에도 "작성 중"이 보인다.
    await second.goto(`/inquiries?status=open&q=%23${inquiryNo}`)
    await expect(second.getByTestId('inquiry-editing')).toBeVisible()
    await second.screenshot({ path: shot('05-list-editing-indicator.png'), fullPage: true })

    // 가로채고 초안을 쓴다.
    await second.goto(`/inquiries/${inquiryId}`)
    await second.getByRole('button', { name: '그래도 이어서 작성' }).click()
    await expect(second.getByLabel('답변 내용')).toBeEnabled()
    await second.getByLabel('답변 내용').fill(DRAFT)

    // 그사이 첫 운영자가 먼저 답변을 등록한다.
    await first.getByLabel('답변 내용').fill('첫 운영자의 답변입니다.')
    await first.getByRole('button', { name: '답변 등록' }).click()
    await expect(first.getByText('답변을 등록하고 상태를')).toBeVisible()

    // 두 번째 운영자가 저장 → 충돌. 초안은 그대로 남아야 한다.
    await second.getByRole('button', { name: '답변 등록' }).click()
    await expect(second.getByText(CONFLICT_MESSAGE)).toBeVisible()
    await expect(second.getByLabel('답변 내용')).toHaveValue(DRAFT)
    await second.screenshot({ path: shot('06-conflict-message.png'), fullPage: true })

    // 실제로 답변은 한 건만 남았다.
    const { count } = await service
      .from('inquiry_replies')
      .select('id', { count: 'exact', head: true })
      .eq('inquiry_id', inquiryId)

    expect(count).toBe(1)
  } finally {
    await firstContext.close()
    await secondContext.close()
  }
})

test('내부 메모는 운영자 화면에만 남는다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto(`/inquiries/${inquiryId}`)

  await page.getByLabel('메모 내용').fill(NOTE_BODY)
  await page.getByRole('button', { name: '메모 남기기' }).click()

  await expect(page.getByTestId('inquiry-notes')).toContainText(NOTE_BODY)
  await page.screenshot({ path: shot('07-internal-notes.png'), fullPage: true })

  // 사용자 사이트는 이 테이블을 읽지 않는다 — 저장 위치 자체가 관리자 전용이다.
  const { data } = await service
    .from('inquiry_notes')
    .select('body')
    .eq('inquiry_id', inquiryId)
    .single()

  expect(data?.body).toBe(NOTE_BODY)

  // 남긴 사람이 지울 수 있다(확인 창 한 단계).
  await page.getByRole('button', { name: '삭제' }).first().click()
  await page.getByRole('button', { name: '삭제', exact: true }).last().click()
  await expect(page.getByText('아직 남긴 메모가 없습니다.')).toBeVisible()
})
