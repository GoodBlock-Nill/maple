import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { CACHE_TAGS } from '@/lib/data/cache'

/**
 * 관리자 앱 → 사용자 사이트 캐시 무효화 훅.
 *
 * 관리자(`admin/`)는 **별도 배포**라 `revalidateTag()` 를 직접 부를 수 없다.
 * Next 의 캐시는 프로세스별로 존재하므로, 관리자에서 콘텐츠를 저장한 뒤 이
 * 라우트를 호출해야 사용자 사이트가 새 값을 읽는다.
 *
 * 계약
 *   POST /api/revalidate
 *   header  x-revalidate-secret: <REVALIDATE_SECRET>
 *   body    { "tags": ["site", "gacha"] }
 *   200     { "revalidated": ["site", "gacha"] }
 *   400     { "error": "...", "allowed": [...] }   알 수 없는 태그 · 잘못된 본문
 *   401     { "error": "..." }                     시크릿 불일치 · 서버 미설정
 *
 * 인증을 세션이 아니라 공유 시크릿으로 하는 이유: 호출자는 사람이 아니라 서버
 * (관리자 서버 액션)이고, 두 앱이 쿠키 도메인을 공유하지 않는다. 시크릿은
 * 양쪽 배포 환경 변수(`REVALIDATE_SECRET`)로만 오간다.
 */

/** 캐시를 태우는 엔드포인트 자체가 캐시되면 안 된다. */
export const dynamic = 'force-dynamic'

const SECRET_HEADER = 'x-revalidate-secret'

/** `lib/data/cache.ts` 가 실제로 다는 태그만 허용한다(오타 무효화 방지). */
const ALLOWED_TAGS: readonly string[] = Object.values(CACHE_TAGS)

const requestSchema = z.object({
  tags: z
    .array(z.string())
    .min(1, '무효화할 태그를 하나 이상 보내야 합니다.')
    .max(ALLOWED_TAGS.length, '알 수 없는 태그가 섞여 있습니다.'),
})

/**
 * 타이밍 공격 완화. 길이가 다르면 즉시 실패시키되, 같은 길이일 때는 모든 문자를
 * 비교한다(조기 반환으로 접두사 일치 길이가 새어 나가지 않게 한다).
 */
function isSecretEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return diff === 0
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET
  const provided = request.headers.get(SECRET_HEADER)

  /* 시크릿을 설정하지 않은 배포에서는 이 라우트가 열려 있으면 안 된다.
     "설정 안 됨 = 통과"가 되는 순간 누구나 캐시를 비울 수 있다. */
  if (secret === undefined || secret.trim() === '') {
    return NextResponse.json(
      { error: 'REVALIDATE_SECRET 이 설정되지 않았습니다.' },
      { status: 401 },
    )
  }

  if (provided === null || !isSecretEqual(provided, secret)) {
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'JSON 본문을 해석하지 못했습니다.', allowed: ALLOWED_TAGS },
      { status: 400 },
    )
  }

  const parsed = requestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '잘못된 요청입니다.', allowed: ALLOWED_TAGS },
      { status: 400 },
    )
  }

  const unknownTag = parsed.data.tags.find((tag) => !ALLOWED_TAGS.includes(tag))

  if (unknownTag !== undefined) {
    return NextResponse.json(
      { error: `알 수 없는 태그입니다: ${unknownTag}`, allowed: ALLOWED_TAGS },
      { status: 400 },
    )
  }

  /* 같은 태그를 두 번 보내도 한 번만 태운다. */
  const tags = [...new Set(parsed.data.tags)]

  for (const tag of tags) {
    /* Next 16 의 두 번째 인자는 필수다(1-인자 형태는 폐기 예정).
       `updateTag()` 는 Server Action 전용이라 Route Handler 인 여기서는 쓸 수 없다
       (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md`).
       그렇다고 `'max'`(stale-while-revalidate) 를 쓰면 관리자가 숨기거나 지운
       직후의 첫 요청이 여전히 이전 값을 돌려준다 — read-your-own-writes 가 깨진다.
       `{ expire: 0 }` 는 이전 값을 절대 서빙하지 않고 다음 요청이 새로 읽을 때까지
       블로킹한다(`revalidateTag.md` "Route Handler" 절 — updateTag 를 쓸 수 없을 때의
       권장값). */
    revalidateTag(tag, { expire: 0 })
  }

  return NextResponse.json({ revalidated: tags })
}
