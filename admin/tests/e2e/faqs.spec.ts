import { expect, test } from '@playwright/test'

import {
  CLIENT_URL,
  createAnonClient,
  createServiceClient,
  screenshotPath,
  signInAsAdmin,
} from './inquiry-faq-helpers'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * FAQ 인수 검증 — 등록 → 사용자 사이트 노출 → 숨김 → 삭제.
 *
 * 사용자 사이트의 FAQ 목록은 `unstable_cache`(태그 'faqs', 300초)로 감싸여 있다.
 * 관리자 앱은 **다른 프로세스**라 `revalidateTag()` 가 닿지 않으므로, 저장 뒤
 * `revalidateClient()` 가 사용자 사이트의 `POST /api/revalidate` 를 부른다
 * (`lib/revalidate.ts`). 캐시와 무관한 사실(발행/숨김이 공개 권한에서 열리고
 * 닫히는가)은 익명 키로 즉시 확인한다.
 */
/* 무효화가 붙기 전 실측은 258초(TTL 대기)였고, 지금은 요청 2~4회·1초 안쪽이다
   (`client-revalidate.spec.ts`). 그래도 폴링을 남기는 이유는 `revalidateTag(tag,
   'max')` 가 stale-while-revalidate 라서 **무효화 직후 첫 요청은 옛 값**이기
   때문이다. 무효화가 끊기면 TTL 만큼 늦어지므로 예산은 TTL 한 번으로 줄인다. */
const CLIENT_FAQ_CACHE_BUDGET_MS = 6 * 60 * 1000

const STAMP = Date.now().toString()
const FAQ_QUESTION = `[E2E] 질문 ${STAMP}`
const FAQ_ANSWER = 'E2E 로 등록한 답변입니다.'
/* 발행하지 않은 항목. 사용자 사이트에 절대 나타나면 안 된다. 문구에 '미발행' 을
   넣지 않는다 — 상태 뱃지와 같은 글자라 선택자가 두 요소에 걸린다. */
const HIDDEN_QUESTION = `[E2E] 비공개 질문 ${STAMP}`
const ORDER_FIRST = `[E2E] 정렬 A ${STAMP}`
const ORDER_SECOND = `[E2E] 정렬 B ${STAMP}`

let service: SupabaseClient
let anon: SupabaseClient
let faqId = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  service = createServiceClient()
  anon = createAnonClient()
})

test.afterAll(async () => {
  await service.from('faqs').delete().like('question', '[E2E]%')
})

/**
 * 방금 등록한 항목이 보일 때까지 기다렸다가 **그 응답의 HTML** 을 돌려준다.
 *
 * 노출/미노출을 한 번의 렌더로 함께 판정하려는 것이다. 숨김을 따로 기다리면 캐시
 * TTL 을 두 번(최대 10분+) 기다려야 하고, 그 사이 개발 서버가 재컴파일에 들어가면
 * 검증이 아니라 인내심 시험이 된다.
 */
async function waitForClientFaqHtml(
  request: APIRequestContext,
  visibleText: string,
): Promise<string> {
  let html = ''

  await expect
    .poll(
      async () => {
        const response = await request.get(`${CLIENT_URL}/support/faq`)

        /* 200 이 아닌 응답은 판정에 쓰지 않는다. 오류 페이지를 "없음"으로 세면
           미발행 검증이 거짓으로 통과한다. */
        if (!response.ok()) {
          return false
        }

        html = await response.text()

        return html.includes(visibleText)
      },
      {
        timeout: CLIENT_FAQ_CACHE_BUDGET_MS,
        intervals: [1_000, 3_000, 10_000, 15_000],
        message: `사용자 사이트 ${CLIENT_URL}/support/faq 가 "${visibleText}" 를 보여 주지 않았습니다(FAQ 캐시 TTL 300초).`,
      },
    )
    .toBe(true)

  return html
}

/** 다이얼로그로 FAQ 한 건을 등록한다(카테고리는 '기타' 고정). */
async function createFaq(
  page: Page,
  values: { question: string; answer: string; publish: boolean },
): Promise<void> {
  await page.getByRole('button', { name: 'FAQ 등록' }).click()

  /* 다이얼로그 안으로 범위를 좁힌다 — 목록 행의 ▲▼ 버튼 aria-label 에도 질문 문구가
     들어가 있어서 화면 전체에서 라벨로 찾으면 여러 요소가 걸린다. */
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('카테고리').selectOption('etc')
  await dialog.getByLabel('질문').fill(values.question)
  await dialog.getByLabel('답변').fill(values.answer)

  if (!values.publish) {
    await dialog.getByLabel('사용자 사이트에 발행').uncheck()
  }

  await dialog.getByRole('button', { name: '등록', exact: true }).click()
  await expect(page.locator('li').filter({ hasText: values.question })).toBeVisible()
}

