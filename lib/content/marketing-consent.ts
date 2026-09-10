import { CONTACT_EMAIL, SITE_NAME } from '@/lib/constants/site'

import type { PolicySection } from '@/lib/content/operating-policy/types'

/**
 * 마케팅 정보 수신 동의 안내 — 회원가입 [선택] 항목의 상세 문안.
 *
 * 다른 정책 문서와 같은 구조화 데이터(`PolicySection`)로 쓴다. 그래야 한 벌의
 * 문안이 세 곳에서 그대로 쓰인다.
 *   1) 회원가입 모달(`MarketingConsentDialog`)
 *   2) 정책 페이지 `/policy/marketing`
 *   3) DB 발행본 시드(`scripts/seed-legal.mjs` → 20260910000300 마이그레이션)
 *
 * 근거: 정보통신망법 제50조·시행령 제61조·제62조(광고성 정보 전송 제한과 표시
 * 방법), 개인정보 보호법 제15조·제22조(선택 동의 분리, 거부권 고지).
 */

/** 문서 정식 명칭. 회원가입 화면과 모달 제목이 이 값이다. */
export const MARKETING_CONSENT_TITLE = '마케팅 정보 수신 동의 (선택)'

/** `<h1>`·푸터 링크에 쓰는 짧은 이름. 회원가입 체크박스 라벨도 이 값이다. */
export const MARKETING_CONSENT_HEADING = '마케팅 정보 수신 동의'

export const MARKETING_CONSENT_DESCRIPTION =
  '글자월드가 보내는 마케팅 정보의 목적·항목·전송 방법과 동의 철회 방법을 안내합니다. 선택 동의이며 거부해도 서비스 이용에 제한이 없습니다.'

/** 모달 맨 위에 한 줄로 보여 주는 요약. 본문에는 싣지 않는다. */
export const MARKETING_CONSENT_SUMMARY =
  '이벤트·쿠폰·업데이트 소식을 이메일로 받아보기 위한 선택 동의입니다. 동의하지 않아도 서비스 이용에는 제한이 없습니다.'

export const MARKETING_CONSENT_EFFECTIVE_DATE = '2026년 9월 18일'

/** 개정본 버전. `legal_document_versions_version_format`(YYYYMMDD[-n])을 따른다. */
export const MARKETING_CONSENT_VERSION = '20260918-1'

