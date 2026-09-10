import type { PolicySection } from '../operating-policy/types'

/** 11. 만 14세 미만 아동의 개인정보 */
export const SECTION_11: PolicySection = {
  id: 'section-11',
  number: 11,
  title: '만 14세 미만 아동의 개인정보',
  blocks: [
    {
      kind: 'paragraph',
      text: '운영자는 만 14세 미만 아동의 개인정보를 수집하지 않으며, 만 14세 미만 아동은 회원으로 가입할 수 없습니다. 만 14세 미만 아동의 가입 사실이 확인되는 경우 해당 계정과 개인정보를 지체 없이 삭제합니다.',
    },
  ],
}

/** 12. 개인정보 보호책임자 및 권익침해 구제 방법 */
export const SECTION_12: PolicySection = {
  id: 'section-12',
  number: 12,
  title: '개인정보 보호책임자 및 권익침해 구제 방법',
  blocks: [
    {
      kind: 'list',
      intro:
        '① 운영자는 개인정보 처리에 관한 업무를 총괄하고 관련 불만 처리 및 피해 구제를 위하여 아래와 같이 개인정보 보호책임자를 지정합니다.',
      items: ['담당자: 글자월드 관리자', '이메일: care@gjstory.com'],
    },
    {
      kind: 'paragraph',
      code: '②',
      text: '이용자는 서비스 이용 중 발생한 모든 개인정보 관련 문의, 불만, 피해 구제 요청을 위 연락처로 접수할 수 있으며, 운영자는 지체 없이 답변·처리합니다.',
    },
    {
      kind: 'table',
      code: '③',
      caption:
        '기타 개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의할 수 있습니다.',
      headers: ['기관', '연락처'],
      rows: [
        ['개인정보침해신고센터(한국인터넷진흥원)', '(국번 없이) 118 / privacy.kisa.or.kr'],
        ['개인정보분쟁조정위원회', '(국번 없이) 1833-6972 / www.kopico.go.kr'],
        ['대검찰청 사이버수사과', '(국번 없이) 1301 / www.spo.go.kr'],
        ['경찰청 사이버수사국', '(국번 없이) 182 / ecrm.police.go.kr'],
      ],
    },
  ],
}

/** 13. 개인정보처리방침의 변경 */
export const SECTION_13: PolicySection = {
  id: 'section-13',
  number: 13,
  title: '개인정보처리방침의 변경',
  blocks: [
    {
      kind: 'list',
      items: [
        '본 방침의 내용 추가, 삭제 및 수정이 있을 경우 시행 최소 7일 전에 서비스 공지사항을 통해 알립니다. 다만 수집 항목, 이용 목적 등 이용자 권리에 중요한 변경이 있는 경우에는 최소 30일 전에 알립니다.',
        '공고일자: 2026년 9월 8일 / 시행일자: 2026년 9월 18일',
      ],
    },
  ],
}
