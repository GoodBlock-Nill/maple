import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import {
  CLIENT_URL,
  createServiceClient,
  screenshotPath,
  signInAsAdmin,
} from './inquiry-faq-helpers'
import { makeTestVideo } from './video-fixture'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 1:1 문의 인수 검증.
 *
 * 픽스처(일회용 사용자 · 첨부 · 문의 2건)는 서비스 롤로 만들고 끝나면 지운다.
 * 접수 → 답변 → 사용자 화면 반영이 한 줄기라 serial 로 묶는다.
 */
const STAMP = Date.now().toString()
const FIXTURE_EMAIL = `e2e-support-${STAMP}@example.com`
const INQUIRY_TITLE = `[E2E] 문의 ${STAMP}`
const CANCELLED_TITLE = `[E2E] 취소 문의 ${STAMP}`
const REPLY_TEXT = 'E2E 답변'

/* 사용자 화면(components/support/InquiryReplyThread)은 답변을 whitespace-pre-line 으로
   그린다. 줄바꿈이 실제로 살아남는지 보려고 두 줄짜리 답변을 쓴다. */
const REPLY_BODY = `${REPLY_TEXT}\n둘째 줄.`

/** 1x1 투명 PNG. 버킷이 허용하는 형식(png · jpeg · gif · pdf)의 대표로 쓴다. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const ATTACHMENT_BUCKET = 'inquiry-attachments'

/** 영상 픽스처를 만들 자리. 저장소에 바이너리를 넣지 않는다. */
const VIDEO_FIXTURE_DIR =
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/inquiry-video'

let service: SupabaseClient
let fixtureUserId = ''
let inquiryId = ''
let cancelledInquiryId = ''
let attachmentPaths: readonly string[] = []
/** 빈 문자열이면 ffmpeg 이 없어 영상 픽스처를 만들지 못한 것이다(그 검증만 건너뛴다). */
let videoName = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  service = createServiceClient()

  const created = await service.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: `${STAMP}-e2e-support-pw`,
    email_confirm: true,
    user_metadata: { nickname: `E2E고객${STAMP.slice(-6)}` },
  })

  fixtureUserId = created.data.user?.id ?? ''
  expect(fixtureUserId, '일회용 사용자를 만들지 못했습니다').toBeTruthy()

  /* 첨부 픽스처. 이미지와 PDF 를 함께 올려 관리자 상세가 두 갈래(썸네일 · 내려받기
     링크)를 모두 그리는지, 서명 URL 이 관리자 권한으로 발급되는지 확인한다. */
  const imagePath = `${fixtureUserId}/${STAMP}-e2e-shot.png`
  const pdfPath = `${fixtureUserId}/${STAMP}-e2e-doc.pdf`
  const imageBytes = Buffer.from(PNG_BASE64, 'base64')
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n', 'utf8')

  const uploadedImage = await service.storage
    .from(ATTACHMENT_BUCKET)
    .upload(imagePath, imageBytes, { contentType: 'image/png', upsert: true })
  const uploadedPdf = await service.storage
    .from(ATTACHMENT_BUCKET)
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  expect(uploadedImage.error, '이미지 첨부를 올리지 못했습니다').toBeNull()
  expect(uploadedPdf.error, 'PDF 첨부를 올리지 못했습니다').toBeNull()
  attachmentPaths = [imagePath, pdfPath]

  /* 영상 첨부. 관리자 상세는 링크가 아니라 재생기를 세워야 한다 — 새 탭으로 열면
     서명 URL 이 주소창과 방문 기록에 남고, 5분 뒤에는 돌아올 수도 없다. */
  const videoAttachments: Record<string, unknown>[] = []
  const videoSource = makeTestVideo(`${VIDEO_FIXTURE_DIR}/admin-inquiry-e2e.mp4`)

  if (videoSource !== null) {
    const videoPath = `${fixtureUserId}/${STAMP}-e2e-clip.mp4`
    const videoBytes = readFileSync(videoSource)
    const uploadedVideo = await service.storage
      .from(ATTACHMENT_BUCKET)
      .upload(videoPath, videoBytes, { contentType: 'video/mp4', upsert: true })

    expect(uploadedVideo.error, '영상 첨부를 올리지 못했습니다').toBeNull()
    videoName = 'e2e-clip.mp4'
    attachmentPaths = [...attachmentPaths, videoPath]
    videoAttachments.push({
      name: videoName,
      path: videoPath,
      size: videoBytes.length,
      mimeType: 'video/mp4',
    })
  }

  const inquiry = await service
    .from('inquiries')
    .insert({
      user_id: fixtureUserId,
      account_id: '123456789012345',
      category: '계정',
      type: '문의',
      title: INQUIRY_TITLE,
      content: 'E2E 본문입니다.\n둘째 줄.',
      attachments: [
        { name: 'e2e-shot.png', path: imagePath, size: imageBytes.length, mimeType: 'image/png' },
        { name: 'e2e-doc.pdf', path: pdfPath, size: pdfBytes.length, mimeType: 'application/pdf' },
        ...videoAttachments,
      ],
      privacy_consent: true,
      status: 'pending',
    })
    .select('id')
    .single()

  inquiryId = inquiry.data?.id ?? ''
  expect(inquiryId, '픽스처 문의를 만들지 못했습니다').toBeTruthy()

  /* 사용자가 스스로 접수를 취소한 문의(20260908001900: status='closed' + cancelled_at).
     관리자 화면이 이 상태를 '접수 취소'로 구분하고 읽기 전용으로 잠그는지 확인한다. */
  const cancelled = await service
    .from('inquiries')
    .insert({
      user_id: fixtureUserId,
      account_id: '123456789012345',
      category: '기타',
      type: '문의',
      title: CANCELLED_TITLE,
      content: '취소된 접수입니다.',
      privacy_consent: true,
      status: 'closed',
      cancelled_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  cancelledInquiryId = cancelled.data?.id ?? ''
  expect(cancelledInquiryId, '취소 픽스처를 만들지 못했습니다').toBeTruthy()
})

