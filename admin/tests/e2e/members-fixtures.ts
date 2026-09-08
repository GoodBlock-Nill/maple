import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

/**
 * 커뮤니티·신고·회원 E2E 가 함께 쓰는 일회용 데이터.
 *
 * 자격 증명은 저장소에 두지 않는다 — 스크래치패드의 env 파일에서 테스트 안에서만
 * 읽는다(admin.spec.ts 와 같은 규칙). 계정은 서비스 롤로 만들고 테스트가 끝나면
 * 지운다. 실계정을 빌려 쓰면 실패한 실행이 남긴 제재가 다음 실행에 섞인다.
 */

const SECRETS_PATH =
  process.env.ADMIN_E2E_SECRETS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/admin-bootstrap.env'

export const SHOT_DIR =
  process.env.ADMIN_E2E_SHOTS ??
  '/private/tmp/claude-501/-Users-goodblock-Projects-maple/61a98c42-b684-4d24-8c7f-385f43df2325/scratchpad/verify'

export const CLIENT_SITE_URL = process.env.CLIENT_E2E_BASE_URL ?? 'http://localhost:3000'

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

export const ADMIN_EMAIL = secrets.ADMIN_BOOTSTRAP_EMAIL ?? ''
export const ADMIN_PASSWORD = secrets.ADMIN_BOOTSTRAP_PASSWORD ?? ''

/* 사용자 사이트 캐시 무효화 시크릿. 검증 준비 단계에서 캐시를 미리 데울 때만 쓴다
   (관리자 액션이 실제로 부르는 값과 같아야 의미가 있다). */
export const REVALIDATE_SECRET = localEnv.REVALIDATE_SECRET ?? ''

const SUPABASE_URL = localEnv.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = localEnv.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** RLS 를 우회하는 준비/정리용 클라이언트. 검증 자체에는 쓰지 않는다. */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** 일반 사용자 세션. 정지·숨김이 실제로 막는지 확인하는 프로브에 쓴다. */
export async function userClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })

  expect(error, `${email} 로그인 실패`).toBeNull()

  return client
}

export async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(ADMIN_EMAIL)
  await page.getByLabel('비밀번호').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
}

export type Scenario = {
  suffix: string
  authorId: string
  authorEmail: string
  authorPassword: string
  authorNickname: string
  reporterId: string
  reporterNickname: string
  postId: string
  postTitle: string
  commentId: string
  commentContent: string
  reportId: string
}

const PASSWORD = 'e2e-Throwaway-1!'

async function createUser(
  db: SupabaseClient,
  email: string,
): Promise<{ id: string; nickname: string }> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })

  expect(error, `${email} 생성 실패`).toBeNull()

  const id = data.user?.id ?? ''
  // 닉네임은 handle_new_user() 트리거가 정한다(중복 회피 로직 포함). 값을 되읽는다.
  const { data: profile } = await db.from('profiles').select('nickname').eq('id', id).maybeSingle()

  return { id, nickname: (profile?.nickname as string | undefined) ?? '' }
}

/** 신고 1건이 열려 있는 상태(작성자 · 신고자 · 게시글 · 댓글 · 신고)를 만든다. */
export async function createScenario(): Promise<Scenario> {
  const db = serviceClient()
  const suffix = Date.now().toString(36)
  const author = await createUser(db, `e2e-author-${suffix}@stub.glzaworld.local`)
  const reporter = await createUser(db, `e2e-reporter-${suffix}@stub.glzaworld.local`)

  const postTitle = `E2E 신고대상 게시글 ${suffix}`
  const { data: post, error: postError } = await db
    .from('posts')
    .insert({
      board: 'community',
      category_key: 'chat',
      title: postTitle,
      content: `자동 검증용 본문 ${suffix}`,
      author_id: author.id,
      author_name: author.nickname,
    })
    .select('id')
    .single()

  expect(postError, '게시글 생성 실패').toBeNull()

  const commentContent = `E2E 검증용 댓글 ${suffix}`
  const { data: comment, error: commentError } = await db
    .from('comments')
    .insert({
      post_id: post.id as string,
      author_id: author.id,
      author_name: author.nickname,
      content: commentContent,
    })
    .select('id')
    .single()

  expect(commentError, '댓글 생성 실패').toBeNull()

  const { data: report, error: reportError } = await db
    .from('reports')
    .insert({
      target_type: 'post',
      target_id: post.id as string,
      reporter_id: reporter.id,
      reason: 'abuse',
      detail: `자동 검증용 신고 ${suffix}`,
      status: 'open',
    })
    .select('id')
    .single()

  expect(reportError, '신고 생성 실패').toBeNull()

  return {
    suffix,
    authorId: author.id,
    authorEmail: `e2e-author-${suffix}@stub.glzaworld.local`,
    authorPassword: PASSWORD,
    authorNickname: author.nickname,
    reporterId: reporter.id,
    reporterNickname: reporter.nickname,
    postId: post.id as string,
    postTitle,
    commentId: comment.id as string,
    commentContent,
    reportId: report.id as string,
  }
}

export async function destroyScenario(scenario: Scenario): Promise<void> {
  const db = serviceClient()

  await db.from('reports').delete().eq('target_id', scenario.postId)
  /* 권한 부여 테스트가 남긴 초대 행. auth 사용자를 지워도 이 행은 남아, 같은
     주소로 다시 가입하면 트리거가 관리자로 만들어 버린다. */
  await db.from('admin_invites').delete().ilike('email', scenario.authorEmail)
  await db.from('comments').delete().eq('post_id', scenario.postId)
  await db.from('posts').delete().eq('id', scenario.postId)
  // 프로필은 auth 사용자 삭제에 연쇄로 지워진다(profiles.id → auth.users on delete cascade).
  await db.auth.admin.deleteUser(scenario.authorId)
  await db.auth.admin.deleteUser(scenario.reporterId)
}

/** 사용자 사이트 응답. 캐시가 아닌 새 렌더를 받도록 매번 다른 파라미터를 붙인다. */
export async function fetchClient(pathname: string): Promise<{ status: number; html: string }> {
  const separator = pathname.includes('?') ? '&' : '?'
  const response = await fetch(`${CLIENT_SITE_URL}${pathname}${separator}cb=${Date.now()}`)

  return { status: response.status, html: await response.text() }
}
