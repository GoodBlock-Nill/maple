import type { NewsCategory, NewsItem } from '@/types/domain'

/**
 * 뉴스 목업 22건 (공지 12 · 패치 6 · 이벤트 4).
 * Phase 4에서 Supabase `news` 테이블로 교체된다. 렌더 중 난수를 쓰지 않도록
 * 모든 값은 이 파일에 고정되어 있다.
 */

const BASE_DATE = Date.UTC(2026, 4, 19, 10, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000

/** 최신 글이 index 0. n일 전 09:00(KST) 시각을 만든다. */
function daysBefore(days: number): string {
  return new Date(BASE_DATE - days * DAY_MS).toISOString()
}

type NewsSeed = {
  category: NewsCategory
  title: string
  summary: string
  /** 본문 첫 문단. 나머지 문단은 카테고리별 템플릿으로 채운다. */
  lead: string
  views: number
  days: number
}

const BODY_TEMPLATE: Record<NewsCategory, string> = {
  notice: [
    '',
    '### 안내 사항',
    '',
    '- 적용 대상: 글자월드 전체 채널',
    '- 문의: 고객지원 게시판 또는 디스코드 `#문의` 채널',
    '',
    '> 진행 상황에 따라 일정이 조정될 수 있으며, 변경 시 본 공지를 통해 다시 안내드립니다.',
    '',
    '언제나 즐거운 모험이 될 수 있도록 최선을 다하겠습니다. 감사합니다.',
  ].join('\n'),
  patch: [
    '',
    '### 주요 변경 사항',
    '',
    '| 구분 | 내용 |',
    '| --- | --- |',
    '| 밸런스 | 사냥터별 경험치 획득량을 재조정했습니다. |',
    '| 편의성 | 반복 동선을 줄이는 이동 포탈을 추가했습니다. |',
    '| 버그 | 특정 조건에서 보상이 지급되지 않던 문제를 수정했습니다. |',
    '',
    '패치 적용 후에도 문제가 반복된다면 재현 경로와 함께 제보해 주세요.',
  ].join('\n'),
  event: [
    '',
    '### 참여 방법',
    '',
    '1. 이벤트 기간 중 글자월드에 접속합니다.',
    '2. 마을 NPC **이벤트 도우미**에게 말을 겁니다.',
    '3. 조건을 달성하면 보상이 자동으로 지급됩니다.',
    '',
    '> 보상은 계정당 1회만 지급되며, 부정한 방법으로 획득한 보상은 회수될 수 있습니다.',
  ].join('\n'),
}

const NEWS_SEEDS: readonly NewsSeed[] = [
  {
    category: 'notice',
    title: '서버 불안정 안내',
    summary: '안녕하세요, 메이플스토리 모험가 여러분. 현재 알려진 문제 현상에 대해 안내 드립니다.',
    lead: '일부 채널에서 접속이 지연되는 현상이 확인되어 원인을 파악하고 있습니다.',
    views: 160745,
    days: 0,
  },
  {
    category: 'patch',
    title: '5월 3주차 밸런스 패치 적용',
    summary: '사냥터 경험치와 일부 스킬 계수를 조정했습니다. 자세한 수치는 본문에서 확인해 주세요.',
    lead: '5월 3주차 정기 점검과 함께 밸런스 패치가 적용되었습니다.',
    views: 98213,
    days: 1,
  },
  {
    category: 'notice',
    title: '정기 점검 및 서버 안정화 작업 안내',
    summary: '매주 목요일 오전 정기 점검이 진행됩니다. 점검 중에는 접속이 제한됩니다.',
    lead: '보다 쾌적한 플레이 환경을 위해 정기 점검을 진행합니다.',
    views: 74120,
    days: 2,
  },
  {
    category: 'event',
    title: '벚꽃 축제 출석 이벤트',
    summary: '기간 중 매일 접속만 해도 벚꽃 코인을 드립니다. 코인으로 한정 코디를 교환하세요.',
    lead: '봄맞이 벚꽃 축제가 글자월드 광장에서 열립니다.',
    views: 132908,
    days: 3,
  },
  {
    category: 'notice',
    title: '비매너 이용자 제재 결과 안내',
    summary: '운영정책 위반 계정에 대한 제재를 진행했습니다. 신고해 주신 분들께 감사드립니다.',
    lead: '건전한 커뮤니티 유지를 위해 정기 제재를 시행했습니다.',
    views: 55402,
    days: 4,
  },
  {
    category: 'patch',
    title: '인벤토리 정렬 기능 추가',
    summary: '아이템을 종류·등급별로 자동 정렬하는 버튼이 추가되었습니다.',
    lead: '가장 많이 요청해 주신 인벤토리 편의 기능을 반영했습니다.',
    views: 41337,
    days: 5,
  },
  {
    category: 'notice',
    title: '개인정보처리방침 개정 안내',
    summary: '개인정보 보관 기간과 위탁 업체 정보가 일부 변경되어 미리 안내드립니다.',
    lead: '2026년 6월 1일부로 개인정보처리방침이 개정됩니다.',
    views: 20885,
    days: 6,
  },
  {
    category: 'event',
    title: '길드 대항전 시즌 2 개막',
    summary: '길드원과 함께 포인트를 모아 상위 길드에 도전하세요. 시즌 보상이 준비되어 있습니다.',
    lead: '길드 대항전 시즌 2가 시작되었습니다.',
    views: 87604,
    days: 7,
  },
  {
    category: 'notice',
    title: '아이템 복구 지원 종료 안내',
    summary: '한시적으로 운영하던 아이템 복구 지원이 5월 말로 종료됩니다.',
    lead: '복구 지원 정책 변경으로 접수 창구가 조정됩니다.',
    views: 18320,
    days: 8,
  },
  {
    category: 'patch',
    title: '보스 전투 연출 개선',
    summary: '보스 패턴 예고 이펙트를 다듬어 회피 타이밍을 알아보기 쉽게 했습니다.',
    lead: '보스 전투의 가독성을 높이는 개선을 적용했습니다.',
    views: 63971,
    days: 9,
  },
  {
    category: 'notice',
    title: '디스코드 서버 운영정책 개정',
    summary: '채널 구조 개편과 함께 운영정책 일부 조항이 변경되었습니다.',
    lead: '디스코드 커뮤니티 운영정책을 개정했습니다.',
    views: 12744,
    days: 10,
  },
  {
    category: 'event',
    title: '신규 모험가 성장 지원 프로젝트',
    summary: 'Lv.50 달성 시 성장 지원 상자를 드립니다. 복귀 모험가도 참여할 수 있습니다.',
    lead: '처음 오신 분들도 부담 없이 성장할 수 있도록 지원 프로젝트를 진행합니다.',
    views: 109556,
    days: 11,
  },
  {
    category: 'notice',
    title: '결제 오류 관련 보상 안내',
    summary: '일시적인 결제 오류로 불편을 겪으신 분들께 보상을 지급합니다.',
    lead: '결제 모듈 장애로 불편을 드려 죄송합니다.',
    views: 33218,
    days: 12,
  },
  {
    category: 'patch',
    title: '모바일 조작 UI 개편',
    summary: '가상 패드 위치와 크기를 직접 조절할 수 있게 되었습니다.',
    lead: '모바일 환경 조작감을 개선했습니다.',
    views: 47190,
    days: 13,
  },
  {
    category: 'notice',
    title: '서버 이전 작업 완료 안내',
    summary: '데이터센터 이전 작업이 정상적으로 완료되었습니다.',
    lead: '예정된 서버 이전 작업이 마무리되었습니다.',
    views: 25610,
    days: 14,
  },
  {
    category: 'event',
    title: '스크린샷 공모전 수상작 발표',
    summary: '총 1,204편의 응모작 중 수상작 12편을 선정했습니다.',
    lead: '많은 참여에 감사드리며 수상작을 발표합니다.',
    views: 71443,
    days: 15,
  },
  {
    category: 'notice',
    title: '월드 이름 변경 기능 임시 중단',
    summary: '데이터 정합성 점검을 위해 이름 변경 기능을 잠시 중단합니다.',
    lead: '이름 변경 기능에서 중복 처리 이슈가 확인되었습니다.',
    views: 15087,
    days: 16,
  },
  {
    category: 'patch',
    title: '사냥터 리소스 최적화',
    summary: '맵 로딩 시간을 줄이고 저사양 기기의 프레임을 안정화했습니다.',
    lead: '월드 전반의 리소스를 최적화했습니다.',
    views: 39002,
    days: 17,
  },
  {
    category: 'notice',
    title: '고객지원 답변 지연 안내',
    summary: '문의량 증가로 답변이 평소보다 지연되고 있습니다.',
    lead: '빠르게 답변드리지 못해 죄송합니다.',
    views: 9865,
    days: 18,
  },
  {
    category: 'patch',
    title: '친구·귓속말 기능 안정화',
    summary: '친구 목록이 갱신되지 않던 문제와 귓속말 유실 문제를 수정했습니다.',
    lead: '소셜 기능 관련 제보를 반영해 수정했습니다.',
    views: 28774,
    days: 19,
  },
  {
    category: 'notice',
    title: '홈페이지 정식 오픈',
    summary: '글자월드 공식 홈페이지가 문을 열었습니다. 앞으로 이곳에서 소식을 전해드립니다.',
    lead: '글자월드 공식 홈페이지가 오픈했습니다.',
    views: 210334,
    days: 20,
  },
  {
    category: 'notice',
    title: '월드 오픈 사전 예약 종료',
    summary: '사전 예약에 참여해 주신 모든 분께 감사드립니다. 보상은 오픈 후 지급됩니다.',
    lead: '사전 예약이 성황리에 마감되었습니다.',
    views: 188021,
    days: 21,
  },
]

export const NEWS_ITEMS: readonly NewsItem[] = NEWS_SEEDS.map((seed, index) => ({
  id: String(index + 1),
  category: seed.category,
  title: seed.title,
  summary: seed.summary,
  body: `${seed.lead}\n${BODY_TEMPLATE[seed.category]}`,
  views: seed.views,
  publishedAt: daysBefore(seed.days),
}))
