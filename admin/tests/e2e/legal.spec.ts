import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import {
  CLIENT_URL,
  createServiceClient,
  screenshotPath,
  signInAsAdmin,
} from './inquiry-faq-helpers'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

/**
 * 약관 모듈 인수 검증 — 관리자 편집 → 미리보기 → 발행 → **사용자 사이트 노출**.
 *
 * 이 모듈의 존재 이유가 "관리자에서 고친 문안이 독자에게 그대로 보이는가" 하나라서,
 * 화면 단언만으로는 부족하다. 마지막에 사용자 사이트 HTML 을 직접 읽어 새 문단과
 * 새 버전 알약이 나오는지 확인한다.
 *
 * **운영 데이터를 남기지 않는다.** 테스트가 만든 개정본은 끝에서 서비스 롤로 지우고
 * 캐시를 다시 태워, 시드 발행본(20260918)이 현재 시행본으로 돌아온 것까지 확인한다.
 */

const E2E_VERSION = '20260930'
const E2E_PARAGRAPH = '[E2E] 문단'
const SEED_VERSION = '20260918'

/** 오늘(한국 시간). 발행하려면 시행일이 오늘 이하여야 한다. */
function today(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

let service: SupabaseClient
/** 손대지 않은 문서. 이 테스트가 다른 약관까지 흔들지 않았음을 마지막에 확인한다. */
let operatingHtmlBefore = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  service = createServiceClient()
  /* 이전 실행이 남긴 행을 먼저 지운다. 남아 있으면 유니크 제약에 걸려 저장이 실패한다.
     지운 뒤 캐시까지 태워야 "아직 발행 전" 단언이 옛 캐시를 보고 실패하지 않는다. */
  await service.from('legal_document_versions').delete().eq('version', E2E_VERSION)
  await revalidateClientLegal()

  operatingHtmlBefore = await fetchClient('/policy/operating')
})

test.afterAll(async () => {
  await service.from('legal_document_versions').delete().eq('version', E2E_VERSION)
  await revalidateClientLegal()
})

/**
 * 사용자 사이트 응답을 **Node 의 fetch** 로 읽는다.
 *
 * Playwright 의 `request` 픽스처를 쓰지 않는 이유: 이 페이지는
 * `Cache-Control: no-cache, must-revalidate` 로 나가는데, 그 컨텍스트는 조건부 요청
 * 뒤 자기 사본을 그대로 돌려준다. 재검증이 끝나 서버는 새 문안을 내주는데도
 * 테스트만 옛 문안을 보게 되어, 통과해야 할 단언이 조용히 실패한다.
 */
async function fetchClient(path: string): Promise<string> {
  const response = await fetch(`${CLIENT_URL}${path}`, { cache: 'no-store' })

  if (!response.ok) {
    return ''
  }

  return response.text()
}

/**
 * 사용자 사이트 캐시를 직접 태운다.
 *
 * 정리 단계는 관리자 화면을 거치지 않고 DB 를 직접 지우므로, 관리자 서버 액션이
 * 부르는 무효화가 일어나지 않는다. 같은 계약(`POST /api/revalidate`)을 그대로 쓴다.
 */
