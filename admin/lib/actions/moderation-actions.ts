'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure, logFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import { bulkHideSchema, toggleContentSchema } from '@/lib/validation/moderation'

import type { ContentTable } from '@/lib/validation/moderation'

/**
 * 커뮤니티 조치 — 숨김/해제 · 삭제/복구 · 일괄 숨김.
 *
 * 모든 액션이 스스로 `requireAdmin()` 을 부른다. 레이아웃이 이미 막고 있어도 서버
 * 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다(Next 문서 경고).
 *
 * 쓰기는 전부 세션 클라이언트로 한다. `posts_update_admin` · `comments_admin_all`
 * 정책이 다시 검사하므로, 권한이 사라지면 조치도 함께 막혀야 정상이다.
 * (`guard_post_counters()` 는 `is_admin()` 일 때 통과하므로 관리자 수정은 되돌려지지 않는다.)
 */

const POSTS_PATH = '/community/posts'
const COMMENTS_PATH = '/community/comments'
const REPORTS_PATH = '/reports'

type ContentPatch = { is_hidden?: boolean; deleted_at?: string | null }

type ContentSnapshot = { isHidden: boolean; deletedAt: string | null }

/** 조치 전 상태. 감사 로그의 before 와 "이미 같은 상태"인지 판정에 쓴다. */
async function readSnapshots(
  table: ContentTable,
  ids: readonly string[],
): Promise<Map<string, ContentSnapshot>> {
  const supabase = await createClient()
  const columns = 'id, is_hidden, deleted_at'
  const { data } =
    table === 'posts'
      ? await supabase.from('posts').select(columns).in('id', ids)
      : await supabase.from('comments').select(columns).in('id', ids)

  return new Map(
    (data ?? []).map((row) => [row.id, { isHidden: row.is_hidden, deletedAt: row.deleted_at }]),
  )
}

async function applyPatch(
  table: ContentTable,
  ids: readonly string[],
  patch: ContentPatch,
): Promise<string | null> {
  const supabase = await createClient()
  const { error } =
    table === 'posts'
      ? await supabase
          .from('posts')
          .update(patch)
          .in('id', [...ids])
      : await supabase
          .from('comments')
          .update(patch)
          .in('id', [...ids])

  return error === null ? null : error.message
}

/**
 * 관리자 화면 + 사용자 사이트 목록을 함께 비운다.
 *
 * 상세는 세션 클라이언트로 매 요청 읽으므로 조치 즉시 404 가 되지만, 목록은
 * `unstable_cache`(60초)라 태우지 않으면 지운 글이 최대 1분간 남는다.
 * 사용자 사이트는 별도 배포라 `revalidateTag()` 가 닿지 않는다(lib/revalidate.ts).
 */
async function revalidateFor(table: ContentTable): Promise<void> {
  revalidatePath(table === 'posts' ? POSTS_PATH : COMMENTS_PATH)
  // 신고 큐는 대상의 숨김·삭제 상태를 함께 보여 준다.
  revalidatePath(REPORTS_PATH)
  await revalidateClient([CLIENT_CACHE_TAGS.communityList])
}

const LABEL: Record<ContentTable, string> = { posts: '게시글', comments: '댓글' }

/**
 * 대상 하나에 숨김 또는 삭제를 적용한다. 실패하면 사용자에게 보일 메시지를 돌려준다.
 *
 * 신고 처리(`reports-actions`)도 이 경로를 쓴다. `'use server'` 모듈의 export 는
 * 전부 액션 엔드포인트로 열리므로 **행위자를 인자로 받지 않는다** — 받으면 직접
 * POST 로 남의 이름을 적어 넣을 수 있다. 인가와 신원은 여기서 다시 확인한다.
 */
export async function moderateTarget(
  table: ContentTable,
  id: string,
  mode: 'hide' | 'delete',
): Promise<string | null> {
  const actor = await requireAdmin()
  const snapshot = (await readSnapshots(table, [id])).get(id)

  if (snapshot === undefined) {
    return `${LABEL[table]}${josa(LABEL[table], '을')} 찾을 수 없습니다.`
  }

  const patch: ContentPatch =
    mode === 'hide' ? { is_hidden: true } : { deleted_at: new Date().toISOString() }
  const error = await applyPatch(table, [id], patch)

  if (error !== null) {
    return logFailure(
      'community',
      `${LABEL[table]} 처리를 하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.`,
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: `community.${table === 'posts' ? 'post' : 'comment'}.${mode}`,
    targetTable: table,
    targetId: id,
    before: { is_hidden: snapshot.isHidden, deleted_at: snapshot.deletedAt },
    after: { ...patch },
  })
  await revalidateFor(table)

  return null
}

