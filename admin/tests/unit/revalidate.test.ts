import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* `server-only` 는 서버 번들 밖에서 import 되면 던진다. 단위 테스트는 그 밖이다. */
vi.mock('server-only', () => ({}))

const { revalidateClient, CLIENT_CACHE_TAGS } = await import('@/lib/revalidate')

const SECRET = 'test-secret'
const SITE = 'http://localhost:3000'

function mockFetch(response: Partial<Response> | Error) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response),
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

type FetchMock = ReturnType<typeof mockFetch>

/** 첫 호출 인자. 호출이 없으면 실패시켜 이후 단언이 undefined 를 파고들지 않게 한다. */
function firstCall(fetchMock: FetchMock): [string, RequestInit] {
  const call = fetchMock.mock.calls[0]

  expect(call).toBeDefined()

  return [call?.[0] ?? '', call?.[1] ?? {}]
}

function okResponse(): Partial<Response> {
  return { ok: true, status: 200, json: () => Promise.resolve({ revalidated: [] }) }
}

beforeEach(() => {
  vi.stubEnv('REVALIDATE_SECRET', SECRET)
  vi.stubEnv('CLIENT_SITE_URL', SITE)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('revalidateClient', () => {
  it('should POST the tags with the shared secret header', async () => {
    const fetchMock = mockFetch(okResponse())

    const result = await revalidateClient([CLIENT_CACHE_TAGS.faqs, CLIENT_CACHE_TAGS.site])

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = firstCall(fetchMock)

    expect(url).toBe('http://localhost:3000/api/revalidate')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe(SECRET)
    expect(JSON.parse(String(init.body))).toEqual({ tags: ['faqs', 'site'] })
  })

  it('should send an abort signal so a hung client cannot stall the write', async () => {
    const fetchMock = mockFetch(okResponse())

    await revalidateClient([CLIENT_CACHE_TAGS.newsList])

    const [, init] = firstCall(fetchMock)

    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('should drop duplicate and blank tags before sending', async () => {
    const fetchMock = mockFetch(okResponse())

    await revalidateClient(['gacha', 'gacha', '  ', 'rankings'])

    const [, init] = firstCall(fetchMock)

    expect(JSON.parse(String(init.body))).toEqual({ tags: ['gacha', 'rankings'] })
  })

  it('should trim a trailing slash from the site url', async () => {
    vi.stubEnv('CLIENT_SITE_URL', 'https://example.com/')
    const fetchMock = mockFetch(okResponse())

    await revalidateClient(['site'])

    expect(firstCall(fetchMock)[0]).toBe('https://example.com/api/revalidate')
  })

  it('should prefer the server-only url over the public one', async () => {
    vi.stubEnv('CLIENT_SITE_URL', 'http://localhost:3000')
    vi.stubEnv('NEXT_PUBLIC_CLIENT_SITE_URL', 'https://production.example.com')
    const fetchMock = mockFetch(okResponse())

    await revalidateClient(['site'])

    expect(firstCall(fetchMock)[0]).toBe('http://localhost:3000/api/revalidate')
  })

  it('should fall back to the public url when the server-only one is unset', async () => {
    vi.stubEnv('CLIENT_SITE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_CLIENT_SITE_URL', 'https://production.example.com')
    const fetchMock = mockFetch(okResponse())

    await revalidateClient(['site'])

    expect(firstCall(fetchMock)[0]).toBe('https://production.example.com/api/revalidate')
  })

  it('should skip the call when no tag is given', async () => {
    const fetchMock = mockFetch(okResponse())

    const result = await revalidateClient([])

    expect(result).toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should skip the call when the secret is missing', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '')
    const fetchMock = mockFetch(okResponse())

    const result = await revalidateClient(['site'])

    expect(result).toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should skip the call when the site url is missing', async () => {
    vi.stubEnv('CLIENT_SITE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_CLIENT_SITE_URL', '')
    const fetchMock = mockFetch(okResponse())

    const result = await revalidateClient(['site'])

    expect(result).toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should report failure instead of throwing when the client rejects the secret', async () => {
    mockFetch({ ok: false, status: 401 })

    await expect(revalidateClient(['site'])).resolves.toEqual({ ok: false })
  })

  it('should report failure instead of throwing when the client is unreachable', async () => {
    mockFetch(new Error('fetch failed'))

    await expect(revalidateClient(['site'])).resolves.toEqual({ ok: false })
  })
})