export const MARKETING_CONSENT_SECTIONS: readonly PolicySection[] = [
  {
    id: 'section-1',
    number: 1,
    title: '동의의 성격과 근거 법령',
    blocks: [
      {
        kind: 'paragraph',
        text: `마케팅 정보 수신 동의는 선택 항목입니다. 동의하지 않아도 ${SITE_NAME} 회원가입과 서비스 이용에는 아무런 제한이 없습니다.`,
      },
      {
        kind: 'list',
        intro: '이 동의는 아래 법령에 따라 필수 동의와 분리해서 받습니다.',
        items: [
          '「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제50조(영리목적의 광고성 정보 전송 제한)',
          '같은 법 시행령 제61조(광고성 정보의 표시 방법)·제62조(수신동의 등의 처리)',
          '「개인정보 보호법」 제15조(개인정보의 수집·이용), 제22조(동의를 받는 방법)',
        ],
      },
      {
        kind: 'paragraph',
        text: '회원가입 화면은 이 항목을 [선택]으로 표시하고, 거부해도 불이익이 없다는 사실을 함께 알립니다.',
      },
    ],
  },
  {
    id: 'section-2',
    number: 2,
    title: '수집·이용 목적',
    blocks: [
      {
        kind: 'list',
        items: [
          `${SITE_NAME} 이벤트·업데이트·신규 콘텐츠 소식 안내`,
          '쿠폰·보상 지급 안내',
          '설문·프로모션 참여 안내',
        ],
      },
    ],
  },
  {
    id: 'section-3',
    number: 3,
    title: '수집·이용 항목',
    blocks: [
      {
        kind: 'list',
        intro: '마케팅 정보를 보내기 위해 아래 항목을 이용합니다.',
        items: [
          '이메일 주소(간편로그인 제공자에게서 받은 값)',
          '닉네임',
          '서비스 이용 기록(수신 여부와 수신거부 처리를 확인하기 위한 기록)',
        ],
      },
      {
        kind: 'paragraph',
        text: '휴대전화번호는 지금 수집하지 않습니다. SMS 발송은 번호를 따로 수집하고 별도 동의를 받은 뒤에만 이루어집니다.',
      },
    ],
  },
  {
    id: 'section-4',
    number: 4,
    title: '전송 방법',
    blocks: [
      { kind: 'paragraph', text: '현재 마케팅 정보는 이메일로만 보냅니다.' },
      {
        kind: 'paragraph',
        text: '앞으로 SMS나 앱 푸시를 도입하는 경우, 전송 방법과 수집 항목을 미리 알리고 다시 동의를 받은 뒤에 보냅니다.',
      },
    ],
  },
  {
    id: 'section-5',
    number: 5,
    title: '야간 전송 제한',
    blocks: [
      {
        kind: 'paragraph',
        text: '오후 9시부터 다음 날 오전 8시까지는 별도의 동의를 받지 않는 한 광고성 정보를 보내지 않습니다(정보통신망법 제50조 제3항).',
      },
    ],
  },
  {
    id: 'section-6',
    number: 6,
    title: '보유·이용 기간',
    blocks: [
      {
        kind: 'list',
        items: [
          '동의를 철회하면 그 즉시 발송 대상에서 제외합니다.',
          '회원 탈퇴로 개인정보가 파기될 때 함께 파기합니다.',
          '동의일부터 2년마다 수신 동의 여부를 다시 확인해 알립니다(정보통신망법 시행령 제62조의3).',
        ],
      },
    ],
  },
  {
    id: 'section-7',
    number: 7,
    title: '동의를 거부할 권리와 불이익 여부',
    blocks: [
      {
        kind: 'paragraph',
        text: '이 동의는 선택입니다. 거부해도 회원가입·글쓰기·댓글 등 서비스 이용에 제한이 없습니다.',
      },
      {
        kind: 'paragraph',
        text: '다만 동의하지 않으면 이벤트·쿠폰·업데이트 소식을 이메일로 받아볼 수 없습니다.',
      },
    ],
  },
  {
    id: 'section-8',
    number: 8,
    title: '동의 철회 방법',
    blocks: [
      {
        kind: 'list',
        items: [
          '마이페이지 > 계정 관리 > 마케팅 수신 설정에서 즉시 끌 수 있습니다.',
          '마케팅 메일 본문에 적힌 수신거부 방법으로도 철회할 수 있습니다.',
          `${CONTACT_EMAIL} 으로 요청해도 됩니다.`,
        ],
      },
      {
        kind: 'paragraph',
        text: '철회 요청을 받으면 지체 없이 처리하고 그 결과를 알립니다(정보통신망법 제50조 제6항).',
      },
    ],
  },
  {
    id: 'section-9',
    number: 9,
    title: '광고성 정보의 표기',
    blocks: [
      {
        kind: 'list',
        intro: '광고성 정보를 보낼 때는 정보통신망법 시행령 제61조에 따라 아래를 표시합니다.',
        items: [
          '제목 맨 앞에 "(광고)" 표시',
          `발신자 명칭(${SITE_NAME})과 연락처`,
          '수신거부 또는 수신동의 철회 방법을 본문에 알아보기 쉽게 표시',
        ],
      },
    ],
  },
  {
    id: 'section-10',
    number: 10,
    title: '시행일과 문의처',
    blocks: [
      {
        kind: 'list',
        items: [
          `시행일: ${MARKETING_CONSENT_EFFECTIVE_DATE}`,
          '개인정보 보호책임자: 글자월드 관리자',
          `문의: ${CONTACT_EMAIL}`,
        ],
      },
    ],
  },
]