/** 숨김/해제 · 삭제/복구의 공통 처리. `field` 가 두 축 중 어느 쪽을 움직일지 정한다. */
async function toggleContent(
  table: ContentTable,
  field: 'hidden' | 'deleted',
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = toggleContentSchema.safeParse({
    id: readField(formData, 'id'),
    on: readField(formData, 'on'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { id, on } = parsed.data
  const snapshot = (await readSnapshots(table, [id])).get(id)

  if (snapshot === undefined) {
    return { formError: `${LABEL[table]}${josa(LABEL[table], '을')} 찾을 수 없습니다.` }
  }

  const patch: ContentPatch =
    field === 'hidden' ? { is_hidden: on } : { deleted_at: on ? new Date().toISOString() : null }

  const error = await applyPatch(table, [id], patch)

  if (error !== null) {
    return actionFailure(
      'community',
      `${LABEL[table]} 처리를 하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.`,
      error,
    )
  }

  const verb = field === 'hidden' ? (on ? 'hide' : 'unhide') : on ? 'delete' : 'restore'

  await writeAuditLog(actor.id, {
    action: `community.${table === 'posts' ? 'post' : 'comment'}.${verb}`,
    targetTable: table,
    targetId: id,
    before: { is_hidden: snapshot.isHidden, deleted_at: snapshot.deletedAt },
    after: { ...patch },
  })
  await revalidateFor(table)

  return { message: `${LABEL[table]}${josa(LABEL[table], '을')} ${VERB_LABEL[verb]}했습니다.` }
}

const VERB_LABEL: Record<'hide' | 'unhide' | 'delete' | 'restore', string> = {
  hide: '숨김 처리',
  unhide: '숨김 해제',
  delete: '삭제',
  restore: '복구',
}

/**
 * 일괄 숨김.
 *
 * 한 번의 액션 안에서 한 질의로 끝낸다. 클라이언트가 행마다 액션을 부르면 Next 가
 * 이를 **순차 디스패치**하므로(문서: sequential dispatch) 20건이 20왕복이 된다.
 */
async function bulkHide(table: ContentTable, formData: FormData): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = bulkHideSchema.safeParse({ ids: formData.getAll('ids').map(String) })

  if (!parsed.success) {
    return { formError: parsed.error.issues[0]?.message ?? '대상을 선택해 주세요.' }
  }

  const { ids } = parsed.data
  const snapshots = await readSnapshots(table, ids)
  // 이미 숨김이거나 삭제된 행은 건너뛴다. 감사 로그에 무의미한 변경이 쌓이지 않게 한다.
  const targets = ids.filter((id) => {
    const snapshot = snapshots.get(id)

    return snapshot !== undefined && !snapshot.isHidden && snapshot.deletedAt === null
  })

  if (targets.length === 0) {
    return { formError: '이미 처리된 항목만 선택되었습니다.' }
  }

  const error = await applyPatch(table, targets, { is_hidden: true })

  if (error !== null) {
    /* 한 질의로 끝내므로 전부 숨겨지거나 전부 그대로다. */
    return actionFailure(
      'community',
      '선택한 항목을 숨기지 못했습니다. 아무 항목도 바뀌지 않았습니다. 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: `community.${table === 'posts' ? 'post' : 'comment'}.bulk_hide`,
    targetTable: table,
    after: { ids: targets, count: targets.length },
  })
  await revalidateFor(table)

  return { message: `${LABEL[table]} ${targets.length}건을 숨김 처리했습니다.` }
}

export async function setPostHiddenAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return toggleContent('posts', 'hidden', formData)
}

export async function setPostDeletedAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return toggleContent('posts', 'deleted', formData)
}

export async function bulkHidePostsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return bulkHide('posts', formData)
}

export async function setCommentHiddenAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return toggleContent('comments', 'hidden', formData)
}

export async function setCommentDeletedAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return toggleContent('comments', 'deleted', formData)
}

export async function bulkHideCommentsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return bulkHide('comments', formData)
}
