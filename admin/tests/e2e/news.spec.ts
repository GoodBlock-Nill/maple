import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

/**
 * 뉴스 관리 모듈 인수 검증.
 *
 * 한 편의 글이 관리자에서 **사용자 사이트까지** 어떻게 흘러가는지를 통째로 따라간다.
 * 임시저장 → 발행 → 클라이언트 노출 확인 → 숨김 → 클라이언트에서 사라짐 → 삭제 →
 * 복구 → 다시 삭제. 관리자 화면의 상태 뱃지와 실제 노출이 어긋나면 여기서 깨진다.
 *
 * 자격 증명은 저장소에 두지 않는다. 스크래치패드의 env 파일에서 **테스트 안에서만** 읽는다.
 */
const SECRETS_PATH =
  process.env.ADMIN_E2E_SECRETS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/admin-bootstrap.env'

const SHOT_DIR =
  process.env.ADMIN_E2E_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/verify'

/* 배포된 사용자 사이트가 아니라 **로컬** 클라이언트를 본다. 관리자 .env.local 의
   NEXT_PUBLIC_CLIENT_SITE_URL 은 배포 주소라 방금 쓴 글이 있을 수 없다. */
const CLIENT_SITE_URL = process.env.NEWS_E2E_CLIENT_URL ?? 'http://localhost:3000'

const TITLE = '[E2E] 뉴스 관리 테스트'
const SEARCH = 'E2E'
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

function readEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)

    if (match?.[1] !== undefined && match[2] !== undefined) {
      result[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }

  return result
}

const secrets = readEnvFile(SECRETS_PATH)
const localEnv = readEnvFile(path.join(process.cwd(), '.env.local'))

const ADMIN_EMAIL = secrets.ADMIN_BOOTSTRAP_EMAIL ?? ''
const ADMIN_PASSWORD = secrets.ADMIN_BOOTSTRAP_PASSWORD ?? ''

async function signIn(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(ADMIN_EMAIL)
  await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
}

/** 사용자 사이트 목록에 제목이 보이는가. 재검증 지연을 고려해 폴링한다. */
async function clientListShows(
  request: { get: (url: string) => Promise<{ ok: () => boolean; text: () => Promise<string> }> },
  shouldContain: boolean,
): Promise<void> {
  await expect
    .poll<boolean | string>(
      async () => {
        const response = await request.get(`${CLIENT_SITE_URL}/news`)

        /* 응답이 실패하면 "없다"로 읽지 않는다 — 서버가 죽어 있는 것과 글이 숨겨진
           것은 다른 사건이고, 전자를 성공으로 넘기면 이 단언이 의미를 잃는다. */
        return response.ok() ? (await response.text()).includes(TITLE) : 'unreachable'
      },
      { timeout: 30_000, intervals: [500, 1000, 2000, 3000] },
    )
    .toBe(shouldContain)
}

/* 이전 실행이 남긴 행을 물리 삭제한다. 소프트 삭제만 하면 검색 결과가 계속 늘어나
   "1건" 단언이 무너진다. */
test.beforeAll(async () => {
  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY

  expect(url, '.env.local 에 NEXT_PUBLIC_SUPABASE_URL 이 필요합니다').toBeTruthy()
  expect(serviceKey, '.env.local 에 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다').toBeTruthy()

  const supabase = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await supabase.from('posts').delete().eq('board', 'news').eq('title', TITLE)
})

