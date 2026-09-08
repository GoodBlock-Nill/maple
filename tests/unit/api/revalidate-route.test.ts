import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CACHE_TAGS } from '@/lib/data/cache'

/**
 * `POST /api/revalidate` 계약 검증.
 *
 * 관리자 앱이 이 라우트를 호출하는 유일한 통로이므로, 실패 코드(401/400)가
 * 바뀌면 관리자 쪽 에러 처리가 조용히 어긋난다. 상태 코드까지 고정한다.
 */
const revalidateTag = vi.fn()

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string, profile: string) => {
    revalidateTag(tag, profile)
  },
}))

const SECRET = 'test-secret-value'

function request(body: unknown, secret?: string): Request {
  return new Request('http://localhost:3000/api/revalidate', {
    method: 'POST',
    headers: secret === undefined ? {} : { 'x-revalidate-secret': secret },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function post(body: unknown, secret?: string) {
  const { POST } = await import('@/app/api/revalidate/route')
  const response = await POST(request(body, secret))

  return { status: response.status, json: (await response.json()) as Record<string, unknown> }
}

beforeEach(() => {
  vi.resetModules()
  revalidateTag.mockClear()
  process.env.REVALIDATE_SECRET = SECRET
})

afterEach(() => {
  delete process.env.REVALIDATE_SECRET
})

describe('POST /api/revalidate', () => {
  it('should return 401 when the secret header is missing', async () => {
    const { status, json } = await post({ tags: ['site'] })

    expect(status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(json.error).toBeTypeOf('string')
  })

  it('should return 401 when the secret does not match', async () => {
    const { status } = await post({ tags: ['site'] }, 'wrong-secret-value')

    expect(status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('should return 401 when the server has no secret configured', async () => {
    // 미설정을 통과로 취급하면 누구나 캐시를 비울 수 있다.
    delete process.env.REVALIDATE_SECRET

    const { status } = await post({ tags: ['site'] }, SECRET)

    expect(status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('should return 400 when a tag is not one of the known cache tags', async () => {
    const { status, json } = await post({ tags: ['site', 'posts'] }, SECRET)

    expect(status).toBe(400)
    expect(json.error).toContain('posts')
    expect(json.allowed).toEqual(Object.values(CACHE_TAGS))
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('should return 400 when tags is empty or the wrong shape', async () => {
    expect((await post({ tags: [] }, SECRET)).status).toBe(400)
    expect((await post({ tags: 'site' }, SECRET)).status).toBe(400)
    expect((await post({}, SECRET)).status).toBe(400)
  })

  it('should return 400 when the body is not JSON', async () => {
    const { status } = await post('not json at all', SECRET)

    expect(status).toBe(400)
  })

  it('should revalidate each known tag with the max profile and echo them back', async () => {
    const { status, json } = await post({ tags: ['site', 'gacha'] }, SECRET)

    expect(status).toBe(200)
    expect(json.revalidated).toEqual(['site', 'gacha'])
    expect(revalidateTag).toHaveBeenCalledTimes(2)
    // Next 16 은 두 번째 인자가 필수다. 'max' = stale-while-revalidate.
    expect(revalidateTag).toHaveBeenCalledWith('site', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('gacha', 'max')
  })

  it('should accept every tag defined in lib/data/cache.ts', async () => {
    const tags = Object.values(CACHE_TAGS)
    const { status, json } = await post({ tags }, SECRET)

    expect(status).toBe(200)
    expect(json.revalidated).toEqual(tags)
  })

  it('should de-duplicate repeated tags', async () => {
    const { json } = await post({ tags: ['site', 'site'] }, SECRET)

    expect(json.revalidated).toEqual(['site'])
    expect(revalidateTag).toHaveBeenCalledTimes(1)
  })
})
