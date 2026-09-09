import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 서버 액션이 Supabase 원문을 화면으로 흘리지 않는지 확인한다.
 *
 * 원문에는 정책명·제약명·컬럼명이 그대로 들어 있어 운영자에게는 쓸모가 없고
 * 화면에 스키마를 드러낸다. 대표로 두 액션(FAQ 삭제 · 배너 삭제)을 잡아, 실패
 * 응답의 `formError` 가 **고정 문장**이고 원문은 로그에만 남는 것을 고정한다.
 */

const RAW_ERROR = 'permission denied for table faqs (policy "faqs_admin_all")'
const ACTOR = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: vi.fn(async () => ACTOR) }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/revalidate', () => ({
  CLIENT_CACHE_TAGS: { faqs: 'faqs', site: 'site' },
  revalidateClient: vi.fn(async () => undefined),
}))

/**
 * 조회는 성공하고 쓰기만 깨지는 상황. 이 두 액션은 대상을 먼저 읽어야 삭제까지
 * 도달하므로, `maybeSingle()` 은 행을 돌려주고 그 밖의 await 는 오류를 돌려준다.
 */
vi.mock('@/lib/supabase/server', () => {
  const builder: Record<string, unknown> = {
    maybeSingle: async () => ({ data: { id: 'row', title: '테스트 배너' }, error: null }),
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: null, count: 0, error: { message: RAW_ERROR, code: '42501' } }),
  }

  for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order']) {
    builder[method] = () => builder
  }

  return { createClient: async () => ({ from: () => builder }) }
})

const { deleteFaqAction } = await import('@/lib/actions/faqs-actions')
const { deleteHeroBannerAction } = await import('@/lib/actions/settings-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('서버 액션 실패 문구', () => {
  it('should keep the raw postgres message out of deleteFaqAction', async () => {
    const state = await deleteFaqAction(EMPTY_FORM_STATE, formData({ faqId: 'row' }))

    expect(state.formError).toBe(
      'FAQ를 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
    )
    expect(state.formError).not.toContain(RAW_ERROR)
    expect(state.formError).not.toContain('policy')
  })

  it('should keep the raw postgres message out of deleteHeroBannerAction', async () => {
    const state = await deleteHeroBannerAction(EMPTY_FORM_STATE, formData({ id: 'row' }))

    expect(state.formError).toBe(
      '배너를 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
    )
    expect(state.formError).not.toContain(RAW_ERROR)
  })

  it('should still log the raw cause for the developer', async () => {
    await deleteFaqAction(EMPTY_FORM_STATE, formData({ faqId: 'row' }))

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[faqs]'), RAW_ERROR)
  })
})
