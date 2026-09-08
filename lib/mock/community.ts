import { COMMUNITY_CATEGORIES } from '@/lib/constants/board'

import type { Comment, CommunityCategory, Post } from '@/types/domain'

/**
 * 커뮤니티 목업 100건.
 *
 * 렌더마다 값이 흔들리면 하이드레이션 불일치가 나므로 `Math.random` 대신
 * 고정 시드 PRNG(mulberry32)로 조회수·좋아요·댓글을 생성한다.
 * Phase 4에서 Supabase `posts` / `comments` 테이블로 교체된다.
 */

const POST_COUNT = 100
const SEED = 20260519
const BASE_DATE = Date.UTC(2026, 4, 19, 10, 0, 0)
const HOUR_MS = 60 * 60 * 1000

function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(SEED)

function pick<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index % items.length]

  if (item === undefined) {
    throw new Error('빈 배열에서는 값을 고를 수 없습니다.')
  }

  return item
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

const TITLES: Record<CommunityCategory, readonly string[]> = {
  chat: [
    '최근 고의적으로 인기도 내리는 사람 주의,,',
    '오늘 길드 사냥 같이 가실 분',
    '드디어 200 찍었습니다',
    '이 코디 어떤가요',
    '새벽에 접속하면 사람 거의 없네요',
    '복귀했는데 다들 어디서 사냥하나요',
    '보스 잡다가 실수로 나가버림',
    '메이플 처음 시작할 때 생각나네요',
  ],
  question: [
    '계정 날아감,,',
    '스킬 포인트 잘못 찍었는데 초기화 되나요',
    '길드 가입은 어떻게 하나요',
    '결제했는데 아이템이 안 들어와요',
    '모바일에서 접속이 안 됩니다',
    '경험치 획득량이 갑자기 줄었어요',
    '닉네임 변경 어디서 하나요',
    '이 아이템 팔아도 될까요',
  ],
  info: [
    '레벨 별 사냥터 추천',
    '초보자를 위한 스탯 배분 정리',
    '주간 보스 보상 정리표',
    '메소 수급 효율 비교해봤습니다',
    '이번 패치 변경점 요약',
    '숨겨진 포탈 위치 모음',
    '직업별 사냥 동선 정리',
    '이벤트 코인 최적 교환 순서',
  ],
}

const NICKNAMES: readonly string[] = [
  'cinnamon',
  'mapleboy',
  'starfish',
  'bluewhale',
  'nightowl',
  'sakura',
  'pixelhero',
  'oceanwave',
  'glacier',
  'roselia',
  'moonlight',
  'wanderer',
]

const COMMENT_BODIES: readonly string[] = [
  '오 정보 감사합니다!',
  '저도 같은 현상 겪었어요.',
  '이거 진짜 도움 많이 됐습니다 ㅎㅎ',
  '고객지원에 문의해 보시는 게 빠를 것 같아요.',
  '스크린샷 있으면 더 좋을 듯합니다.',
  '오늘 저녁에 같이 가요!',
  '패치 이후로 바뀐 것 같더라고요.',
  '좋은 글 잘 봤습니다.',
]

const BODY_PARAGRAPHS: readonly string[] = [
  '어제부터 계속 신경 쓰이던 부분이라 글 남겨봅니다.',
  '혹시 저만 그런 건지 궁금해서요. 비슷한 경험 있으시면 댓글 부탁드려요.',
  '정리하면서 빠진 내용이 있을 수 있으니 알려주시면 바로 반영하겠습니다.',
  '읽어주셔서 감사합니다. 즐거운 모험 되세요!',
]

function createComments(postIndex: number, count: number, postDate: number): Comment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${postIndex + 1}-${index + 1}`,
    author: pick(NICKNAMES, postIndex + index * 3 + 5),
    body: pick(COMMENT_BODIES, postIndex + index * 2),
    createdAt: new Date(postDate + (index + 1) * HOUR_MS).toISOString(),
  }))
}

function createPost(index: number): Post {
  const category = pick(COMMUNITY_CATEGORIES, index).value
  const title = pick(TITLES[category], Math.floor(index / COMMUNITY_CATEGORIES.length))
  const createdAtMs = BASE_DATE - index * 7 * HOUR_MS
  const commentCount = randomInt(0, 24)
  const bodyLead = `${title.replace(/,+$/u, '')}에 대한 이야기입니다.`

  return {
    id: String(index + 1),
    category,
    title,
    body: [bodyLead, '', ...BODY_PARAGRAPHS].join('\n\n'),
    author: pick(NICKNAMES, index * 5 + 1),
    views: randomInt(120, 180000),
    likes: randomInt(0, 320),
    createdAt: new Date(createdAtMs).toISOString(),
    comments: createComments(index, commentCount, createdAtMs),
  }
}

export const COMMUNITY_POSTS: readonly Post[] = Array.from({ length: POST_COUNT }, (_, index) =>
  createPost(index),
)
