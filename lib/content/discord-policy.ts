import type { PolicyNotice, PolicySection } from './operating-policy/types'

export type { PolicyBlock, PolicyNotice, PolicySection } from './operating-policy/types'

/**
 * 글자월드 공식 디스코드 운영정책 구조화 데이터.
 *
 * 운영자가 2026-09-11에 확정한 문안(원문은 `:one:`~`:keycap_ten:` 이모지 번호를 쓴
 * 디스코드 채널 공지)을 그대로 옮기되, 다른 정책과 같은 `PolicySection`/`PolicyBlock`
 * 구조로 재배치한다. 이모지 번호는 화면·HTML 어디에도 나오지 않으므로 조항 번호
 * (`[2-1]` 등)로 바꾼다. `PolicySection`/`PolicyBlock` 타입과 렌더러
 * (`components/policy/*`, `lib/content/policy-to-html.ts`)는 `operating-policy`,
 * `privacy-policy` 와 동일하게 재사용한다.
 *
 * 환영 인사 세 줄은 첫머리 고지(`DISCORD_POLICY_NOTICE`)로 그대로 두고, 1장은 그중
 * 뒤 두 줄을 다른 정책과 같은 조항 문장체로 다시 쓴 것이다 — 원문에 없는 규칙을
 * 새로 만들지 않는다.
 */
export const DISCORD_POLICY_TITLE = '글자월드 디스코드 운영정책'

/** 운영자가 문안을 확정한 날. */
export const DISCORD_POLICY_EFFECTIVE_DATE = '2026년 9월 11일'

/**
 * 문서 버전 쿼리 파라미터. 개정본이 추가되면 버전 선택 UI가 이 값을 늘린다.
 * `-1`: 운영자 확정 문안 최초 반영(2026-09-11). 그 전까지 있던 "정식 운영정책
 *       문안은 준비 중입니다" 안내 문단을 대체한다.
 */
export const DISCORD_POLICY_VERSION = '20260911-1'

/**
 * 채널 상단 환영 인사 세 줄. 장(章)이 아니므로 목차에는 오르지 않는다
 * (`operating-policy/notice.ts`, `privacy-policy/notice.ts` 와 같은 규칙).
 */
export const DISCORD_POLICY_NOTICE: PolicyNotice = {
  lines: [
    '글자월드 공식 디스코드에 오신 것을 환영합니다.',
    '본 서버는 글자월드 이용자들이 자유롭게 소통하고 정보를 나누는 공간입니다.',
    '모든 멤버는 아래 운영정책을 숙지하고 준수해 주시기 바랍니다.',
  ],
}

/** 1. 기본 원칙 — 고지 뒤 두 줄을 조항 문장체로 옮긴 것. 새 규칙을 더하지 않는다. */
const SECTION_01: PolicySection = {
  id: 'section-1',
  number: 1,
  title: '기본 원칙',
  blocks: [
    {
      kind: 'paragraph',
      code: '[1-1]',
      text: '본 서버는 글자월드 이용자들이 자유롭게 소통하고 정보를 나누는 공간입니다.',
    },
    {
      kind: 'paragraph',
      code: '[1-2]',
      text: '모든 멤버는 본 운영정책을 숙지하고 준수해야 합니다.',
    },
  ],
}

/** 2. 금지행위 — 원문 10개 항목을 순서 그대로 옮긴다. */
const SECTION_02: PolicySection = {
  id: 'section-2',
  number: 2,
  title: '금지행위',
  blocks: [
    {
      kind: 'paragraph',
      code: '[2-1]',
      text: '욕설, 비속어, 혐오 발언, 차별적 표현 사용을 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-2]',
      text: '특정 유저를 비방, 모욕, 괴롭히는 행위를 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-3]',
      text: '도배 행위를 금지합니다. 동일하거나 유사한 메시지·이모지의 반복 전송을 포함합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-4]',
      text: '타 서버, 외부 커뮤니티, SNS, 상업적 광고 링크 무단 공유를 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-5]',
      text: '타인의 개인정보 유출 또는 공유를 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-6]',
      text: '저작권이 있는 콘텐츠 무단 게시를 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-7]',
      text: '허위 정보 유포, 운영진 또는 타인 사칭 행위를 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-8]',
      text: '게임 내 버그, 취약점, 핵·매크로 등 불법 프로그램 정보 공유를 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-9]',
      text: '커뮤니티 기준에 부합하지 않는 닉네임, 프로필 사진 사용을 금지합니다.',
    },
    {
      kind: 'paragraph',
      code: '[2-10]',
      text: '미성년자를 포함한 모든 유저에 대한 성적·불건전한 표현 및 행위를 금지합니다.',
    },
  ],
}

/** 3. 제재 */
const SECTION_03: PolicySection = {
  id: 'section-3',
  number: 3,
  title: '제재',
  blocks: [
    {
      kind: 'paragraph',
      code: '[3-1]',
      text: '위 항목에 해당하는 댓글, 이미지 등의 불건전한 정도에 따라 구체적으로 해당되지 않는 사항이라도 기타 사회 통념상 수용하기 어려운 글 등록, 업로드 하거나 서버 운영에 지장을 초래할 경우 별도의 경고 없이 서버에서 추방 또는 영구 차단될 수 있습니다.',
    },
  ],
}

/**
 * 4. 기타 — Discord 커뮤니티 가이드라인 안내.
 *
 * `policy-to-html`/`PolicyInlineText` 는 `**굵게**` 표기 하나만 인라인 서식으로
 * 다루고 링크 변환 기능이 없다(운영정책·개인정보처리방침도 URL 을 평문으로 둔다,
 * 예: `PRIVACY_POLICY_NOTICE`의 `https://www.gjstory.com`). 그 규칙을 그대로 따라
 * URL 을 일반 텍스트로 둔다.
 */
const SECTION_04: PolicySection = {
  id: 'section-4',
  number: 4,
  title: '기타',
  blocks: [
    {
      kind: 'paragraph',
      code: '[4-1]',
      text: "이용규칙에 포함되지 않는 내용은 Discord에서 제공되는 'Discord 커뮤니티 가이드라인' (https://discord.com/guidelines) 을 따릅니다.",
    },
  ],
}

export const DISCORD_POLICY_SECTIONS: readonly PolicySection[] = [
  SECTION_01,
  SECTION_02,
  SECTION_03,
  SECTION_04,
]
