import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

/**
 * 정지 계정이 보는 화면 + 목록 캐시 무효화.
 *
 * 관리자 조치(정지 · 숨김)가 사용자 사이트에 **틈 없이** 반영되는지 본다. 조치는
 * 서비스 롤로 직접 걸고(관리자 앱을 띄우지 않는다), 화면만 브라우저로 확인한다.
 *
 * Playwright 러너는 `.env.local` 을 읽지 않으므로 여기서 직접 읽어 채운다. 키가
 * 없으면 테스트를 건너뛴다(CI 에 서비스 롤 키를 강제하지 않는다).
 *
 * chromium 에서만 돈다. 두 프로젝트가 나란히 돌면 스텁 계정이 서로의 도배 제한과
 * 캐시 무효화를 밀어낸다.
 */

test.describe.configure({ mode: 'serial' })

function readLocalEnv(key: string): string | undefined {
  if (process.env[key] !== undefined && process.env[key] !== '') {
    return process.env[key]
  }

  try {
    const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
    const line = raw.split('\n').find((entry) => entry.startsWith(`${key}=`))

    return line?.slice(key.length + 1).trim() || undefined
  } catch {
    return undefined
  }
}

const url = readLocalEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = readLocalEnv('SUPABASE_SERVICE_ROLE_KEY')
const revalidateSecret = readLocalEnv('REVALIDATE_SECRET')

const DAY_MS = 24 * 60 * 60 * 1000
const SUSPENSION_REASON = '테스트'
const NOTICE = '[data-testid="suspension-notice"]'

function adminClient(): SupabaseClient {
  return createClient(url ?? '', serviceKey ?? '', { auth: { persistSession: false } })
}

/** 스텁 간편로그인 + 온보딩. 실행마다 새 계정이 만들어진다. */
async function signInAsNewUser(page: Page, nextPath: string): Promise<string> {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`)
  await page.locator('button[name="provider"][value="google"]').click()
  await page.waitForURL((current) => !current.pathname.startsWith('/login'))

  const stamp = Date.now().toString().slice(-8)
  const nickname = `정지검증${stamp}`

  if (page.url().includes('/auth/onboarding')) {
    await page.getByRole('textbox', { name: '닉네임' }).fill(nickname)

    const uid = page.getByRole('textbox', { name: /UID/ })

    if (await uid.isVisible()) {
      await uid.fill(`20${Date.now()}`)
    }

    const profileCode = page.getByRole('textbox', { name: /프로필 코드/ })

    if (await profileCode.isVisible()) {
      await profileCode.fill(`#${Date.now().toString(36)}`)
    }

    for (const checkbox of await page.getByRole('checkbox').all()) {
      await checkbox.check()
    }

    await page
      .getByRole('button', { name: /시작|완료|저장/ })
      .first()
      .click()
    await page.waitForURL((current) => !current.pathname.startsWith('/auth/onboarding'))

    return nickname
  }

  /* 온보딩을 건너뛴 계정(익명 로그인 재사용 등)은 닉네임을 모른다. 헤더에서 읽는다. */
  return nickname
}

test.describe('정지 계정', () => {
  test.skip(
    url === undefined || serviceKey === undefined,
    'SUPABASE_SERVICE_ROLE_KEY 가 없으면 제재를 걸 수 없다.',
  )

  test('should block writing with a notice and release it when unsuspended', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      '스텁 계정이 겹치지 않게 한 프로젝트에서만 돈다.',
    )
    test.setTimeout(120_000)
    // Arrange — 새 계정으로 로그인한 뒤, 그 계정에만 제재를 건다.
    const admin = adminClient()
    const nickname = await signInAsNewUser(page, '/community/write')

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('nickname', nickname)
      .maybeSingle()

    expect(profile?.id, '온보딩으로 만든 프로필을 찾지 못했다').toBeTruthy()

    const userId = profile?.id as string
    const until = new Date(Date.now() + DAY_MS).toISOString()

    await admin
      .from('profiles')
      .update({ suspended_until: until, suspension_reason: SUSPENSION_REASON })
      .eq('id', userId)

    // Act — 글쓰기 화면을 다시 연다.
    await page.goto('/community/write')

    // Assert — 배너가 이유를 말하고 등록 버튼이 잠긴다.
    const notice = page.locator(NOTICE).first()

    await expect(notice).toBeVisible()
    await expect(notice).toContainText('정지된 계정입니다')
    await expect(notice).toContainText(SUSPENSION_REASON)
    await expect(notice).toContainText('고객지원')
    await expect(page.getByRole('button', { name: '등록' })).toBeDisabled()

    // Act — 제재를 푼다.
    await admin
      .from('profiles')
      .update({ suspended_until: null, suspension_reason: null })
      .eq('id', userId)

    await page.goto('/community/write')

    // Assert — 배너가 사라지고 다시 쓸 수 있다.
    await expect(page.locator(NOTICE)).toHaveCount(0)
    await expect(page.getByRole('button', { name: '등록' })).toBeEnabled()

    // Cleanup
    await admin.auth.admin.deleteUser(userId)
  })
})

test.describe('목록 캐시 무효화', () => {
  test.skip(
    url === undefined || serviceKey === undefined || revalidateSecret === undefined,
    'SUPABASE_SERVICE_ROLE_KEY · REVALIDATE_SECRET 이 필요하다.',
  )

  test('should drop a hidden post from the list on the next request', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      '캐시 무효화가 서로를 밀어내지 않게 한 프로젝트에서만 돈다.',
    )
    // Arrange — 목록에 보이는 글을 하나 만든다.
    const admin = adminClient()
    const title = `[캐시검증] ${Date.now()}`

    const { data: post } = await admin
      .from('posts')
      .insert({
        board: 'community',
        category_key: 'chat',
        title,
        content: '<p>캐시 무효화 확인용</p>',
        content_format: 'html',
        author_name: '검증',
      })
      .select('id')
      .single()

    expect(post?.id).toBeTruthy()

    const postId = post?.id as string

    // 새 글이 보이도록 목록 태그를 한 번 태운다.
    await request.post('/api/revalidate', {
      headers: { 'x-revalidate-secret': revalidateSecret ?? '' },
      data: { tags: ['community-list'] },
    })

    await page.goto('/community')
    await expect(page.getByText(title)).toBeVisible()

    // Act — 운영 숨김 + 태그 무효화
    await admin.from('posts').update({ is_hidden: true }).eq('id', postId)

    const revalidated = await request.post('/api/revalidate', {
      headers: { 'x-revalidate-secret': revalidateSecret ?? '' },
      data: { tags: ['community-list'] },
    })

    expect(revalidated.ok()).toBe(true)

    // Assert — 다음 요청 한 번으로 사라진다(60초를 기다리지 않는다).
    await page.goto('/community')
    await expect(page.getByText(title)).toHaveCount(0)

    // Cleanup
    await admin.from('posts').delete().eq('id', postId)
  })
})
