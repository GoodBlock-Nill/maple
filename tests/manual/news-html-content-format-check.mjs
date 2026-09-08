/**
 * 뉴스 상세가 `content_format='html'` 로 저장된 글을 실제로 렌더하는지 확인한다.
 *
 * 서비스 롤로 admin 에디터가 저장했을 법한 형태(HTML 본문 + 영상 자리표시자)의
 * 뉴스 한 건을 임시로 넣고, 실행 중인 로컬 서버(`http://localhost:3000`)에서
 * 상세 페이지를 fetch 해 굵은/일반 본문 마커와 유튜브 iframe 이 보이는지 검사한 뒤
 * 반드시 하드 삭제한다.
 *
 *   node --env-file=.env.local tests/manual/news-html-content-format-check.mjs
 *
 * 키는 환경 변수에서만 읽는다. 출력에도 남기지 않는다.
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

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const HTML_BODY =
  '<p><strong>굵은본문마커</strong> 일반본문마커</p><div data-video="youtube:dQw4w9WgXcQ"></div>'

let htmlNewsId = null

try {
  /* 1. content_format='html' 뉴스 한 건 삽입 (published, 방금 발행) */
  {
    const { data, error } = await admin
      .from('posts')
      .insert({
        board: 'news',
        category_key: 'notice',
        title: '[임시검증] HTML 뉴스 렌더 확인',
        summary: '수동 검증용 임시 글입니다.',
        content: HTML_BODY,
        content_format: 'html',
        author_name: '운영자',
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error !== null || data === null) {
      record('HTML 뉴스 삽입', false, error?.message ?? '알 수 없는 오류')
    } else {
      htmlNewsId = data.id
      record('HTML 뉴스 삽입', true, `id=${htmlNewsId}`)
    }
  }

  /* 2. 상세 페이지에서 굵은/일반 본문 + iframe 렌더 확인 */
  if (htmlNewsId !== null) {
    const res = await fetch(`${siteUrl}/news/${htmlNewsId}`)
    const html = await res.text()

    record('상세 페이지 200 응답', res.ok, `status=${res.status}`)
    record('굵은본문마커 렌더', html.includes('굵은본문마커'))
    record('일반본문마커 렌더', html.includes('일반본문마커'))
    record(
      '유튜브(youtube-nocookie) iframe 렌더',
      /<iframe[^>]+youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/u.test(html),
    )
  }

  /* 3. 기존 markdown 뉴스가 여전히 렌더되는지 확인 (회귀 방지) */
  {
    const { data: markdownNews, error } = await admin
      .from('posts')
      .select('id, content')
      .eq('board', 'news')
      .eq('content_format', 'markdown')
      .eq('is_published', true)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()

    if (error !== null || markdownNews === null) {
      record('기존 markdown 뉴스 조회', false, error?.message ?? '해당하는 글이 없다')
    } else {
      const res = await fetch(`${siteUrl}/news/${markdownNews.id}`)
      const html = await res.text()
      record('기존 markdown 뉴스 상세 200 응답', res.ok, `id=${markdownNews.id} status=${res.status}`)
      record('기존 markdown 뉴스 본문 비어있지 않음', html.includes('prose-board'))
    }
  }
} finally {
  /* 4. 반드시 하드 삭제 */
  if (htmlNewsId !== null) {
    const { error } = await admin.from('posts').delete().eq('id', htmlNewsId)
    record('임시 뉴스 하드 삭제', error === null, error?.message)
  }
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
