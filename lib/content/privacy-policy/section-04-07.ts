import type { PolicySection } from '../operating-policy/types'

/** 제4조 개인정보의 제3자 제공 */
export const SECTION_04: PolicySection = {
  id: 'section-4',
  number: 4,
  title: '개인정보의 제3자 제공',
  blocks: [
    {
      kind: 'paragraph',
      text: '운영자는 이용자의 개인정보를 제1조·제2조에서 명시한 범위 내에서만 처리하며, 원칙적으로 이용자의 사전 동의 없이 제3자에게 제공하지 않습니다.',
    },
    {
      kind: 'list',
      intro: '다만, 다음의 경우에는 개인정보를 제공할 수 있습니다.',
      items: [
        '이용자가 사전에 동의한 경우',
        '관계 법령에 특별한 규정이 있는 경우',
        '수사기관 등이 관계 법령에 정해진 절차와 방법에 따라 요청한 경우',
      ],
    },
    {
      kind: 'paragraph',
      text: '향후 개인정보를 제3자에게 제공하게 되는 경우 제공받는 자, 제공 목적, 제공 항목 및 보유기간을 사전에 안내하고 필요한 동의를 받습니다.',
    },
  ],
}

/** 제5조 개인정보 처리업무의 위탁 */
export const SECTION_05: PolicySection = {
  id: 'section-5',
  number: 5,
  title: '개인정보 처리업무의 위탁',
  blocks: [
    {
      kind: 'table',
      caption:
        '운영자는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 외부 업체에 위탁하고 있습니다.',
      headers: ['수탁업체', '위탁업무'],
      rows: [
        ['Amazon Web Services, Inc.', '서버 운영 및 데이터 보관'],
        ['Sendbird, Inc.', '이메일 및 알림 발송'],
        ['(주)가비아(하이웍스)', '이메일 호스팅(문의 접수·답변 등 이메일 계정 운영 및 메일 보관)'],
      ],
    },
    {
      kind: 'paragraph',
      text: '운영자는 위탁계약 체결 시 관계 법령에 따라 개인정보 보호, 목적 외 처리 금지, 재위탁 제한, 안전성 확보조치 및 수탁업체에 대한 관리·감독 사항을 계약서 등에 명시합니다.',
    },
    {
      kind: 'paragraph',
      text: '수탁업체 또는 위탁업무가 변경되는 경우 본 개인정보처리방침을 통해 공개합니다.',
    },
  ],
}

/** 제6조 개인정보의 국외 이전 */
export const SECTION_06: PolicySection = {
  id: 'section-6',
  number: 6,
  title: '개인정보의 국외 이전',
  blocks: [
    {
      kind: 'paragraph',
      text: '운영자는 AWS 및 Sendbird의 실제 서버 리전과 계약 설정을 확인하여 개인정보가 국외로 이전되는 경우 이전받는 자, 이전 국가, 이전 항목, 이전 목적, 이전 일시와 방법, 보유기간 및 이전 거부 방법을 본 개인정보처리방침에 공개합니다.',
    },
    {
      kind: 'paragraph',
      text: 'AWS와 Sendbird가 모두 국내 리전으로 설정되어 개인정보가 국내에서만 처리되는 경우에는 개인정보를 국외로 이전하지 않습니다.',
    },
  ],
}

/** 제7조 개인정보의 파기 절차 및 방법 */
export const SECTION_07: PolicySection = {
  id: 'section-7',
  number: 7,
  title: '개인정보의 파기 절차 및 방법',
  blocks: [],
  subsections: [
    {
      id: 'section-7-1',
      title: '1. 파기 절차',
      blocks: [
        {
          kind: 'paragraph',
          text: '보유기간이 경과하거나 처리 목적이 달성된 개인정보는 파기 대상 정보를 확인한 후 개인정보 보호책임자의 승인에 따라 지체 없이 파기합니다. 회원 탈퇴 후 보존 기간(90일)이 지난 계정의 개인정보는 자동으로 파기합니다.',
        },
        {
          kind: 'paragraph',
          text: '다른 법령에 따라 개인정보를 보존해야 하는 경우에는 해당 개인정보를 별도의 저장 공간으로 옮겨 보존 기간 동안만 보관합니다.',
        },
      ],
    },
    {
      id: 'section-7-2',
      title: '2. 파기 방법',
      blocks: [
        {
          kind: 'list',
          items: [
            '전자적 파일 형태의 정보는 복구·재생할 수 없는 방법으로 영구 삭제합니다.',
            '출력물은 분쇄 또는 소각하여 파기합니다.',
          ],
        },
      ],
    },
  ],
}
