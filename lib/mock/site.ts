/**
 * 소개 페이지가 쓰는 `site_settings.creator_*` 목업.
 * Phase 4에서 Supabase `site_settings` 단일 행으로 교체된다.
 */

export const CREATOR_NAME = '세글자'

export const CREATOR_SLOGAN = '메이플스토리의 역사를 함께해 온 2세대 최초 만렙 크리에이터!'

/** 시안 텍스트 그대로. 뒤 두 단락은 확정 전 플레이스홀더다. */
export const CREATOR_INTRO: readonly string[] = [
  "크리에이터 '팡이요'와 어깨를 나란히 하며 오랜 시간\n메이플스토리 콘텐츠를 이끌어온 유서 깊은 크리에이터입니다.",
  "'타락파워전사'의 뒤를 이어, 메이플스토리 역사상\n'2세대 최초 만렙 달성자' 라는 기록을 보유하고 있습니다.",
  '설명 소개가 들어갈 자리입니다.설명 소개가 들어갈 자리입니다.\n설명 소개가 들어갈 자리입니다.설명 소개가 들어갈 자리입니다.',
  '상세 소개가 들어갈 자리입니다.상세 소개가 들어갈 자리입니다.\n상세 소개가 들어갈 자리입니다.상세 소개가 들어갈 자리입니다.',
]

/**
 * TODO: site_settings.youtube_url 로 교체 예정인 크리에이터 소개 영상 주소.
 * 실제 채널 영상 주소를 받으면 이 값만 바꾸면 된다. 비워 두면 히어로가
 * 중립 포스터(어두운 그라데이션 + 재생 마크)로 폴백한다 — 무관한 영상을
 * 플레이스홀더로 두는 것보다 안전하다.
 */
export const CREATOR_YOUTUBE_URL = ''

export const CREATOR_VIDEO_TITLE = `${CREATOR_NAME} 크리에이터 소개 영상`