test.afterAll(async () => {
  // 답변은 inquiries 삭제에 cascade 로 함께 지워진다.
  for (const id of [inquiryId, cancelledInquiryId]) {
    if (id !== '') {
      await service.from('inquiries').delete().eq('id', id)
    }
  }

  if (attachmentPaths.length > 0) {
    await service.storage.from(ATTACHMENT_BUCKET).remove([...attachmentPaths])
  }

  if (fixtureUserId !== '') {
    await service.auth.admin.deleteUser(fixtureUserId)
  }
})

test('문의 목록이 새 문의를 접수 대기로 보여 준다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto(`/inquiries?status=pending&q=${STAMP}`)

  const row = page.getByRole('row').filter({ hasText: INQUIRY_TITLE })
  await expect(row).toBeVisible()
  await expect(row.getByText('접수 대기')).toBeVisible()
  // 계정 ID 는 원문이 아니라 사용자 사이트와 같은 규칙으로 마스킹된 값이어야 한다.
  await expect(row.getByText('1234****345')).toBeVisible()
  await expect(page.getByRole('link', { name: '미처리' })).toBeVisible()

  await page.screenshot({ path: screenshotPath('admin-inquiries.png'), fullPage: true })
})

test('답변을 등록하면 상태가 답변 완료가 되고 사용자 화면에 보인다', async ({ page, context }) => {
  await signInAsAdmin(page)
  await page.goto(`/inquiries/${inquiryId}`)

  await expect(page.getByRole('heading', { name: INQUIRY_TITLE })).toBeVisible()
  await expect(page.getByText('E2E 본문입니다.')).toBeVisible()

  /* 첨부: 이미지는 썸네일, 그 밖의 형식(PDF)은 내려받기 링크. 둘 다 비공개 버킷의
     서명 URL 이라야 열린다(관리자 세션으로 서명 → 정책이 다시 검사한다). */
  const thumbnail = page.getByRole('img', { name: 'e2e-shot.png' })
  await expect(thumbnail).toBeVisible()
  await expect(thumbnail).toHaveAttribute(
    'src',
    /\/storage\/v1\/object\/sign\/inquiry-attachments\//,
  )

  const pdfLink = page.getByRole('link', { name: /e2e-doc\.pdf/ })
  await expect(pdfLink).toHaveAttribute('href', /object\/sign\/inquiry-attachments\/.*download=/)

  /* 영상은 그 자리에서 재생한다. preload="metadata" 라 상세를 여는 것만으로
     100MB 를 내려받지 않는다. */
  if (videoName !== '') {
    const player = page.getByLabel(videoName)

    await expect(player).toBeVisible()
    await expect(player).toHaveAttribute(
      'src',
      /\/storage\/v1\/object\/sign\/inquiry-attachments\//,
    )
    await expect(player).toHaveAttribute('preload', 'metadata')
  }

  // 썸네일을 누르면 원본을 다이얼로그로 본다(새 탭으로 열어 서명 URL 을 노출하지 않는다).
  await thumbnail.click()
  await expect(page.getByRole('dialog')).toContainText('e2e-shot.png')
  // 미리보기는 이미지가 패널을 가득 채우므로 닫기는 Escape 로 한다(백드롭은 패널 뒤에 있다).
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByLabel('답변 내용').fill(REPLY_BODY)
  await page.getByRole('button', { name: '답변 등록' }).click()

  await expect(page.getByTestId('inquiry-reply').filter({ hasText: REPLY_TEXT })).toBeVisible()
  await expect(page.getByTestId('inquiry-reply').getByText('운영자')).toBeVisible()
  await expect(page.getByTestId('inquiry-status')).toHaveText('답변 완료')

  await page.screenshot({ path: screenshotPath('admin-inquiry-detail.png'), fullPage: true })

  // 1) 데이터가 실제로 남았는가(서비스 롤 확인).
  const stored = await service
    .from('inquiries')
    .select('status, answered_at')
    .eq('id', inquiryId)
    .single()

  expect(stored.data?.status).toBe('answered')
  expect(stored.data?.answered_at).not.toBeNull()

  const replies = await service
    .from('inquiry_replies')
    .select('author_id, author_name, content')
    .eq('inquiry_id', inquiryId)

  expect(replies.data).toHaveLength(1)
  expect(replies.data?.[0]?.content).toBe(REPLY_BODY)
  expect(replies.data?.[0]?.author_name).toBe('운영자')
  expect(replies.data?.[0]?.author_id).not.toBeNull()

  // 2) 사용자가 자기 화면에서 실제로 보는가(매직링크로 그 사용자 세션을 만든다).
  const link = await service.auth.admin.generateLink({ type: 'magiclink', email: FIXTURE_EMAIL })
  const tokenHash = link.data?.properties?.hashed_token

  expect(tokenHash, '사용자 세션용 매직링크를 만들지 못했습니다').toBeTruthy()

  const userPage = await context.browser()!.newPage()
  const next = encodeURIComponent(`/support/inquiries/${inquiryId}`)
  await userPage.goto(
    `${CLIENT_URL}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=${next}`,
  )

  await expect(userPage).toHaveURL(new RegExp(`/support/inquiries/${inquiryId}`))
  await expect(userPage.getByText(REPLY_TEXT).first()).toBeVisible()
  await expect(userPage.getByText('답변 완료').first()).toBeVisible()

  /* 사용자 화면의 답변 스레드가 기대하는 값이 그대로 채워져야 한다 — 작성자 이름과
     줄바꿈(whitespace-pre-line)이 살아 있는지 원문 텍스트로 확인한다. */
  const replyItemText =
    (await userPage.locator('li').filter({ hasText: REPLY_TEXT }).first().textContent()) ?? ''

  expect(replyItemText).toContain(REPLY_BODY)
  expect(replyItemText).toContain('운영자')
  await userPage.close()
})

