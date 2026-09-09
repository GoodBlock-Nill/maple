import path from 'node:path'

import { expect, test } from '@playwright/test'

import {
  createScenario,
  destroyScenario,
  fetchClient,
  SHOT_DIR,
  signInAsAdmin,
  userClient,
  type Scenario,
} from './members-fixtures'

/**
 * 커뮤니티 조치가 사용자 사이트에 그대로 반영되는지 확인한다.
 *
 * 관리자 화면의 뱃지는 컬럼을 그린 것일 뿐이다. 실제 검증은 사용자 사이트(:3000)의
 * 목록·상세 응답과, 작성자 본인 세션의 조회 결과로 한다 — 숨김은 작성자에게도
 * 적용돼야 조치가 의미를 갖는다(`posts_select_own` 에 `not is_hidden`).
 *
 * 목록을 볼 때마다 **검색어를 바꾼다.** 사용자 사이트의 `/community` 는 세그먼트에
 * `revalidate = 60` 이 걸려 있고, Next 가 감싼 fetch 는 Supabase 요청 URL 을 키로
 * 응답을 캐시한다. 같은 검색어로 두 번 부르면 조치 전 응답이 그대로 돌아온다.
 * 세 검색어 모두 접미사를 포함하므로 같은 글에만 매칭된다.
 */

let scenario: Scenario

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  scenario = await createScenario()
})

test.afterAll(async () => {
  await destroyScenario(scenario)
})

async function toggleHide(page: import('@playwright/test').Page, rowPattern: RegExp, name: string) {
  await page
    .getByRole('row', { name: rowPattern })
    .getByRole('button', { name, exact: true })
    .click()
}

test('hiding a post removes it from the user site list, detail and the author view', async ({
  page,
}) => {
  await signInAsAdmin(page)
  await page.goto(`/community/posts?author=${encodeURIComponent(scenario.authorNickname)}`)

  const row = page.getByRole('row', { name: new RegExp(scenario.suffix) })
  await expect(row).toBeVisible()
  await expect(row.getByText('정상')).toBeVisible()

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-community-posts.png'), fullPage: true })

  // 조치 전: 사용자 사이트에서 보인다.
  const before = await fetchClient(`/community?q=${encodeURIComponent(scenario.postTitle)}`)
  expect(before.html).toContain(scenario.postTitle)

  await toggleHide(page, new RegExp(scenario.suffix), '숨김')
  await expect(page.getByText(/게시글을 숨김 처리했습니다/)).toBeVisible()
  await expect(
    page.getByRole('row', { name: new RegExp(scenario.suffix) }).getByText('숨김', { exact: true }),
  ).toBeVisible()

  const hiddenList = await fetchClient(
    `/community?q=${encodeURIComponent(`신고대상 게시글 ${scenario.suffix}`)}`,
  )
  expect(hiddenList.html, '숨긴 글은 목록에서 사라져야 한다').not.toContain(scenario.postTitle)

  const hiddenDetail = await fetchClient(`/community/${scenario.postId}`)
  expect(hiddenDetail.status, '숨긴 글의 상세는 404 여야 한다').toBe(404)

  // 작성자 본인도 못 본다 — RLS 로 직접 확인한다(브라우저 로그인은 소셜 전용이다).
  const author = await userClient(scenario.authorEmail, scenario.authorPassword)
  const { data: ownView } = await author.from('posts').select('id').eq('id', scenario.postId)

  expect(ownView ?? [], '숨김은 작성자에게도 적용된다').toHaveLength(0)

  await toggleHide(page, new RegExp(scenario.suffix), '숨김 해제')
  await expect(page.getByText(/숨김 해제했습니다/)).toBeVisible()

  const restored = await fetchClient(
    `/community?q=${encodeURIComponent(`게시글 ${scenario.suffix}`)}`,
  )
  expect(restored.html, '해제하면 다시 보여야 한다').toContain(scenario.postTitle)
})

test('deleting a post 404s on the user site and can be restored', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto(`/community/posts?author=${encodeURIComponent(scenario.authorNickname)}`)

  await page
    .getByRole('row', { name: new RegExp(scenario.suffix) })
    .getByRole('button', { name: '삭제' })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText(/게시글을 삭제했습니다/)).toBeVisible()

  const deleted = await fetchClient(`/community/${scenario.postId}`)
  expect(deleted.status).toBe(404)

  await page
    .getByRole('row', { name: new RegExp(scenario.suffix) })
    .getByRole('button', { name: '복구' })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '복구' }).click()
  await expect(page.getByText(/게시글을\(를\) 복구했습니다/)).toBeVisible()

  const restored = await fetchClient(`/community/${scenario.postId}`)
  expect(restored.status).toBe(200)
})

test('hiding a comment removes it from the user site thread', async ({ page }) => {
  await signInAsAdmin(page)

  const withComment = await fetchClient(`/community/${scenario.postId}`)
  expect(withComment.html).toContain(scenario.commentContent)

  await page.goto(`/community/comments?author=${encodeURIComponent(scenario.authorNickname)}`)
  await toggleHide(page, new RegExp(scenario.suffix), '숨김')
  await expect(page.getByText(/댓글을 숨김 처리했습니다/)).toBeVisible()

  /* 사용자 사이트는 숨긴 댓글을 "삭제된 댓글입니다" 자리 표시로 남기지 않고 통째로
     빼 버린다(components/board/CommentSection.tsx 의 설계와 동일). 삭제와 같은 취급이다. */
  const hidden = await fetchClient(`/community/${scenario.postId}`)
  expect(hidden.html).not.toContain(scenario.commentContent)
  expect(hidden.html).not.toContain('삭제된 댓글')

  await toggleHide(page, new RegExp(scenario.suffix), '숨김 해제')
  await expect(page.getByText(/숨김 해제했습니다/)).toBeVisible()

  const restored = await fetchClient(`/community/${scenario.postId}`)
  expect(restored.html).toContain(scenario.commentContent)
})

test('bulk hide applies to the selected rows only', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto(`/community/comments?author=${encodeURIComponent(scenario.authorNickname)}`)

  await page
    .getByRole('row', { name: new RegExp(scenario.suffix) })
    .getByRole('checkbox')
    .check()
  await page.getByRole('button', { name: '선택 숨김' }).click()

  await expect(page.getByText(/댓글 1건을 숨김 처리했습니다/)).toBeVisible()

  const hidden = await fetchClient(`/community/${scenario.postId}`)
  expect(hidden.html).not.toContain(scenario.commentContent)

  await toggleHide(page, new RegExp(scenario.suffix), '숨김 해제')
  await expect(page.getByText(/숨김 해제했습니다/)).toBeVisible()
})
