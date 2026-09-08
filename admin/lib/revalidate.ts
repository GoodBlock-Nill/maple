import 'server-only'

/**
 * 사용자 사이트 캐시 무효화 호출부.
 *
 * 관리자와 사용자 사이트는 **별도 배포**다. Next 의 데이터 캐시는 프로세스마다
 * 따로 있으므로 관리자에서 `revalidateTag()` 를 불러도 사용자 사이트에는 아무
 * 일도 일어나지 않는다. 그래서 관리자가 쓰기를 마친 뒤 사용자 사이트의
 * `POST /api/revalidate` 를 직접 두드린다(계약은 그 라우트 주석 참고).
 *
 * 규칙 두 가지.
 *  1. **절대 던지지 않는다.** 무효화는 저장의 후처리다. 사용자 사이트가 죽어
 *     있거나 시크릿이 어긋나도 관리자 쓰기는 이미 성공했으므로, 실패는 경고만
 *     남기고 `{ ok: false }` 로 돌려준다. 여기서 예외가 새면 저장에 성공한
 *     운영자에게 "저장하지 못했습니다"가 뜬다.
 *  2. **관리자 전용 테이블에는 부르지 않는다.** 감사 로그·관리자 계정처럼
 *     사용자 사이트가 읽지 않는 데이터까지 태우면 남의 캐시를 이유 없이 비운다.
 */

const SECRET_HEADER = 'x-revalidate-secret'

const ENDPOINT_PATH = '/api/revalidate'

/**
 * 5초. 사용자 사이트가 응답하지 않을 때 서버 액션이 함께 멈추면 안 된다 —
 * 운영자는 이미 끝난 저장을 기다리게 된다.
 */
const TIMEOUT_MS = 5_000

/**
 * 사용자 사이트 `lib/data/cache.ts` 의 `CACHE_TAGS` 와 1:1 이어야 한다.
 * 여기 없는 이름을 보내면 그쪽이 400 으로 반려한다(오타 무효화 방지).
 *
 * 태그가 늘어나면(예: 약관) 사용자 사이트의 `CACHE_TAGS` 에 먼저 추가하고
 * 여기에 같은 값을 한 줄 더한다.
 */
export const CLIENT_CACHE_TAGS = {
  /** 커뮤니티 목록. 숨김 · 삭제 · 복구가 즉시 보이려면 태워야 한다. */
  communityList: 'community-list',
  /** FAQ. 발행 토글 · 순서 저장까지 포함한다. */
  faqs: 'faqs',
  /** 뉴스 목록. 발행 · 숨김 · 삭제 · 복구. */
  newsList: 'news-list',
  /** 확률형 아이템 목록과 상세. */
  gacha: 'gacha',
  /** 약관·정책 본문. 개정본 발행 · 회수처럼 사용자 문서가 바뀔 때만 태운다. */
  legal: 'legal',
  /** 랭킹 표(최신 스냅샷). */
  rankings: 'rankings',
  /** 사이트 설정 · 히어로 배너처럼 전 페이지에 드러나는 값. */
  site: 'site',
} as const

export type ClientCacheTag = (typeof CLIENT_CACHE_TAGS)[keyof typeof CLIENT_CACHE_TAGS]

export type RevalidateClientResult = { ok: boolean }

const FAILURE: RevalidateClientResult = { ok: false }

/**
 * 사용자 사이트 주소.
 *
 * 서버 전용 `CLIENT_SITE_URL` 을 먼저 본다. 로컬에서는 브라우저 링크용
 * `NEXT_PUBLIC_CLIENT_SITE_URL` 이 배포 도메인을 가리키는 일이 흔한데, 그대로
 * 쓰면 개발 중에 **운영 캐시**를 태우게 된다.
 */
function readBaseUrl(): string | null {
  /* 빈 문자열은 "없음"으로 본다. `?? ` 하나로 묶으면 `CLIENT_SITE_URL=` 로 비워 둔
     환경에서 뒤 후보로 넘어가지 않는다. */
  const candidates = [process.env.CLIENT_SITE_URL, process.env.NEXT_PUBLIC_CLIENT_SITE_URL]

  for (const candidate of candidates) {
    const trimmed = (candidate ?? '').trim().replace(/\/+$/, '')

    if (trimmed !== '') {
      return trimmed
    }
  }

  return null
}

function readSecret(): string | null {
  const secret = process.env.REVALIDATE_SECRET?.trim() ?? ''

  return secret === '' ? null : secret
}

/**
 * 사용자 사이트의 데이터 캐시 태그를 태운다.
 *
 * 호출부는 **쓰기가 성공한 뒤에만** 부르고, 결과를 검사하지 않아도 된다.
 * 실패하면 태그의 원래 수명(목록 60초 · 정적 300초)만큼 늦게 반영될 뿐이다.
 */
export async function revalidateClient(tags: readonly string[]): Promise<RevalidateClientResult> {
  const unique = [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag !== ''))]

  if (unique.length === 0) {
    return FAILURE
  }

  const baseUrl = readBaseUrl()
  const secret = readSecret()

  /* 설정이 비어 있는 환경(로컬 일부 · 미설정 배포)에서는 조용히 건너뛴다.
     운영자에게 보일 오류는 아니지만 로그에는 이유가 남아야 한다. */
  if (baseUrl === null || secret === null) {
    console.warn(
      '[revalidate] CLIENT_SITE_URL 또는 REVALIDATE_SECRET 이 없어 사용자 사이트 캐시를 비우지 못했습니다.',
      unique.join(','),
    )

    return FAILURE
  }

  try {
    const response = await fetch(`${baseUrl}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SECRET_HEADER]: secret },
      body: JSON.stringify({ tags: unique }),
      // 캐시를 비우는 요청 자체가 캐시되면 두 번째 저장이 반영되지 않는다.
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      console.warn('[revalidate] 사용자 사이트가 거부했습니다.', response.status, unique.join(','))

      return FAILURE
    }

    return { ok: true }
  } catch (error) {
    /* 타임아웃 · DNS · 연결 거부. 저장은 이미 끝났으므로 여기서 멈추지 않는다. */
    console.warn(
      '[revalidate] 사용자 사이트에 닿지 못했습니다.',
      error instanceof Error ? error.message : String(error),
      unique.join(','),
    )

    return FAILURE
  }
}
