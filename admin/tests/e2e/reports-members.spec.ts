import path from 'node:path'

import { expect, test } from '@playwright/test'

import {
  createScenario,
  destroyScenario,
  serviceClient,
  SHOT_DIR,
  signInAsAdmin,
  userClient,
  type Scenario,
} from './members-fixtures'

/**
 * 신고 접수 → 처리(작성자 정지) → 정지 해제까지의 한 흐름.
 *
 * 화면만 보지 않는다. 정지가 실제로 쓰기를 막는지 사용자 세션으로 직접 확인한다
 * (`posts_insert_community` · `comments_insert_own` 의 `not is_suspended()`).
 * 화면의 뱃지는 컬럼을 그린 것일 뿐이라, 그것만 보면 제재가 도는지 알 수 없다.
 */

const RLS_VIOLATION = '42501'

let scenario: Scenario

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  scenario = await createScenario()
})

test.afterAll(async () => {
  await destroyScenario(scenario)
})

test('an open report shows up in the queue with its target and reporter', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/reports')

  await expect(page.getByRole('heading', { name: '신고' })).toBeVisible()

  const row = page.getByRole('row', { name: new RegExp(scenario.suffix) })
  await expect(row).toBeVisible()
  await expect(row.getByText('게시글', { exact: true })).toBeVisible()
  await expect(row.getByText('욕설·비방')).toBeVisible()
  await expect(row.getByText(scenario.reporterNickname)).toBeVisible()

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-reports.png'), fullPage: true })
})

test('resolving with a 3-day suspension blocks the author from writing', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/reports')

  await page
    .getByRole('row', { name: new RegExp(scenario.suffix) })
    .getByRole('button', { name: '처리' })
    .click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(scenario.postTitle)).toBeVisible()

  await dialog.getByRole('radio', { name: /작성자 정지/ }).check()
  await dialog.getByRole('radio', { name: '3일', exact: true }).check()
  await dialog.getByLabel('정지 사유').fill('E2E 검증: 욕설 반복')
  await dialog.getByLabel('처리 메모').fill('E2E 검증 메모')
  await dialog.getByRole('button', { name: '처리 완료' }).click()

  await expect(page.getByText(/신고 \d+건을 처리했습니다/)).toBeVisible()

  // 큐에서 빠지고 "처리 완료" 탭으로 옮겨간다.
  await page.goto('/reports?status=open')
  await expect(page.getByRole('row', { name: new RegExp(scenario.suffix) })).toHaveCount(0)
  await page.goto('/reports?status=resolved')
  await expect(page.getByRole('row', { name: new RegExp(scenario.suffix) })).toBeVisible()

  // 실제 제재 확인: 정지된 사용자의 댓글 insert 는 RLS 가 거절해야 한다.
  const author = await userClient(scenario.authorEmail, scenario.authorPassword)
  const { error } = await author.from('comments').insert({
    post_id: scenario.postId,
    author_id: scenario.authorId,
    author_name: scenario.authorNickname,
    content: '정지 중 작성 시도',
  })

  expect(error?.code, '정지 중에는 댓글 insert 가 막혀야 한다').toBe(RLS_VIOLATION)

  // 감사 로그에 처리 메모가 남는다(reports 에 메모 컬럼이 없어 여기가 원본이다).
  const { data: logs } = await serviceClient()
    .from('audit_logs')
    .select('action, after')
    .eq('action', 'report.resolve')
    .order('created_at', { ascending: false })
    .limit(5)

  const entry = (logs ?? []).find(
    (log) => (log.after as { note?: string } | null)?.note === 'E2E 검증 메모',
  )

  expect(entry, '처리 메모가 감사 로그에 남아야 한다').toBeTruthy()
  expect((entry?.after as { moderation?: string }).moderation).toBe('suspend')
})

test('the member list and detail show the suspension, and lifting it restores writing', async ({
  page,
}) => {
  await signInAsAdmin(page)
  await page.goto(`/members?q=${encodeURIComponent(scenario.authorNickname)}`)

  const row = page.getByRole('row', { name: new RegExp(scenario.authorNickname) })
  await expect(row).toBeVisible()
  await expect(row.getByText(/^정지/)).toBeVisible()

  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-members.png'), fullPage: true })

  await page.goto(`/members/${scenario.authorId}`)
  await expect(
    page.getByRole('heading', { level: 1, name: scenario.authorNickname, exact: true }),
  ).toBeVisible()
  await expect(page.getByText('E2E 검증: 욕설 반복')).toBeVisible()

  await page.getByRole('button', { name: '정지 해제' }).click()
  await expect(page.getByText(/정지를 해제했습니다/)).toBeVisible()

  const author = await userClient(scenario.authorEmail, scenario.authorPassword)
  const { data, error } = await author
    .from('comments')
    .insert({
      post_id: scenario.postId,
      author_id: scenario.authorId,
      author_name: scenario.authorNickname,
      content: `해제 후 작성 ${scenario.suffix}`,
    })
    .select('id')
    .single()

  expect(error, '정지가 풀리면 다시 쓸 수 있어야 한다').toBeNull()

  await serviceClient()
    .from('comments')
    .delete()
    .eq('id', data?.id as string)
})

test('a forced nickname change keeps the author_name snapshot on existing posts', async ({
  page,
}) => {
  const nextNickname = `e2e${scenario.suffix.slice(-6)}`

  await signInAsAdmin(page)
  await page.goto(`/members/${scenario.authorId}`)

  await page.getByRole('button', { name: '닉네임 변경' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('새 닉네임').fill(nextNickname)
  await dialog.getByLabel('사유').fill('E2E 검증: 부적절한 닉네임')
  await dialog.getByRole('button', { name: '변경', exact: true }).click()

  await expect(page.getByText(new RegExp(`닉네임을 ${nextNickname} 로 변경했습니다`))).toBeVisible()

  const db = serviceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('nickname')
    .eq('id', scenario.authorId)
    .maybeSingle()

  expect(profile?.nickname, '프로필 닉네임은 바뀐다(사용자 사이트 헤더는 새로고침 시 반영)').toBe(
    nextNickname,
  )

  /* 이미 쓴 글의 표시 이름은 작성 시점 스냅샷이라 그대로다. 운영자가 이 차이를
     모르면 "안 바뀌었다"고 오해하므로 다이얼로그에도 같은 문구를 적어 두었다. */
  const { data: post } = await db
    .from('posts')
    .select('author_name')
    .eq('id', scenario.postId)
    .maybeSingle()

  expect(post?.author_name).toBe(scenario.authorNickname)

  scenario.authorNickname = nextNickname
})

/* 관리자 승격/회수 테스트는 삭제했다 — 회원 상세에서 관리자를 만드는 경로가
   2026-09-09 제품 결정으로 사라졌다. 관리자 계정 관리는 `/admins` 의 이메일 초대
   흐름이 담당하고, 그 검증은 admin.spec.ts 에 있다. */
