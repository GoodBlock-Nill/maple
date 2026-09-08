import type { PolicySection } from './types'

/** 6. 복구 정책 */
export const SECTION_06: PolicySection = {
  id: 'section-6',
  number: 6,
  title: '복구 정책',
  blocks: [],
  subsections: [
    {
      id: 'section-6-1',
      title: '6-1. 일반 복구',
      blocks: [
        {
          kind: 'paragraph',
          code: '[6-1-1]',
          text: '복구는 운영팀의 귀책 사유로 인한 유실에 한하여 진행되며, 게임 기록을 근거로 복구를 위해 노력합니다.',
        },
        {
          kind: 'list',
          intro: '[6-1-2] 복구가 불가능한 경우',
          items: [
            'PC 결함, 인터넷 접속 불안정 등 이용자 환경 문제로 인한 유실',
            '공식 공지를 확인하지 않아 발생한 피해',
            '이용자의 고의 또는 과실로 인한 손실',
          ],
        },
      ],
    },
  ],
}

/** 7. 환불 정책 */
export const SECTION_07: PolicySection = {
  id: 'section-7',
  number: 7,
  title: '환불 정책',
  blocks: [],
  subsections: [
    {
      id: 'section-7-1',
      title: '7-1. 캐시 아이템 청약철회',
      blocks: [
        {
          kind: 'list',
          intro:
            '[7-1-1] 캐시샵에서 구매한 아이템은 다음 조건을 모두 충족하는 경우에 한하여 환불(청약철회)이 가능합니다',
          items: [
            '구매 후 **7일 이내**에 고객센터를 통해 환불 신청',
            '아이템을 캐릭터 인벤토리로 이동(사용)하기 **이전**',
          ],
        },
        {
          kind: 'list',
          intro: '[7-1-2] 환불이 불가능한 경우:',
          items: [
            '구매 후 7일이 경과한 경우',
            '아이템을 수령(인벤토리 이동)하거나 사용한 경우',
            '기간제 아이템(사용 기간이 설정된 아이템)',
            '타인에게 선물하거나 2차 거래된 아이템',
          ],
        },
      ],
    },
  ],
}
