import type { FaqItem } from '@/types/domain'

/**
 * 자주 묻는 질문 목업 18건.
 * Phase 4에서 Supabase `faqs` 테이블로 교체된다.
 */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'faq-1',
    category: 'notice',
    question: '글자월드는 어떤 서비스인가요?',
    answer:
      '글자월드는 메이플스토리 월드 플랫폼에서 서비스되는 월드의 공식 홈페이지입니다. 공지사항, 패치노트, 이벤트 소식과 커뮤니티를 한곳에서 확인할 수 있습니다.',
  },
  {
    id: 'faq-2',
    category: 'notice',
    question: '정기 점검은 언제 진행되나요?',
    answer:
      '정기 점검은 매주 목요일 오전 9시부터 11시까지 진행됩니다. 임시 점검이 필요한 경우 공지사항과 디스코드로 미리 안내드립니다.',
  },
  {
    id: 'faq-3',
    category: 'notice',
    question: '업데이트 내용은 어디서 확인하나요?',
    answer: '뉴스 > 패치노트에서 회차별 변경 사항을 확인할 수 있습니다.',
  },
  {
    id: 'faq-4',
    category: 'notice',
    question: '이벤트 참여 기록은 어디에 남나요?',
    answer:
      '진행 중인 이벤트는 뉴스 > 이벤트에서 확인할 수 있으며, 참여 기록은 게임 내 이벤트 창에 표시됩니다.',
  },
  {
    id: 'faq-5',
    category: 'account',
    question: '글자월드 계정 ID는 어디서 확인하나요?',
    answer:
      '메이플스토리 월드 클라이언트에서 프로필 > 계정 정보를 열면 15자리 숫자로 된 계정 ID를 확인할 수 있습니다. 1:1 문의 시 이 값을 입력해 주세요.',
  },
  {
    id: 'faq-6',
    category: 'account',
    question: '닉네임을 변경할 수 있나요?',
    answer:
      '닉네임 변경권을 사용하면 30일에 한 번 변경할 수 있습니다. 변경 후에는 이전 닉네임으로 되돌릴 수 없습니다.',
  },
  {
    id: 'faq-7',
    category: 'account',
    question: '캐릭터를 삭제하면 복구할 수 있나요?',
    answer:
      '삭제 후 7일 이내에는 1:1 문의를 통해 복구를 요청할 수 있습니다. 7일이 지나면 복구가 불가능합니다.',
  },
  {
    id: 'faq-8',
    category: 'account',
    question: '계정 연동을 해제하고 싶어요.',
    answer:
      '연동 해제는 본인 확인이 필요하여 1:1 문의로만 접수하고 있습니다. 계정 ID와 함께 요청해 주세요.',
  },
  {
    id: 'faq-9',
    category: 'payment',
    question: '결제 취소는 어떻게 하나요?',
    answer:
      '미사용 상품에 한해 결제일로부터 7일 이내 취소가 가능합니다. 1:1 문의에 결제 영수증을 첨부해 주세요.',
  },
  {
    id: 'faq-10',
    category: 'payment',
    question: '결제했는데 아이템이 지급되지 않았어요.',
    answer:
      '결제 승인 후 최대 10분이 소요될 수 있습니다. 10분이 지나도 지급되지 않으면 결제 시각과 상품명을 남겨 문의해 주세요.',
  },
  {
    id: 'faq-11',
    category: 'payment',
    question: '영수증을 받을 수 있나요?',
    answer: '결제 내역은 메이플스토리 월드 계정의 구매 내역에서 발급받을 수 있습니다.',
  },
  {
    id: 'faq-12',
    category: 'bug',
    question: '게임이 자주 끊깁니다.',
    answer:
      '네트워크 상태와 클라이언트 버전을 먼저 확인해 주세요. 그래도 반복된다면 발생 시각과 채널 번호를 함께 알려 주시면 확인 후 안내드립니다.',
  },
  {
    id: 'faq-13',
    category: 'bug',
    question: '아이템이 사라졌어요.',
    answer:
      '사라진 아이템명과 마지막으로 확인한 시각을 알려 주세요. 서버 로그를 확인해 복구 여부를 안내드립니다.',
  },
  {
    id: 'faq-14',
    category: 'bug',
    question: '버그를 제보하면 보상이 있나요?',
    answer: '재현 가능한 신규 버그를 최초 제보해 주신 분께는 별도의 감사 보상을 지급하고 있습니다.',
  },
  {
    id: 'faq-15',
    category: 'etc',
    question: '불건전 이용자를 신고하고 싶어요.',
    answer:
      '1:1 문의에서 유형을 "신고"로 선택하고 대상 닉네임과 상황을 알 수 있는 스크린샷을 첨부해 주세요.',
  },
  {
    id: 'faq-16',
    category: 'etc',
    question: '제재 사유를 알려 주세요.',
    answer:
      '제재 사유와 기간은 계정 보호를 위해 본인 확인 후에만 안내드립니다. 계정 ID와 함께 문의해 주세요.',
  },
  {
    id: 'faq-17',
    category: 'etc',
    question: '문의 답변은 얼마나 걸리나요?',
    answer: '영업일 기준 1~2일 이내에 답변드립니다. 주말과 공휴일에는 답변이 지연될 수 있습니다.',
  },
  {
    id: 'faq-18',
    category: 'etc',
    question: '제휴나 광고 문의는 어디로 하나요?',
    answer: '제휴 문의는 푸터에 안내된 대표 메일로 보내 주세요.',
  },
]
