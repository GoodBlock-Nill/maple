import { expect, test, type APIRequestContext } from '@playwright/test'

import {
  CLIENT_SITE_URL,
  createScenario,
  REVALIDATE_SECRET,
  destroyScenario,
  serviceClient,
  signInAsAdmin,
  type Scenario,
} from './members-fixtures'

/**
 * 관리자 쓰기 → 사용자 사이트 즉시 반영.
 *
 * 사용자 사이트의 공개 목록은 `unstable_cache`(커뮤니티·뉴스 60초, FAQ 300초)로
 * 감싸여 있고 관리자 앱은 다른 프로세스라 `revalidateTag()` 가 닿지 않는다. 그래서
 * 관리자 액션이 `revalidateClient()` 로 사용자 사이트의 `POST /api/revalidate` 를
 * 두드린다(`lib/revalidate.ts`).
 *
 * **몇 번째 요청에 반영되는가.** 사용자 사이트는 `revalidateTag(tag, 'max')` 를 쓴다
 * — stale-while-revalidate 라 무효화 직후 **첫 요청은 옛 값을 한 번 더 받고** 그
 * 요청이 갱신을 띄운다(Next 문서 `revalidateTag` "Revalidation Behavior"). 그래서
 * "몇 밀리초 안에"가 아니라 "몇 번째 요청 안에"로 판정한다. 실측 2회·0.3초다.
 *
 * 검색어(`?q=`)로는 검증하지 않는다. 그 경로는 애초에 캐시를 타지 않고(매 요청 조회),
 * 대신 Supabase 요청 URL 단위의 fetch 캐시에 걸려 태그와 무관하게 움직인다.
 */

/** 무효화 후 최신 값이 나와야 하는 요청 수. 1회는 SWR 때문에 옛 값이 정상이다. */
const MAX_REQUESTS = 4

let scenario: Scenario

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  scenario = await createScenario()
})

test.afterAll(async () => {
  await destroyScenario(scenario)
  await serviceClient().from('faqs').delete().like('question', '[E2E-revalidate]%')
})

/**
 * `pathname` 을 최대 `MAX_REQUESTS` 번 불러 `expected` 상태가 되는 순간을 잡는다.
 * 캐시가 비워지지 않았으면 끝까지 옛 값이 나오므로 실패한다.
 */
async function waitForClient(
  request: APIRequestContext,
  pathname: string,
  text: string,
  expected: 'visible' | 'gone',
): Promise<{ requests: number; ms: number }> {
  const startedAt = Date.now()

  for (let attempt = 1; attempt <= MAX_REQUESTS; attempt += 1) {
    const separator = pathname.includes('?') ? '&' : '?'
    // 라우트 캐시만 우회한다. 그 아래 데이터 캐시가 이번 검증의 대상이다.
    const response = await request.get(`${CLIENT_SITE_URL}${pathname}${separator}cb=${Date.now()}`)

    expect(response.ok(), `${pathname} 이 200 이 아닙니다(${response.status()})`).toBe(true)

    const html = await response.text()

    if (html.includes(text) === (expected === 'visible')) {
      return { requests: attempt, ms: Date.now() - startedAt }
    }
  }

  throw new Error(
    `${pathname} 이 ${MAX_REQUESTS}번의 요청 안에 "${text}" 를 ${expected === 'gone' ? '지우지' : '보여주지'} 못했습니다. 관리자 쓰기 뒤 캐시 무효화가 닿지 않았습니다.`,
  )
}

/** 준비 데이터는 관리자 액션을 거치지 않았다. 검증 시작 상태를 캐시에 반영해 둔다. */
async function primeClientCache(request: APIRequestContext, tag: string): Promise<void> {
  const response = await request.post(`${CLIENT_SITE_URL}/api/revalidate`, {
    headers: { 'x-revalidate-secret': REVALIDATE_SECRET },
    data: { tags: [tag] },
  })

  expect(response.status(), '무효화 엔드포인트 준비 호출 실패').toBe(200)
}

test('커뮤니티 글을 숨기면 사용자 목록에서 곧바로 사라진다', async ({ page, request }) => {
  test.setTimeout(120_000)

  const service = serviceClient()

  /* 목록 캐시에 이 글이 들어간 상태에서 시작해야 "사라짐"이 의미를 갖는다.
     방금 만든 글이므로 무효화 한 번으로 캐시에 올라온다. */
  await service.from('posts').update({ is_published: true }).eq('id', scenario.postId)
  await primeClientCache(request, 'community-list')
  await waitForClient(request, '/community', scenario.postTitle, 'visible')

  await signInAsAdmin(page)
  await page.goto(`/community/posts?author=${encodeURIComponent(scenario.authorNickname)}`)

  const row = page.getByRole('row', { name: new RegExp(scenario.suffix) })
  await row.getByRole('button', { name: '숨김', exact: true }).click()
  await expect(page.getByText(/게시글을 숨김 처리했습니다/)).toBeVisible()

  const hidden = await waitForClient(request, '/community', scenario.postTitle, 'gone')
  console.log(`[revalidate] 숨김 반영: 요청 ${hidden.requests}회 · ${hidden.ms}ms`)

  await row.getByRole('button', { name: '숨김 해제', exact: true }).click()
  await expect(page.getByText(/숨김 해제했습니다/)).toBeVisible()

  const restored = await waitForClient(request, '/community', scenario.postTitle, 'visible')
  console.log(`[revalidate] 해제 반영: 요청 ${restored.requests}회 · ${restored.ms}ms`)
})

test('FAQ 발행 토글이 사용자 사이트에 곧바로 반영된다', async ({ page, request }) => {
  test.setTimeout(120_000)

  const question = `[E2E-revalidate] 질문 ${scenario.suffix}`
  const service = serviceClient()
  const { error } = await service
    .from('faqs')
    .insert({ category: 'etc', question, answer: '무효화 검증용 답변', is_published: true })

  expect(error, 'FAQ 준비 실패').toBeNull()

  await signInAsAdmin(page)
  await page.goto('/faqs')

  const row = page.locator('li').filter({ hasText: question })

  await primeClientCache(request, 'faqs')
  await waitForClient(request, '/support/faq', question, 'visible')

  await row.getByRole('button', { name: '숨기기' }).click()
  await expect(row.getByText('미발행', { exact: true })).toBeVisible()

  const hidden = await waitForClient(request, '/support/faq', question, 'gone')
  console.log(`[revalidate] FAQ 숨김 반영: 요청 ${hidden.requests}회 · ${hidden.ms}ms`)

  await row.getByRole('button', { name: '발행', exact: true }).click()
  await expect(row.getByText('발행', { exact: true })).toBeVisible()

  const published = await waitForClient(request, '/support/faq', question, 'visible')
  console.log(`[revalidate] FAQ 발행 반영: 요청 ${published.requests}회 · ${published.ms}ms`)
})
