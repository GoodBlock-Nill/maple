import type { PolicySection } from '../operating-policy/types'

/** 제12조 개인정보 보호책임자 및 열람청구 */
export const SECTION_12: PolicySection = {
  id: 'section-12',
  number: 12,
  title: '개인정보 보호책임자 및 열람청구',
  blocks: [
    {
      kind: 'paragraph',
      text: '운영자는 개인정보 처리 업무를 총괄하고 이용자의 문의 및 피해구제를 처리하기 위해 개인정보 보호책임자를 지정하고 있습니다.',
    },
  ],
  subsections: [
    {
      id: 'section-12-1',
      title: '개인정보 보호책임자',
      blocks: [{ kind: 'list', items: ['담당자: 글자월드 관리자', '이메일: care@gjstory.com'] }],
    },
    {
      id: 'section-12-2',
      title: '개인정보 열람청구 접수·처리 부서',
      blocks: [
        { kind: 'list', items: ['담당 부서: 운영팀', '이메일: care@gjstory.com'] },
        /* 원문에서 이 문단은 두 소제목 뒤에 오는 조문 말미다. 절(節) 뒤에 다시
           본문을 둘 수 없는 구조라 마지막 절 안에 담는다 — 화면 순서는 원문과 같다. */
        {
          kind: 'paragraph',
          text: '이용자는 서비스 이용 중 발생한 개인정보 관련 문의, 불만 및 피해구제 요청을 위 연락처로 접수할 수 있으며, 운영자는 지체 없이 답변·처리합니다.',
        },
      ],
    },
  ],
}

/** 제13조 권익침해 구제방법 */
export const SECTION_13: PolicySection = {
  id: 'section-13',
  number: 13,
  title: '권익침해 구제방법',
  blocks: [
    {
      kind: 'table',
      caption: '개인정보 침해에 대한 신고나 상담이 필요한 경우 다음 기관에 문의할 수 있습니다.',
      headers: ['기관', '연락처'],
      rows: [
        ['개인정보침해신고센터(한국인터넷진흥원)', '(국번 없이) 118 / https://privacy.kisa.or.kr'],
        ['개인정보분쟁조정위원회', '(국번 없이) 1833-6972 / https://www.kopico.go.kr'],
        ['경찰청 사이버수사국', '(국번 없이) 182 / https://ecrm.police.go.kr'],
      ],
    },
  ],
}

/** 제14조 개인정보처리방침의 변경 */
export const SECTION_14: PolicySection = {
  id: 'section-14',
  number: 14,
  title: '개인정보처리방침의 변경',
  blocks: [
    {
      kind: 'paragraph',
      text: '본 방침의 내용이 추가·삭제·수정되는 경우 시행일로부터 최소 7일 전에 서비스 공지사항을 통해 안내합니다. 다만 수집 항목, 이용 목적 등 이용자 권리에 중대한 영향을 미치는 변경사항은 시행일로부터 최소 30일 전에 안내합니다.',
    },
    {
      kind: 'list',
      items: ['공고일: 2026.09.18', '시행일: 2026.09.18'],
    },
  ],
}
