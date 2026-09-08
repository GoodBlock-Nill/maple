import type { PolicyAddendum, PolicySection } from './types'

/** 10. 이의신청 */
export const SECTION_10: PolicySection = {
  id: 'section-10',
  number: 10,
  title: '이의신청',
  blocks: [
    {
      kind: 'paragraph',
      code: '[10-1]',
      text: '게임 이용 제한에 이의가 있는 경우, **제재일로부터 15일 이내**에 고객센터를 통해 이의신청을 할 수 있습니다.',
    },
    {
      kind: 'paragraph',
      code: '[10-2]',
      text: '이의신청은 본인 명의의 계정에 한하여 가능하며, 타인을 대신한 이의신청은 접수되지 않습니다.',
    },
    {
      kind: 'paragraph',
      code: '[10-3]',
      text: '관련 게임 데이터의 보유 기간이 경과한 경우에는 이의신청이 불가능할 수 있습니다.',
    },
    {
      kind: 'list',
      intro: '[10-4] 이의신청이 접수되지 않는 경우:',
      items: [
        '**비인가 프로그램** 사용으로 인한 영구 이용제한',
        '타인의 개인정보 직접 유포로 인한 영구 이용제한',
        '계정 도용으로 인한 영구 이용제한',
      ],
    },
    {
      kind: 'list',
      intro: '[10-5] 이의신청 시 필요 정보:',
      items: [
        '이메일 주소',
        '계정 ID 또는 고유번호',
        '캐릭터 닉네임',
        '제재 관련 상세 내용 및 소명 자료',
      ],
    },
  ],
}

/** 목차에는 없는 말미의 부칙. */
export const ADDENDUM: PolicyAddendum = {
  title: '부칙',
  items: [
    '본 운영정책은 2026년 9월 18일 오픈 시점부터 효력이 발생합니다.',
    '정책 변경 시 공식 홈페이지 및 디스코드를 통해 사전 안내합니다.',
    '긴급한 경우 사후 안내가 이루어질 수 있습니다.',
  ],
}
