import { CONTACT_EMAIL, COPYRIGHT, IP_NOTICE, SITE_NAME } from '@/lib/constants/site'
import { CREATOR_INTRO_TEXT, CREATOR_NAME, CREATOR_SLOGAN } from '@/lib/mock/site'
import { toEmailLink } from '@/lib/utils/email'
import { splitParagraphs } from '@/lib/utils/paragraphs'

import type { SiteSettings } from '@/types/domain'

/**
 * `site_settings` 한 행 → 화면이 바로 쓸 수 있는 값.
 *
 * DB 가 단일 출처지만 칸은 언제든 비어 있을 수 있다(관리자가 아직 안 채웠거나,
 * 설정 행 조회 자체가 실패했거나). "빈 값이면 상수로 떨어진다"는 규칙을 화면
 * 곳곳에 흩뿌리면 폴백이 있는 칸과 없는 칸이 생긴다 — 그 합류를 여기 한 곳에서
 * 끝낸다. 화면은 이 함수들의 결과만 렌더한다.
 *
 * 순수 함수만 둔다(서버 컴포넌트가 아니어도 단위 테스트로 검증 가능해야 한다).
 * DB 접근은 `lib/data/site.ts` 의 `getSiteSettings()` 담당이다.
 */

/** `null`·빈 문자열·공백만 있는 문자열을 모두 "값 없음"으로 본다. */
function orFallback(value: string | null | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()

  return trimmed.length === 0 ? fallback : trimmed
}

export type ContactEmailView = {
  /** 화면 표기(한글 도메인 그대로). */
  display: string
  /** `mailto:` href (ASCII 도메인). */
  href: string
}

/**
 * 연락처 이메일.
 *
 * 저장값이 한글 도메인이든 Punycode 든 화면은 한글, 링크는 ASCII 로 통일한다.
 * 관리자가 어느 형태로 입력해도 결과가 같아야 하기 때문이다.
 */
export function resolveContactEmail(settings: SiteSettings | null): ContactEmailView {
  return toEmailLink(orFallback(settings?.contactEmail, CONTACT_EMAIL))
}

/** 푸터 저작권 한 줄. DB 값은 "Copyright ©" 접두어까지 포함한 완성 문장이다. */
export function resolveCopyright(settings: SiteSettings | null): string {
  return orFallback(settings?.copyright, COPYRIGHT)
}

/** 개인정보처리방침 하단의 지식재산권 고지. */
export function resolveIpNotice(settings: SiteSettings | null): string {
  return orFallback(settings?.ipNotice, IP_NOTICE)
}

/** 메타데이터·타이틀에 쓰는 서비스 이름. */
export function resolveGameName(settings: SiteSettings | null): string {
  return orFallback(settings?.gameName, SITE_NAME)
}

export type CreatorView = {
  name: string
  slogan: string
  /** 빈 줄로 나뉜 문단들. 문단 안 줄바꿈은 시안 그대로 유지된다. */
  intro: readonly string[]
  /** 원격 사진 URL. `null` 이면 화면이 로컬 시안 자산으로 폴백한다. */
  photoUrl: string | null
}

export function resolveCreator(settings: SiteSettings | null): CreatorView {
  const photoUrl = orFallback(settings?.creatorPhotoUrl, '')

  return {
    name: orFallback(settings?.creatorName, CREATOR_NAME),
    slogan: orFallback(settings?.creatorSlogan, CREATOR_SLOGAN),
    intro: splitParagraphs(orFallback(settings?.creatorIntro, CREATOR_INTRO_TEXT)),
    photoUrl: photoUrl === '' ? null : photoUrl,
  }
}

/**
 * 소개 페이지 히어로 영상.
 *
 * 푸터 `/sns/youtube` 와 **같은 칸**(`youtube_url`)을 읽는다. 채널 주소처럼
 * 영상 ID 를 뽑을 수 없는 값이면 호출부의 `extractYoutubeId()` 가 null 을 돌려
 * 중립 포스터로 폴백한다 — 무관한 영상을 틀어 주는 것보다 안전하다.
 * 그래서 여기서는 채널 폴백(`YOUTUBE_URL_FALLBACK`)을 끼워 넣지 않는다.
 */
export function resolveAboutVideoUrl(settings: SiteSettings | null): string {
  return orFallback(settings?.youtubeUrl, '')
}
