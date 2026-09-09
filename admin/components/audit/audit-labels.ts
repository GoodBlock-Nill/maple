/**
 * 감사 로그의 기계 문자열 → 관리자 화면 표기.
 *
 * `action` 은 모듈마다 자유롭게 늘어난다(`gacha.create`, `member.suspend`, …).
 * 고정 표를 만들면 새 모듈이 붙을 때마다 여기를 고쳐야 하고, 고치지 않으면 목록에
 * 영문 문자열이 그대로 남는다. 그래서 **영역 + 동작**으로 나눠 조합한다 — 표에
 * 없는 조합도 "무엇을 했는지"는 읽힌다.
 */

/** `gacha.create` 의 앞부분. */
const DOMAIN_LABELS: Record<string, string> = {
  gacha: '확률형 아이템',
  rankings: '랭킹',
  ranking: '랭킹',
  settings: '사이트 설정',
  banner: '히어로 배너',
  admin: '관리자',
  member: '회원',
  profile: '회원',
  news: '뉴스',
  post: '게시글',
  comment: '댓글',
  inquiry: '1:1 문의',
  faq: 'FAQ',
  report: '신고',
  legal: '약관',
}

/** `gacha.create` 의 마지막 부분. 같은 동작은 어느 모듈에서나 같은 말로 적는다. */
const VERB_LABELS: Record<string, string> = {
  create: '등록',
  update: '수정',
  delete: '삭제',
  import: 'CSV 적용',
  export: '내보내기',
  apply: '적용',
  rollback: '되돌리기',
  toggle: '노출 전환',
  reorder: '순서 변경',
  publish: '발행',
  unpublish: '발행 취소',
  hide: '숨김',
  restore: '복구',
  answer: '답변',
  reply: '답변',
  resolve: '처리',
  dismiss: '기각',
  suspend: '정지',
  unsuspend: '정지 해제',
  invite: '초대',
  revoke: '권한 회수',
  rename: '닉네임 변경',
}

/** `rankings.snapshot.apply` 처럼 중간 마디가 있는 경우의 보조 표기. */
const SEGMENT_LABELS: Record<string, string> = {
  snapshot: '스냅샷',
  promote_existing: '기존 계정 승격',
}

/**
 * 조합으로는 만들 수 없는 예외 표기.
 *
 * 탈퇴·복구는 **행위자가 관리자가 아니라 본인**이다. "회원 탈퇴"라고만 적으면
 * 운영자가 관리자 조치(강제 탈퇴)와 구분하지 못하고, 감사 로그의 쓰임 자체가
 * 흐려진다. 그래서 누가 한 일인지를 라벨에 박아 둔다.
 */
const ACTION_LABELS: Record<string, string> = {
  'member.withdraw': '회원 탈퇴(본인)',
  'member.restore': '탈퇴 복구(본인)',
  'member.purge': '개인정보 파기',
  'member.force_withdraw': '강제 탈퇴',
}

export function auditActionLabel(action: string): string {
  const override = ACTION_LABELS[action]

  if (override !== undefined) {
    return override
  }

  const [domain, ...rest] = action.split('.')
  const verb = rest[rest.length - 1] ?? ''
  const middle = rest.slice(0, -1).map((segment) => SEGMENT_LABELS[segment] ?? segment)

  const domainLabel = domain === undefined ? null : DOMAIN_LABELS[domain]
  const verbLabel = VERB_LABELS[verb] ?? SEGMENT_LABELS[verb] ?? null

  if (domainLabel === null || verbLabel === null) {
    // 알 수 없는 조합은 원문을 그대로 보여 준다. 잘못 번역하는 것보다 낫다.
    return action
  }

  return [domainLabel, ...middle, verbLabel].join(' ')
}

const TABLE_LABELS: Record<string, string> = {
  gacha_items: '확률형 아이템',
  rankings: '랭킹',
  site_settings: '사이트 설정',
  hero_banners: '히어로 배너',
  profiles: '회원',
  posts: '게시글',
  comments: '댓글',
  inquiries: '1:1 문의',
  inquiry_replies: '문의 답변',
  faqs: 'FAQ',
  reports: '신고',
  admin_invites: '관리자 초대',
  legal_documents: '약관',
}

export function auditTableLabel(table: string | null): string {
  if (table === null) {
    return '-'
  }

  return TABLE_LABELS[table] ?? table
}