test('사용자가 취소한 접수는 접수 취소로 표시되고 읽기 전용이다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/inquiries?status=cancelled')

  const row = page.getByRole('row').filter({ hasText: CANCELLED_TITLE })
  await expect(row).toBeVisible()
  await expect(row.getByText('접수 취소')).toBeVisible()

  await page.goto(`/inquiries/${cancelledInquiryId}`)

  await expect(page.getByTestId('inquiry-status')).toHaveText('접수 취소')
  await expect(page.getByText('사용자가 접수를 취소한 문의입니다.')).toBeVisible()
  // 답변 작성과 상태 변경 경로가 화면에서 사라져야 한다(액션도 같은 규칙으로 거절한다).
  await expect(page.getByRole('button', { name: '답변 등록' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '상태 변경' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '종료' })).toHaveCount(0)
})

/**
 * 오너 요청(2026-09-11): 접수 취소는 기본 목록에서 사라지고 '취소됨' 탭에서만 보인다.
 *
 * 취소는 항상 `status='closed'` 로 기록되므로, 그동안 '종료'·'전체' 탭에도 함께
 * 잡혔다. 사용자 목록에서 사라진 문의가 관리자의 기본 목록에는 남아 있으면 두
 * 화면의 뜻이 어긋난다.
 */
test('취소된 접수는 종료 · 전체 탭에서 빠지고 취소됨 탭에서만 보인다', async ({ page }) => {
  await signInAsAdmin(page)

  // Assert — 종료 탭에는 취소분이 없다(정상 종료와 섞이지 않는다).
  await page.goto(`/inquiries?status=closed&q=${STAMP}`)
  await expect(page.getByRole('row').filter({ hasText: CANCELLED_TITLE })).toHaveCount(0)

  // Assert — 전체 탭에도 없다.
  await page.goto(`/inquiries?status=all&q=${STAMP}`)
  await expect(page.getByRole('row').filter({ hasText: CANCELLED_TITLE })).toHaveCount(0)

  // Assert — 취소됨 탭에서만 보인다.
  await page.goto(`/inquiries?status=cancelled&q=${STAMP}`)
  await expect(page.getByRole('row').filter({ hasText: CANCELLED_TITLE })).toBeVisible()
})