test('a news post travels from draft to the client site and back to the bin', async ({
  page,
  request,
}) => {
  /* 관리자 셸은 `max-w-[1440px]` 를 기준으로 짠 화면이다. 기본 1280 뷰포트로 찍으면
     표가 가로로 잘려 실제 운영 화면과 다른 그림이 남는다. */
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signIn(page)

  /* 1. 목록이 뜨고 기존 뉴스가 최소 한 건은 보인다(헤더 행 + 데이터 행). */
  await page.goto('/news')
  await expect(page.getByRole('heading', { name: '뉴스', exact: true })).toBeVisible()
  expect(await page.getByRole('row').count()).toBeGreaterThan(1)

  /* 2. 임시저장으로 새 글을 쓴다 — 굵은 글씨 + 유튜브 임베드. */
  await page.goto('/news/new')
  await page.getByLabel('카테고리').selectOption('notice')
  await page.getByRole('textbox', { name: '제목', exact: true }).fill(TITLE)
  await page.getByRole('textbox', { name: '요약', exact: true }).fill('자동 검증용 글입니다.')

  await page.getByRole('textbox', { name: '본문', exact: true }).click()
  await page.getByRole('button', { name: '굵게', exact: true }).click()
  await page.keyboard.type('굵은 본문')
  await page.getByRole('button', { name: '굵게', exact: true }).click()
  await page.keyboard.type(' 일반 본문')

  await page.getByRole('button', { name: '영상 첨부' }).click()
  await page.getByRole('textbox', { name: '영상 주소' }).fill(YOUTUBE_URL)
  await page.getByRole('button', { name: '확인' }).click()

  await page.getByRole('radio', { name: '임시저장' }).check()
  await page.getByRole('button', { name: '저장', exact: true }).click()

  await page.waitForURL(/\/news\/[0-9a-f-]{36}$/u)
  const postId = page.url().split('/').pop() ?? ''

  expect(postId).not.toBe('')

  /* 저장된 본문이 정제기를 통과해 굵은 글씨와 영상 자리표시자를 유지했는가. */
  const preview = page.getByTestId('news-preview')

  await expect(preview.getByRole('heading', { name: '클라이언트 미리보기' })).toBeVisible()
  await expect(preview.locator('strong', { hasText: '굵은 본문' })).toBeVisible()
  await expect(preview.locator('.video-embed iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  )

  /* 3. 목록에 임시저장 · 비노출로 나타난다. */
  await page.goto(`/news?q=${SEARCH}`)
  const row = page.getByRole('row').filter({ hasText: TITLE })

  await expect(row).toHaveCount(1)
  await expect(row.getByText('임시저장')).toBeVisible()
  await expect(row.getByText('비노출')).toBeVisible()

  /* 4. 즉시 발행으로 바꾼다. */
  await page.goto(`/news/${postId}`)
  await page.getByRole('radio', { name: '즉시 발행' }).check()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByText('저장했습니다.')).toBeVisible()

  await page.reload()
  await expect(page.getByText('클라이언트 노출 중')).toBeVisible()
  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-news-edit.png'), fullPage: true })

  /* 5. 사용자 사이트에 실제로 뜬다. */
  await clientListShows(request, true)

  await page.goto(`/news?q=${SEARCH}`)
  await expect(row.getByText('노출 중')).toBeVisible()
  await page.screenshot({ path: path.join(SHOT_DIR, 'admin-news-list.png'), fullPage: true })

  /* 6. 숨기면 사용자 사이트에서 사라진다. */
  await row.getByRole('button', { name: '숨김', exact: true }).click()
  await expect(page.getByText('1건을 숨겼습니다.')).toBeVisible()
  await expect(row.getByText('비노출')).toBeVisible()
  await clientListShows(request, false)

  /* 7. 삭제하면 기본 목록에서 빠진다(소프트 삭제). */
  await row.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('1건을 삭제했습니다.')).toBeVisible()

  await page.goto(`/news?q=${SEARCH}`)
  await expect(row).toHaveCount(0)

  /* 8. 휴지통(상태=삭제)에서 복구할 수 있다. */
  await page.goto(`/news?q=${SEARCH}&status=deleted`)
  await expect(row).toHaveCount(1)
  await expect(row.getByRole('button', { name: '복구' })).toBeVisible()
  await row.getByRole('button', { name: '복구' }).click()
  await expect(page.getByText('1건을 복구했습니다.')).toBeVisible()

  /* 9. 뒷정리 — 다시 삭제한 상태로 남긴다. */
  await page.goto(`/news?q=${SEARCH}`)
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('1건을 삭제했습니다.')).toBeVisible()

  await page.goto(`/news?q=${SEARCH}`)
  await expect(row).toHaveCount(0)
  await clientListShows(request, false)
})