async function revalidateClientLegal(): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET ?? readSecretFromEnvFile()

  if (secret === '') {
    return
  }

  await fetch(`${CLIENT_URL}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags: ['legal'] }),
  })
}

function readSecretFromEnvFile(): string {
  const match = /^\s*REVALIDATE_SECRET\s*=\s*(.*)\s*$/mu.exec(
    readFileSync(`${process.cwd()}/.env.local`, 'utf8'),
  )

  return (match?.[1] ?? '').replace(/^["']|["']$/gu, '')
}

/** 사용자 사이트가 기대한 문자열을 보여 줄 때까지 기다린다(재검증 지연 흡수). */
async function expectClientPolicy(needle: string, shouldContain: boolean): Promise<void> {
  await expect
    .poll<boolean | string>(
      async () => {
        const html = await fetchClient('/policy/privacy')

        /* 응답 실패를 "없다"로 읽지 않는다 — 서버가 죽은 것과 문안이 바뀐 것은
           다른 사건이고, 전자를 성공으로 넘기면 이 단언이 의미를 잃는다. */
        return html === '' ? 'unreachable' : html.includes(needle)
      },
      { timeout: 60_000, intervals: [500, 1000, 2000, 3000] },
    )
    .toBe(shouldContain)
}

/** 편집기 첫 문단 뒤에 새 문단을 끼워 넣는다. */
async function appendParagraph(page: Page, text: string): Promise<void> {
  const editor = page.getByRole('textbox', { name: '본문' })

  await editor.locator('p').first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(text)
  await expect(editor).toContainText(text)
}

test('약관 목록이 세 문서의 현재 발행 버전을 보여 준다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/legal')

  await expect(page.getByRole('heading', { name: 'Legal', exact: true })).toBeVisible()

  for (const label of ['개인정보처리방침', '디스코드 운영정책', '글자월드 운영정책']) {
    await expect(page.getByRole('heading', { name: label })).toBeVisible()
  }

  await expect(page.getByText(SEED_VERSION).first()).toBeVisible()
  await page.screenshot({ path: screenshotPath('admin-legal.png'), fullPage: true })
})

test('개인정보처리방침 편집 화면이 발행본과 이력을 함께 보여 준다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/legal/privacy')

  await expect(page.getByRole('heading', { name: '개인정보처리방침 편집' })).toBeVisible()
  /* 발행본은 잠긴다 — 문안을 덮어쓰지 않고 새 버전을 쌓는 규칙이 화면에도 보여야 한다. */
  await expect(page.getByText('이미 발행한 개정본입니다.')).toBeVisible()
  await expect(page.getByTestId('legal-preview')).toContainText('1. 총칙')
  await expect(page.getByTestId('legal-preview')).toContainText('시행일 2026년 9월 18일')
  await expect(page.getByRole('heading', { name: '버전 이력' })).toBeVisible()

  await page.screenshot({ path: screenshotPath('admin-legal-edit.png'), fullPage: true })
})

test('새 초안을 만들어 미리보기로 확인하고 발행하면 사용자 사이트에 나온다', async ({ page }) => {
  /* 편집 → 발행 → **사용자 사이트 재검증**까지 한 흐름이다. 기본 30초로는 마지막
     폴링을 다 돌리지 못한다(`revalidateTag(…, 'max')` 는 첫 요청에 옛 값을 한 번 더
     내줄 수 있다). */
  test.setTimeout(180_000)

  await signInAsAdmin(page)
  await page.goto('/legal/privacy')

  // 현재 발행본을 복사해 새 초안으로 연다.
  await page.getByRole('link', { name: '새 초안 만들기' }).first().click()
  /* Link 이동은 클라이언트 전환이라 즉시 끝나지 않는다. URL 과 잠금 해제를 함께
     기다려야 아래 입력이 **이전 화면**(발행본, 잠긴 폼)에 떨어지지 않는다. */
  await page.waitForURL(/from=/u)
  await expect(page.getByText('이미 발행한 개정본입니다.')).toBeHidden()
  await expect(page.getByRole('textbox', { name: '본문' })).toContainText('1. 총칙')

  /* 라우트 전환 후에도 폼이 새 초안 기본값으로 다시 마운트됐는지 본다(폼 key). */
  await expect(page.getByRole('radio', { name: /임시저장/u })).toBeChecked()

  await appendParagraph(page, E2E_PARAGRAPH)
  await page.getByRole('textbox', { name: '버전' }).fill(E2E_VERSION)
  await page.getByRole('textbox', { name: '시행일' }).fill(today())
  await page.getByRole('radio', { name: /임시저장/u }).check()
  await page.getByRole('button', { name: '저장' }).click()
  await page.waitForURL(/saved=1/u)

  // 임시저장 상태의 미리보기에 새 문단이 보인다.
  await expect(page.getByTestId('legal-preview')).toContainText(E2E_PARAGRAPH)
  await expect(page.getByTestId('legal-preview')).toContainText(`버전 ${E2E_VERSION}`)

  // 아직 발행 전이므로 사용자 사이트는 시드 발행본 그대로다.
  await expectClientPolicy(E2E_PARAGRAPH, false)

  await page.getByRole('radio', { name: /^발행/u }).check()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText(`현재 시행 ${E2E_VERSION}`)).toBeVisible({ timeout: 15_000 })

  await expectClientPolicy(E2E_PARAGRAPH, true)
  /* 알약 문구는 HTML 에서 `버전 <!-- -->20260930` 으로 쪼개져 나온다(React 텍스트
     노드 경계). 원문 문자열로 찾으면 영원히 실패하므로 버전 번호만 본다. */
  await expectClientPolicy(E2E_VERSION, true)

  await page.goto(`${CLIENT_URL}/policy/privacy`, { waitUntil: 'networkidle' })
  await expect(page.getByText(E2E_PARAGRAPH)).toBeVisible()
  await expect(page.getByRole('link', { name: `버전 ${E2E_VERSION}` })).toBeVisible()
  await page.screenshot({ path: screenshotPath('client-policy-db.png'), fullPage: true })
})

test('버전 이력에서 두 개정본을 비교하면 추가된 문단만 잡힌다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/legal/privacy')

  const seedRow = page.getByRole('row', { name: new RegExp(SEED_VERSION, 'u') })

  await seedRow.getByRole('link', { name: /비교/u }).click()

  const diff = page.getByRole('heading', { name: `${SEED_VERSION} → ${E2E_VERSION} 비교` })

  await expect(diff).toBeVisible()
  /* 추가된 문단 한 줄이 `+` 표시와 함께 잡힌다. 줄 수를 못 박지 않는 이유: 에디터가
     돌려주는 표 마크업이 시드본과 미세하게 달라 개정과 무관한 줄이 함께 셀 수 있다. */
  await expect(page.getByText(/추가 \d+줄 · 삭제 \d+줄/u)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: E2E_PARAGRAPH })).toBeVisible()
})

test('E2E 개정본을 지우면 시드 발행본으로 되돌아가고 운영정책은 그대로다', async () => {
  test.setTimeout(180_000)

  await service.from('legal_document_versions').delete().eq('version', E2E_VERSION)
  await revalidateClientLegal()

  await expectClientPolicy(E2E_PARAGRAPH, false)
  await expectClientPolicy(SEED_VERSION, true)

  const operatingHtmlAfter = await fetchClient('/policy/operating')

  /* 본문 카드 안의 첫 장과 부칙이 그대로인지 본다. 응답 전체를 비교하면 Next 의
     빌드 id·스크립트 해시 차이 때문에 무엇이 바뀌었는지 알 수 없는 실패가 난다. */
  /* 텍스트 노드 경계 때문에 "시행일 2026년 9월 18일" 은 HTML 에서 쪼개진다.
     날짜만 본다. */
  for (const marker of ['1. 기본 원칙', '부칙', '2026년 9월 18일']) {
    expect(operatingHtmlBefore).toContain(marker)
    expect(operatingHtmlAfter).toContain(marker)
  }
})
