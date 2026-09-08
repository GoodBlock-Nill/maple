/**
 * 검색 결과가 관리자 숨김/삭제를 즉시 반영하는지 실제 개발 서버(:3000)에 대고 확인한다.
 *
 * `lib/data/community.ts` · `lib/data/news.ts` 의 검색(`q !== ''`) 경로는
 * `unstable_cache` 를 우회하지만, Next 의 영속 fetch 캐시가 Supabase 응답을
 * 붙잡을 여지가 이론상 남는다(`connection()` 으로 막았다 — 두 파일 참고).
 * 단위 테스트는 실제 라우트 렌더링·HTTP 캐시를 확인하지 못하므로, 여기서는
 * 서비스 롤로 글을 만들고 검색 → 숨김 → 재검색까지 실제 dev 서버를 두드린다.
 *
 *   node --env-file=.env.local tests/manual/search-freshness-check.mjs
 *
 * 사전 조건: `pnpm dev` (root, :3000) 가 이미 떠 있어야 한다. 키는 환경 변수에서만
 * 읽고 출력에는 남기지 않는다.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

let failures = 0
const record = (name, ok, detail) => {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const marker = `검색신선도확인-${crypto.randomUUID().slice(0, 8)}`

async function searchContains(path, q) {
  const response = await fetch(`${siteUrl}${path}?q=${encodeURIComponent(q)}`, {
    cache: 'no-store',
  })
  const html = await response.text()

  return html.includes(marker)
}

/* 1. 커뮤니티 글을 만들고, 숨기기 전 검색되는지 확인한다 */
const { data: post, error: postError } = await admin
  .from('posts')
  .insert({
    board: 'community',
    category_key: 'chat',
    title: marker,
    content: '검색 신선도 확인용 글입니다.',
    author_name: '검증봇',
    is_published: true,
  })
  .select('id')
  .maybeSingle()

record('커뮤니티 글 생성', postError === null && post !== null, postError?.message ?? post?.id)

if (post !== null) {
  const foundBefore = await searchContains('/community', marker)
  record('숨기기 전 검색됨', foundBefore, foundBefore ? '' : '검색 결과에 없음(치명적)')

  await admin.from('posts').update({ is_published: false }).eq('id', post.id)

  const foundAfter = await searchContains('/community', marker)
  record('숨긴 뒤 검색에서 사라짐', !foundAfter, foundAfter ? '여전히 검색됨(치명적)' : '')

  await admin.from('posts').delete().eq('id', post.id)
}

/* 2. 뉴스도 같은 경로(`lib/data/news.ts`)를 타므로 동일하게 확인한다 */
const { data: news, error: newsError } = await admin
  .from('posts')
  .insert({
    board: 'news',
    category_key: 'notice',
    title: marker,
    content: '검색 신선도 확인용 글입니다.',
    author_name: '검증봇',
    is_published: true,
  })
  .select('id')
  .maybeSingle()

record('뉴스 글 생성', newsError === null && news !== null, newsError?.message ?? news?.id)

if (news !== null) {
  const foundBefore = await searchContains('/news', marker)
  record('숨기기 전 검색됨(뉴스)', foundBefore, foundBefore ? '' : '검색 결과에 없음(치명적)')

  await admin.from('posts').update({ is_published: false }).eq('id', news.id)

  const foundAfter = await searchContains('/news', marker)
  record('숨긴 뒤 검색에서 사라짐(뉴스)', !foundAfter, foundAfter ? '여전히 검색됨(치명적)' : '')

  await admin.from('posts').delete().eq('id', news.id)
}

console.log(failures === 0 ? '\n전부 통과' : `\n실패 ${failures}건`)
process.exit(failures === 0 ? 0 : 1)
