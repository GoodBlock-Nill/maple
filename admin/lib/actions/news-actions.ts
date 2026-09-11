'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import {
  NEWS_BOARD,
  NEWS_PIN_LIMIT,
  NEWS_PIN_LIMIT_MESSAGE,
  newsAuditSnapshot,
  type NewsSnapshot,
  type NewsSnapshotRow,
} from '@/lib/constants/news'
import { getPinnedNewsSummary } from '@/lib/data/news'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { sanitizePostHtml } from '@/lib/sanitize/post-html'
import { createClient } from '@/lib/supabase/server'
import {
  newsFormSchema,
  resolvePublishPlan,
  type NewsFormInput,
  type NewsPublishState,
} from '@/lib/validation/news'

import type { Json } from '@/types/database.types'

/**
 * 뉴스 작성 · 수정 · 숨김 · 삭제 · 복구.
 *
 * 모든 액션이 스스로 `requirePermission('news', 'write')` 을 부른다. 레이아웃이 이미 막고 있어도 서버
 * 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있기 때문이다(Next 문서 경고).
 * 쓰기는 전부 세션 클라이언트로 한다 — RLS(`posts_*_admin`)가 다시 검사하게 둔다.
 */

const NEWS_PATH = '/news'
const SAVE_FAILURE = '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const SNAPSHOT_COLUMNS =
  'id, title, category_key, is_published, published_at, is_hidden, deleted_at'

/**
 * DB 트리거(`guard_news_pin_limit`, `20260911000500_news_pin_limit.sql`)가
 * 던지는 메시지. 동시 요청이 사전 검사(`checkPinLimit`)를 함께 통과해 버리는
 * 경우의 최종 방어선이라, 원문을 그대로 보여 주지 않고 같은 한국어 문구로 옮긴다.
 */
const PIN_LIMIT_TRIGGER_MESSAGE = 'news_pin_limit_exceeded'

function isPinLimitTriggerError(message: string): boolean {
  return message.includes(PIN_LIMIT_TRIGGER_MESSAGE)
}

/**
 * 저장 실패 → 화면 문구.
 *
 * 한도 초과(레이스로 사전 검사를 통과해 버린 경우)는 필드 오류로, 그 밖의 실패는
 * 고정 문장의 폼 오류로 돌려준다. 원문은 호출부가 `console.error` 로만 남긴다.
 */
function saveErrorState(message: string): FormState {
  return isPinLimitTriggerError(message)
    ? { fieldErrors: { isPinned: NEWS_PIN_LIMIT_MESSAGE } }
    : { formError: SAVE_FAILURE }
}

/**
 * 사용자 사이트의 뉴스 목록 캐시를 태운다.
 *
 * 임시저장끼리의 수정은 사용자 사이트에 보이지 않으므로 부르지 않는다 — 남의
 * 캐시를 이유 없이 비우지 않기 위해서다. 발행·숨김·삭제·복구는 목록이 즉시
 * 달라져야 한다(목록은 `unstable_cache` 60초, 상세는 매 요청 조회).
 */
async function revalidateNewsList(): Promise<void> {
  await revalidateClient([CLIENT_CACHE_TAGS.newsList])
}

/** `Json` 으로 좁히기 위한 한 겹. 스냅샷은 평평한 문자열 객체다. */
function toJson(snapshot: NewsSnapshot): Json {
  return { ...snapshot }
}

/**
 * 작성/수정 공용 저장.
 *
 * 본문은 **여기서 정제한 값만** 저장한다. 에디터가 무엇을 보냈든, 에디터를 우회한
 * 직접 POST 든 같은 허용 목록을 통과한다(`lib/sanitize/post-html.ts`).
 */
