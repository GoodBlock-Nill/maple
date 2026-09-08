import { splitParagraphs } from '@/lib/utils/paragraphs'

/**
 * 소개 페이지 크리에이터 정보(`site_settings.creator_*`)의 **폴백**.
 *
 * 단일 출처는 DB 다. 설정 행을 못 읽거나 해당 칸이 비어 있을 때만 여기 값이
 * 쓰인다(`lib/data/site-view.ts`). 파일 경로가 `mock/` 인 것은 도입 당시의
 * 잔재이며, 지금 이 값들의 역할은 목업이 아니라 폴백이다.
 */

export const CREATOR_NAME = '세글자'

export const CREATOR_SLOGAN = '메이플스토리의 역사를 함께해 온 2세대 최초 만렙 크리에이터!'

/**
 * 시안 텍스트 그대로. 뒤 두 단락은 확정 전 플레이스홀더다.
 *
 * DB(`creator_intro`)는 문단을 빈 줄로 구분한 **한 덩어리 텍스트**다. 폴백도
 * 같은 형태로 두고 같은 함수로 쪼개야, 폴백일 때와 DB 값일 때의 렌더 결과가
 * 어긋나지 않는다.
 */
export const CREATOR_INTRO_TEXT = `크리에이터 '팡이요'와 어깨를 나란히 하며 오랜 시간
메이플스토리 콘텐츠를 이끌어온 유서 깊은 크리에이터입니다.

'타락파워전사'의 뒤를 이어, 메이플스토리 역사상
'2세대 최초 만렙 달성자' 라는 기록을 보유하고 있습니다.

설명 소개가 들어갈 자리입니다.설명 소개가 들어갈 자리입니다.
설명 소개가 들어갈 자리입니다.설명 소개가 들어갈 자리입니다.

상세 소개가 들어갈 자리입니다.상세 소개가 들어갈 자리입니다.
상세 소개가 들어갈 자리입니다.상세 소개가 들어갈 자리입니다.`

export const CREATOR_INTRO: readonly string[] = splitParagraphs(CREATOR_INTRO_TEXT)

export const CREATOR_VIDEO_TITLE = `${CREATOR_NAME} 크리에이터 소개 영상`
