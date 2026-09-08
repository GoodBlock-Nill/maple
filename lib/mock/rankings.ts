import { JOB_GROUPS } from '@/lib/constants/ranking'

import type { JobGroup, RankingEntry } from '@/types/domain'

/**
 * 랭킹 목업 100건.
 *
 * 출처가 확정되지 않아(관리자 CSV 업로드 전제) 값은 전부 결정론적으로 만든다.
 * Phase 4에서 Supabase `rankings` 테이블로 교체된다.
 */

const ENTRY_COUNT = 100

/** 길드 미가입 비율. 길드 랭킹 탭에서 걸러져 총 건수가 달라진다. */
const GUILDLESS_EVERY = 5

const NICKNAMES: readonly string[] = [
  '설윤',
  '후니월드',
  '시나몬롤',
  '달빛기사',
  '별헤는밤',
  '초코비',
  '루비하트',
  '노을소녀',
  '푸른바람',
  '겨울고양이',
  '한여름밤',
  '연화',
  '민트초코',
  '흰눈사슴',
  '라온',
]

const GUILDS: readonly string[] = [
  'MapleStar',
  '글자월드',
  '달빛단',
  '루미너스',
  '새벽의검',
  '별무리',
]

const JOBS: Record<JobGroup, readonly string[]> = {
  adventurer: ['비숍', '보우마스터', '캐논마스터', '나이트로드'],
  cygnus: ['미하일', '플레임위자드', '윈드브레이커', '나이트워커'],
  resistance: ['와일드헌터', '메카닉', '배틀메이지', '블래스터'],
  hero: ['아란', '에반', '루미너스', '메르세데스'],
  demon: ['데몬슬레이어', '데몬어벤져', '팬텀', '카이저'],
}

/** TOP3 카드 캐릭터 일러스트. 없으면 실루엣 플레이스홀더로 대체된다. */
const TOP_CHARACTERS: readonly string[] = [
  '/images/ranking/top3-char-1.png',
  '/images/ranking/top3-char-2.png',
  '/images/ranking/top3-char-3.png',
]

function pick<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index % items.length]

  if (item === undefined) {
    throw new Error('빈 배열에서는 값을 고를 수 없습니다.')
  }

  return item
}

/** 상위일수록 높은 레벨/경험치가 되도록 단조 감소시킨다. */
function levelAt(index: number): number {
  return 212 - Math.floor(index / 6)
}

function expAt(index: number): string {
  return `${(98.7 - index * 0.31).toFixed(1)}B`
}

function buildEntry(index: number): RankingEntry {
  const jobGroup = pick(JOB_GROUPS, index).value
  const hasGuild = (index + 1) % GUILDLESS_EVERY !== 0
  // 상위 3명만 카드용 일러스트를 갖는다(시안 TOP3 영역).
  const character = index < TOP_CHARACTERS.length ? TOP_CHARACTERS[index] : undefined

  return {
    id: `rank-${index + 1}`,
    nickname: pick(NICKNAMES, index),
    level: levelAt(index),
    job: pick(JOBS[jobGroup], index),
    jobGroup,
    exp: expAt(index),
    guild: hasGuild ? pick(GUILDS, index) : null,
    ...(character === undefined ? {} : { character }),
  }
}

export const RANKING_ENTRIES: readonly RankingEntry[] = Array.from(
  { length: ENTRY_COUNT },
  (_, index) => buildEntry(index),
)
