/**
 * 작성 도배 방지용 최소 간격.
 *
 * 사용자당 마지막 작성 시각(DB 의 `created_at`)만 보고 판정한다. 메모리 카운터를
 * 쓰면 서버 인스턴스가 늘어나는 순간 무력화되지만, 이미 저장된 행을 기준으로 하면
 * 어느 인스턴스가 처리해도 같은 결론이 나온다.
 */
export const WRITE_COOLDOWN_SECONDS = 30

/**
 * 신고는 작성보다 짧게 잡는다. 한 글타래에서 여러 댓글을 연달아 신고하는 것은
 * 정상 행동인데, 30초 간격을 그대로 적용하면 두 번째 신고가 막힌다.
 */
export const REPORT_COOLDOWN_SECONDS = 10

/**
 * 좋아요는 한 번 누르고 바로 취소하는 것이 정상 동작이라 사실상 막지 않는 값으로
 * 둔다. 목적은 도배 차단이 아니라 더블클릭·자동 클릭이 만드는 insert/delete
 * 왕복을 한 박자 눌러 주는 것이다.
 */
export const LIKE_COOLDOWN_SECONDS = 1

/**
 * 이미지 업로드는 "최소 간격"이 아니라 "창(window) 안 횟수"로 막는다.
 *
 * 글 여러 장을 한 번에 끌어다 놓는 것은 정상 행동인데 최소 간격을 걸면 두 번째
 * 파일부터 막힌다. 대신 최근 60초에 20장을 넘기면 그때부터 기다리게 한다.
 * 판정 근거는 메모리 카운터가 아니라 스토리지에 실제로 쌓인 오브젝트의 생성
 * 시각이라, 서버 인스턴스가 늘어나도 결론이 같다.
 */
export const UPLOAD_WINDOW_SECONDS = 60
export const UPLOAD_MAX_PER_WINDOW = 20

const MS_PER_SECOND = 1000

/** 남은 대기 시간(초). 0 이면 바로 작성할 수 있다. */
export function remainingCooldown(
  latestCreatedAt: string | null | undefined,
  now: number = Date.now(),
  cooldownSeconds: number = WRITE_COOLDOWN_SECONDS,
): number {
  if (latestCreatedAt === null || latestCreatedAt === undefined) {
    return 0
  }

  const latest = new Date(latestCreatedAt).getTime()

  if (Number.isNaN(latest)) {
    // 시각을 못 읽으면 막지 않는다. 파싱 실패로 글쓰기가 영구히 잠기면 안 된다.
    return 0
  }

  const elapsed = (now - latest) / MS_PER_SECOND

  if (elapsed < 0) {
    // DB 시계가 앞서 있는 경우. 전체 대기 시간을 요구한다.
    return cooldownSeconds
  }

  return Math.max(0, Math.ceil(cooldownSeconds - elapsed))
}

export function cooldownMessage(seconds: number): string {
  return `너무 빠르게 작성하고 있습니다. ${seconds}초 후에 다시 시도해 주세요.`
}

export function uploadLimitMessage(seconds: number): string {
  return `이미지를 너무 많이 올렸습니다. ${seconds}초 후에 다시 시도해 주세요.`
}