test('FAQ 를 등록하면 사용자 사이트에 보이고, 미발행은 보이지 않으며, 삭제된다', async ({
  page,
  request,
}) => {
  // 무효화가 끊겼을 때를 대비해 FAQ 캐시(300초) 한 번을 기다릴 여유는 남긴다.
  test.setTimeout(CLIENT_FAQ_CACHE_BUDGET_MS + 120_000)

  await signInAsAdmin(page)
  await page.goto('/faqs')

  await createFaq(page, { question: FAQ_QUESTION, answer: FAQ_ANSWER, publish: true })
  await createFaq(page, { question: HIDDEN_QUESTION, answer: '보이면 안 됩니다.', publish: false })

  const row = page.locator('li').filter({ hasText: FAQ_QUESTION })
  await expect(row.getByText('발행', { exact: true })).toBeVisible()
  await expect(
    page.locator('li').filter({ hasText: HIDDEN_QUESTION }).getByText('미발행', { exact: true }),
  ).toBeVisible()

  await page.screenshot({ path: screenshotPath('admin-faqs.png'), fullPage: true })

  const created = await service
    .from('faqs')
    .select('id, category, is_published, answer')
    .eq('question', FAQ_QUESTION)
    .single()

  faqId = created.data?.id ?? ''
  expect(faqId, 'FAQ 가 저장되지 않았습니다').toBeTruthy()
  expect(created.data?.category).toBe('etc')
  expect(created.data?.is_published).toBe(true)
  // 사용자 사이트가 그대로 그리는 평문이어야 한다(마크다운·HTML 변환 없음).
  expect(created.data?.answer).toBe(FAQ_ANSWER)

  // 공개 권한(익명 키)에는 발행분만 열린다 — 미발행은 RLS(faqs_select_published)가 막는다.
  const openToPublic = await anon.from('faqs').select('id').eq('id', faqId).eq('is_published', true)
  expect(openToPublic.data).toHaveLength(1)

  const hiddenToPublic = await anon.from('faqs').select('id').eq('question', HIDDEN_QUESTION)
  expect(hiddenToPublic.data).toHaveLength(0)

  /* 실제 페이지: 발행분이 보이는 그 렌더에 미발행분은 없어야 한다. 같은 응답으로
     둘을 함께 보면 캐시 TTL 을 한 번만 기다리고도 양쪽을 모두 증명할 수 있다. */
  const html = await waitForClientFaqHtml(request, FAQ_QUESTION)
  expect(html).toContain(FAQ_ANSWER)
  expect(html).not.toContain(HIDDEN_QUESTION)

  // 발행분을 숨기면 공개 권한에서 곧바로 닫힌다(화면 반영은 캐시 TTL 만큼 늦다).
  await row.getByRole('button', { name: '숨기기' }).click()
  await expect(row.getByText('미발행', { exact: true })).toBeVisible()

  const closedToPublic = await anon.from('faqs').select('id').eq('id', faqId)
  expect(closedToPublic.data).toHaveLength(0)

  await row.getByRole('button', { name: '삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()

  await expect(page.locator('li').filter({ hasText: FAQ_QUESTION })).toHaveCount(0)

  const remaining = await service.from('faqs').select('id').eq('id', faqId)
  expect(remaining.data).toHaveLength(0)
})

test('▲▼ 로 옮긴 순서를 저장하면 sort_order 가 화면 순서대로 다시 매겨진다', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/faqs')

  await createFaq(page, { question: ORDER_FIRST, answer: '첫 번째', publish: true })
  await createFaq(page, { question: ORDER_SECOND, answer: '두 번째', publish: true })

  // 두 건은 '기타' 맨 뒤에 차례로 붙는다. 뒤엣것을 한 칸 올린다.
  await page.getByRole('button', { name: `${ORDER_SECOND} 위로` }).click()
  await page.getByRole('button', { name: '순서 저장' }).last().click()

  await expect(page.getByText('순서를 저장했습니다.')).toBeVisible()

  const ordered = await service
    .from('faqs')
    .select('question, sort_order')
    .eq('category', 'etc')
    .order('sort_order', { ascending: true })

  const questions = (ordered.data ?? []).map((row) => row.question)
  const orders = (ordered.data ?? []).map((row) => row.sort_order)

  expect(questions.indexOf(ORDER_SECOND)).toBeLessThan(questions.indexOf(ORDER_FIRST))
  // 저장은 카테고리 전체를 0..n-1 로 다시 매긴다(중복·구멍 정리).
  expect(orders).toEqual(orders.map((_, index) => index))
})
