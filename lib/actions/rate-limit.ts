/**
 * 작성 도배 방지용 최소 간격.
 *
 * 사용자당 마지막 작성 시각(DB 의 `created_at`)만 보고 판정한다. 메모리 카운터를
 * 쓰면 서버 인스턴스가 늘어나는 순간 무력화되지만, 이미 저장된 행을 기준으로 하면
 * 어느 인스턴스가 처리해도 같은 결론이 나온다.
 */
export const WRITE_COOLDOWN_SECONDS = 30

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