export async function saveNewsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('news', 'write')
  const parsed = newsFormSchema.safeParse({
    categoryKey: readField(formData, 'categoryKey'),
    title: readField(formData, 'title'),
    summary: readField(formData, 'summary'),
    content: readField(formData, 'content'),
    publishMode: readField(formData, 'publishMode'),
    scheduledAt: readField(formData, 'scheduledAt'),
    // 체크박스는 켜졌을 때만 전송된다. 없으면 false 다.
    isPinned: formData.get('isPinned') !== null,
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const content = sanitizePostHtml(parsed.data.content)

  /* 정제 후 빈 문자열 = 허용되지 않은 태그만 보냈다는 뜻이다. 그대로 두면 본문
     없는 글이 발행된다. */
  if (content === '') {
    return { fieldErrors: { content: '저장할 수 있는 본문이 없습니다.' } }
  }

  const postId = readField(formData, 'id')

  return postId === ''
    ? createNews(actor.id, actor.nickname, parsed.data, content)
    : updateNews(actor.id, postId, parsed.data, content)
}

/** 폼 입력 → `posts` 의 본문 컬럼들. 작성·수정이 같은 매핑을 쓴다. */
function toColumns(input: NewsFormInput, content: string, current: NewsPublishState | null) {
  const plan = resolvePublishPlan(input, current)

  return {
    category_key: input.categoryKey,
    title: input.title,
    summary: input.summary === '' ? null : input.summary,
    content,
    content_format: 'html' as const,
    is_published: plan.isPublished,
    published_at: plan.publishedAt,
    is_pinned: input.isPinned,
  }
}

/**
 * 상단 고정 3개 한도 사전 검사.
 *
 * 저장을 시도하기 전에 미리 세어 친절한 안내(현재 고정된 제목)를 필드 오류로
 * 돌려준다. 이 검사가 통과한 직후 다른 요청이 끼어들어도(레이스) 마지막 방어선은
 * DB 트리거(`guard_news_pin_limit`)다 — `createNews`/`updateNews` 의 catch 가
 * 그 트리거 오류를 같은 문구로 옮긴다.
 */
async function checkPinLimit(
  input: NewsFormInput,
  current: NewsPublishState | null,
  excludeId?: string,
): Promise<FormState | null> {
  if (!input.isPinned) {
    return null
  }

  /* 임시저장은 한도에 넣지 않는다 — 클라이언트에 보이지 않는 고정 표시는 세지
     않는다(`getPinnedNewsSummary()` 와 같은 기준). */
  if (!resolvePublishPlan(input, current).isPublished) {
    return null
  }

  const summary = await getPinnedNewsSummary(excludeId)

  if (summary.hasError || summary.count < NEWS_PIN_LIMIT) {
    return null
  }

  const titles = summary.posts.map((post) => post.title).join(', ')

  return {
    fieldErrors: {
      isPinned:
        titles === '' ? NEWS_PIN_LIMIT_MESSAGE : `${NEWS_PIN_LIMIT_MESSAGE} (현재 고정: ${titles})`,
    },
  }
}

async function createNews(
  actorId: string,
  actorNickname: string,
  input: NewsFormInput,
  content: string,
): Promise<FormState> {
  const pinLimitError = await checkPinLimit(input, null)

  if (pinLimitError !== null) {
    return pinLimitError
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .insert({
      ...toColumns(input, content, null),
      board: NEWS_BOARD,
      author_id: actorId,
      author_name: actorNickname,
    })
    .select(SNAPSHOT_COLUMNS)
    .single()

  if (error !== null) {
    console.error('[news] 작성 실패', error.message)

    return saveErrorState(error.message)
  }

  const after = newsAuditSnapshot(data)

  await writeAuditLog(actorId, {
    action: after.status === 'draft' ? 'news.create' : 'news.publish',
    targetTable: 'posts',
    targetId: data.id,
    after: toJson(after),
  })

  revalidatePath(NEWS_PATH)

  if (after.status !== 'draft') {
    await revalidateNewsList()
  }

  // redirect() 는 예외를 던져 이후 코드를 건너뛴다. 재검증을 반드시 앞에 둔다.
  redirect(`${NEWS_PATH}/${data.id}`)
}

async function updateNews(
  actorId: string,
  postId: string,
  input: NewsFormInput,
  content: string,
): Promise<FormState> {
  const supabase = await createClient()
  const { data: current } = await supabase
    .from('posts')
    .select(SNAPSHOT_COLUMNS)
    .eq('id', postId)
    .eq('board', NEWS_BOARD)
    .maybeSingle()

  if (current === null || current === undefined) {
    return { formError: '글을 찾을 수 없습니다.' }
  }

  const currentPublishState: NewsPublishState = {
    isPublished: current.is_published,
    publishedAt: current.published_at,
  }

  const pinLimitError = await checkPinLimit(input, currentPublishState, postId)

  if (pinLimitError !== null) {
    return pinLimitError
  }

  const before = newsAuditSnapshot(current)
  const { data, error } = await supabase
    .from('posts')
    .update(toColumns(input, content, currentPublishState))
    .eq('id', postId)
    .select(SNAPSHOT_COLUMNS)
    .single()

  if (error !== null) {
    console.error('[news] 수정 실패', error.message)

    return saveErrorState(error.message)
  }

  const after = newsAuditSnapshot(data)

  await writeAuditLog(actorId, {
    /* 임시저장 → 공개 전환은 되짚어 볼 일이 잦아 별도 action 으로 남긴다. */
    action: before.status === 'draft' && after.status !== 'draft' ? 'news.publish' : 'news.update',
    targetTable: 'posts',
    targetId: postId,
    before: toJson(before),
    after: toJson(after),
  })

  revalidatePath(NEWS_PATH)
  revalidatePath(`${NEWS_PATH}/${postId}`)

  /* 발행 → 임시저장으로 내린 경우에도 목록에서 빠져야 하므로 전/후 어느 쪽이든
     임시저장이 아니면 태운다. */
  if (before.status !== 'draft' || after.status !== 'draft') {
    await revalidateNewsList()
  }

  return { message: '저장했습니다.' }
}

/* ---------------------------------------------------------------------------
 * 상태 변경 — 숨김 · 해제 · 삭제 · 복구
 *
 * 네 조작이 한 액션인 이유: 대상만 다를 뿐 흐름(전 스냅샷 → 갱신 → 감사 로그)이
 * 같고, 행 버튼과 일괄 처리 바가 같은 폼을 쓴다. 대상은 `ids` 반복 필드로 받으므로
 * 한 건이든 스무 건이든 코드 경로가 하나다.
 * ------------------------------------------------------------------------ */

const NEWS_INTENTS = {
  hide: { action: 'news.hide', done: '숨겼습니다.' },
  unhide: { action: 'news.unhide', done: '숨김을 해제했습니다.' },
  delete: { action: 'news.delete', done: '삭제했습니다.' },
  restore: { action: 'news.restore', done: '복구했습니다.' },
} as const

export type NewsIntent = keyof typeof NEWS_INTENTS

function isNewsIntent(value: string): value is NewsIntent {
  return Object.hasOwn(NEWS_INTENTS, value)
}

/**
 * 삭제 시각은 요청 시점으로 한 번만 만든다. 행마다 now() 를 부르면 같은 일괄
 * 처리인데 타임스탬프가 미세하게 갈려 감사 로그에서 한 묶음으로 읽히지 않는다.
 */
function intentPatch(intent: NewsIntent, now: Date): Partial<NewsSnapshotRow> {
  if (intent === 'hide' || intent === 'unhide') {
    return { is_hidden: intent === 'hide' }
  }

  return intent === 'delete' ? { deleted_at: now.toISOString() } : { deleted_at: null }
}

export async function newsStateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('news', 'write')
  const intent = readField(formData, 'intent')
  const ids = formData.getAll('ids').filter((value): value is string => typeof value === 'string')

  if (!isNewsIntent(intent)) {
    return { formError: '알 수 없는 요청입니다.' }
  }

  if (ids.length === 0) {
    return { formError: '대상을 선택해 주세요.' }
  }

  const supabase = await createClient()
  const { data: current } = await supabase
    .from('posts')
    .select(SNAPSHOT_COLUMNS)
    .eq('board', NEWS_BOARD)
    .in('id', ids)

  const patch = intentPatch(intent, new Date())
  const { error } = await supabase.from('posts').update(patch).eq('board', NEWS_BOARD).in('id', ids)

  if (error !== null) {
    console.error('[news] 상태 변경 실패', intent, error.message)

    /* 숨김 해제가 상단 고정 글을 한도 위로 되돌릴 수 있다 — DB 트리거
       (`guard_news_pin_limit`)가 막는다. 이 화면(일괄 처리 바)에는 필드가 없어
       formError 로만 안내한다. */
    return {
      formError: isPinLimitTriggerError(error.message)
        ? NEWS_PIN_LIMIT_MESSAGE
        : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }

  for (const row of current ?? []) {
    await writeAuditLog(actor.id, {
      action: NEWS_INTENTS[intent].action,
      targetTable: 'posts',
      targetId: row.id,
      before: toJson(newsAuditSnapshot(row)),
      after: toJson(newsAuditSnapshot({ ...row, ...patch })),
    })
  }

  revalidatePath(NEWS_PATH)
  await revalidateNewsList()

  return { message: `${ids.length}건을 ${NEWS_INTENTS[intent].done}` }
}
