import { z } from 'zod'

import { NEWS_CATEGORY_KEYS, NEWS_SUMMARY_MAX, NEWS_TITLE_MAX } from '@/lib/constants/news'

/**
 * 뉴스 작성/수정 폼 스키마.
 *
 * 서버 액션이 클라이언트 검증을 신뢰하지 않고 다시 파싱한다(액션은 UI 를 거치지
 * 않는 직접 POST 로도 호출된다). 폼은 같은 스키마의 메시지를 필드 밑에 그린다.
 */

/* ---------------------------------------------------------------------------
 * 예약 시각 — datetime-local(한국 시간) ↔ ISO(UTC)
 *
 * `<input type="datetime-local">` 은 타임존이 없는 "벽시계 문자열"을 준다. 이를
 * `new Date(value)` 로 그냥 파싱하면 **브라우저/서버의 로컬 타임존**으로 해석되어,
 * 운영자가 한국에서 입력한 시각과 UTC 로 도는 서버의 해석이 9시간 어긋난다.
 * 그래서 문자열을 직접 뜯어 KST(UTC+9) 로 고정 해석한다.
 * ------------------------------------------------------------------------ */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/u

/** `2026-09-08T17:30`(KST) → `2026-09-08T08:30:00.000Z`. 형식이 틀리면 null. */
export function kstLocalToIso(value: string): string | null {
  const match = LOCAL_DATETIME_PATTERN.exec(value.trim())

  if (match === null) {
    return null
  }

  /* `noUncheckedIndexedAccess` 아래에서 그룹은 `string | undefined` 다.
     Number(undefined) 는 NaN 이므로 아래 유한성 검사 하나로 함께 걸러진다. */
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])

  if (![year, month, day, hour, minute].every((part) => Number.isFinite(part))) {
    return null
  }

  /* 먼저 "KST 벽시계"를 UTC 필드에 그대로 담아 만든다. 여기서 offset 을 빼기 전에
     검사해야 날짜 굴림을 잡을 수 있다 — Date.UTC 는 2026-02-31 을 3월 3일로 조용히
     바꾸므로, 운영자의 오타가 엉뚱한 날 예약으로 저장되는 것을 막는다. */
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute))

  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day
  ) {
    return null
  }

  return new Date(wallClock.getTime() - KST_OFFSET_MS).toISOString()
}

/** ISO → `2026-09-08T17:30`(KST). 수정 화면의 datetime-local 초기값. */
export function isoToKstLocal(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + KST_OFFSET_MS)

  if (Number.isNaN(shifted.getTime())) {
    return ''
  }

  return shifted.toISOString().slice(0, 16)
}

/* ---------------------------------------------------------------------------
 * 스키마
 * ------------------------------------------------------------------------ */

export const NEWS_PUBLISH_MODES = ['draft', 'now', 'schedule'] as const

export type NewsPublishMode = (typeof NEWS_PUBLISH_MODES)[number]

export const newsFormSchema = z
  .object({
    categoryKey: z.enum(NEWS_CATEGORY_KEYS, { message: '카테고리를 선택해 주세요.' }),
    title: z
      .string()
      .trim()
      .min(1, '제목을 입력해 주세요.')
      .max(NEWS_TITLE_MAX, `제목은 ${NEWS_TITLE_MAX}자를 넘을 수 없습니다.`),
    /* 요약은 목록 카드의 두 줄 텍스트다. 비워 두면 카드가 제목만 보여 준다. */
    summary: z
      .string()
      .trim()
      .max(NEWS_SUMMARY_MAX, `요약은 ${NEWS_SUMMARY_MAX}자를 넘을 수 없습니다.`),
    content: z.string().trim().min(1, '본문을 입력해 주세요.'),
    publishMode: z.enum(NEWS_PUBLISH_MODES, { message: '발행 상태를 선택해 주세요.' }),
    scheduledAt: z.string().trim(),
    isPinned: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.publishMode !== 'schedule') {
      return
    }

    if (value.scheduledAt === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: '예약 발행 시각을 입력해 주세요.',
      })

      return
    }

    const iso = kstLocalToIso(value.scheduledAt)

    if (iso === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: '예약 시각 형식이 올바르지 않습니다.',
      })

      return
    }

    /* 과거 시각으로 예약하면 저장 즉시 공개된다(RLS 는 `published_at <= now()` 만
       본다). 운영자가 의도한 "예약"과 결과가 달라지므로 반려한다. */
    if (new Date(iso).getTime() <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduledAt'],
        message: '예약 시각은 현재보다 뒤여야 합니다.',
      })
    }
  })

export type NewsFormInput = z.infer<typeof newsFormSchema>

/* ---------------------------------------------------------------------------
 * 목록 필터 — 고정만 보기
 *
 * 상태 필터(`isNewsStatus`, `lib/constants/news.ts`)와 다른 축이라 별도 쿼리
 * 파라미터(`?pinned=1`)로 둔다. 뒤섞으면 "숨김이면서 고정"처럼 두 축이 겹치는
 * 글을 상태 필터 하나로는 걸러낼 수 없다.
 * ------------------------------------------------------------------------ */

const newsPinnedFilterSchema = z.enum(['0', '1']).transform((value) => value === '1')

/** `?pinned=1` → true. 없거나 다른 값이면 필터 없음(false)으로 떨어진다. */
export function parseNewsPinnedFilter(raw: string | null): boolean {
  const parsed = newsPinnedFilterSchema.safeParse(raw ?? '0')

  return parsed.success && parsed.data
}

/** 발행 설정 → `posts` 의 두 컬럼. 목록의 상태 판정과 짝을 이룬다. */
export type NewsPublishPlan = {
  isPublished: boolean
  publishedAt: string
}

/** 수정 시 참조하는 현재 발행 상태. 새 글이면 null 이다. */
export type NewsPublishState = NewsPublishPlan

export function resolvePublishPlan(
  input: Pick<NewsFormInput, 'publishMode' | 'scheduledAt'>,
  current: NewsPublishState | null = null,
  now: Date = new Date(),
): NewsPublishPlan {
  /* `published_at` 은 NOT NULL 이라 임시저장에도 값이 필요하다. 기존 값을 유지하면
     임시저장으로 내렸다가 다시 발행할 때 최초 발행일이 살아난다. */
  if (input.publishMode === 'draft') {
    return { isPublished: false, publishedAt: current?.publishedAt ?? now.toISOString() }
  }

  if (input.publishMode === 'schedule') {
    return {
      isPublished: true,
      publishedAt: kstLocalToIso(input.scheduledAt) ?? now.toISOString(),
    }
  }

  /* 즉시 발행: 이미 공개 중인 글은 최초 발행 시각을 지킨다. 오타 하나 고쳤다고
     발행일이 오늘로 바뀌면 독자에게는 새 글로 올라온 것처럼 보인다. */
  const keepsOriginal =
    current !== null &&
    current.isPublished &&
    new Date(current.publishedAt).getTime() <= now.getTime()

  return {
    isPublished: true,
    publishedAt: keepsOriginal ? current.publishedAt : now.toISOString(),
  }
}
