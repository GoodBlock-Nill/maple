import { beforeEach, describe, expect, it, vi } from 'vitest'

/** `lib/data/legal.ts` 는 `lib/supabase/public.ts` 를 거쳐 `server-only` 를 임포트한다. */
vi.mock('server-only', () => ({}))

/* `unstable_cache` 는 Next 요청 문맥 밖(vitest)에서 캐시 저장소를 찾지 못해 던진다.
   캐시 적중이 아니라 매핑을 검증하는 테스트라 항등 함수로 대체한다. */
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

type RpcResult = { data: unknown; error: { message: string } | null }

const rpc = vi.fn<(name: string, args: Record<string, string>) => Promise<RpcResult>>()

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({ rpc }) }))

const { formatEffectiveDate, getLegalDocument, isLegalSlug, LEGAL_SLUGS } = await import(
  '@/lib/data/legal'
)

const ROW = {
  slug: 'privacy',
  title: '글자월드 개인정보처리방침',
  version: '20260918',
  effective_date: '2026-09-18',
  content_html: '<h2>1. 총칙</h2><p>본문</p>',
  summary: '최초 발행본',
  published_at: '2026-09-08T00:00:00Z',
}

beforeEach(() => {
  rpc.mockReset()
})

describe('formatEffectiveDate', () => {
  it('should render the korean date the code fallback already shows', () => {
    expect(formatEffectiveDate('2026-09-18')).toBe('2026년 9월 18일')
  })

  it('should drop the leading zero on month and day', () => {
    expect(formatEffectiveDate('2026-01-05')).toBe('2026년 1월 5일')
  })

  it('should return the input untouched when it is not a date', () => {
    expect(formatEffectiveDate('나중에')).toBe('나중에')
  })
})

describe('isLegalSlug', () => {
  it('should accept exactly the three managed documents', () => {
    expect(LEGAL_SLUGS).toEqual(['privacy', 'discord', 'operating'])
    expect(isLegalSlug('privacy')).toBe(true)
    expect(isLegalSlug('terms')).toBe(false)
  })
})

describe('getLegalDocument', () => {
  it('should map the current version row onto the view model', async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null })

    await expect(getLegalDocument('privacy')).resolves.toEqual({
      title: '글자월드 개인정보처리방침',
      version: '20260918',
      effectiveDate: '2026-09-18',
      contentHtml: '<h2>1. 총칙</h2><p>본문</p>',
      summary: '최초 발행본',
    })
    expect(rpc).toHaveBeenCalledWith('current_legal_version', { p_slug: 'privacy' })
  })

  it('should sanitise the stored html again on the way out', async () => {
    rpc.mockResolvedValue({
      data: [{ ...ROW, content_html: '<p>본문</p><script>alert(1)</script>' }],
      error: null,
    })

    await expect(getLegalDocument('privacy')).resolves.toMatchObject({
      contentHtml: '<p>본문</p>',
    })
  })

  it('should fall back to null when nothing is published', async () => {
    rpc.mockResolvedValue({ data: [], error: null })

    await expect(getLegalDocument('discord')).resolves.toBeNull()
  })

  /* 약관 페이지는 DB 사정과 무관하게 열려야 한다. 조회 실패를 던지면 폴백까지
     같이 죽는다. */
  it('should fall back to null when the query fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await expect(getLegalDocument('operating')).resolves.toBeNull()
  })
})
