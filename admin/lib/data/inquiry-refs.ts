import { isLiveLock } from '@/lib/validation/inquiry-assignment'

/**
 * 담당자·작성 중 잠금의 표시용 값.
 *
 * 목록과 상세가 **같은 함수**를 써야 두 화면이 다른 말을 하지 않는다 — 특히 잠금
 * 만료(5분)를 화면마다 다시 재면, 목록에는 "작성 중"이 남고 상세에는 없는 상황이 난다.
 */
/** 담당자·작성자 표시에 필요한 최소 정보. 목록·상세·폴링 응답이 함께 쓴다. */
export type InquiryAdminRef = {
  id: string
  nickname: string
}

export type InquiryEditingRef = InquiryAdminRef & {
  /** 마지막 하트비트 시각. 화면이 "n분 전 활동"으로 옮긴다. */
  at: string
}

/**
 * 담당자 임베드 → 표시용 값.
 *
 * 임베드가 비는 경우가 있다 — 탈퇴로 프로필이 사라졌는데 `assigned_to` 만 남은 행은
 * 아니다(FK 가 set null 이다), 그러나 조인이 막히거나 열이 선택되지 않은 응답에서는
 * null 이 온다. 그때는 닉네임 대신 '(탈퇴한 관리자)'로 남긴다 — 담당자가 있다는
 * 사실까지 지우면 목록에서 미배정과 구분되지 않는다.
 */
export function toAdminRef(
  id: string | null,
  embedded: { id: string; nickname: string } | null,
): InquiryAdminRef | null {
  if (id === null) {
    return null
  }

  return { id, nickname: embedded?.nickname ?? '(탈퇴한 관리자)' }
}

/**
 * 작성 중 잠금 → 표시용 값. **만료된 잠금은 없는 것으로 친다** — 화면마다 만료를
 * 다시 판정하면 목록과 상세가 다른 말을 한다.
 */
export function toEditingRef(
  id: string | null,
  at: string | null,
  embedded: { id: string; nickname: string } | null,
): InquiryEditingRef | null {
  if (id === null || at === null || !isLiveLock(at)) {
    return null
  }

  return { id, nickname: embedded?.nickname ?? '(탈퇴한 관리자)', at }
}
