import { firstValue } from '@/lib/utils/table-query'
import {
  deriveLegalStatus,
  formatEffectiveDate,
  kstToday,
  selectCurrentLegalVersion,
} from '@/lib/validation/legal'

import type { LegalVersionStatus } from '@/lib/constants/legal'
import type { LegalPublishMode, LegalVersionLike } from '@/lib/validation/legal'

/**
 * 약관 화면의 파생 상태 — 목록 카드 · 버전 칩 · 탭 · 발행 확인 문구.
 *
 * 전부 순수 함수다. 목록 카드와 상세 화면이 각자 "지금 시행 중인 것"을 계산하면
 * 두 화면이 다른 버전을 현재라고 부르게 된다. 판정의 뿌리는 여전히
 * `selectCurrentLegalVersion()` 하나이고(= SQL `current_legal_version()`), 여기서는
 * 그 결과를 나머지 묶음(예약 · 초안)과 겹치지 않게 나누기만 한다.
 */

/** 상태 계산에 필요한 최소 정보. `lib/data/legal.ts` 의 행이 이 모양을 만족한다. */
export type LegalStateVersion = LegalVersionLike & {
  id: string
  createdAt: string
}

export type LegalDocumentState<T extends LegalStateVersion> = {
  /** 사용자 사이트가 지금 읽는 개정본. */
  current: T | null
  /** 다음에 시행될 예약본(가장 가까운 시행일). `current` 와 겹치지 않는다. */
  scheduled: T | null
  /** 미발행 개정본. 최신 생성순. */
  drafts: readonly T[]
}

/**
 * 개정본 목록 → 카드 한 장이 말해야 하는 세 가지.
 *
 * 예약본에서 `current` 를 빼는 이유: 발행본이 전부 미래 시행일이면
 * `current_legal_version()` 은 그중 가장 최근 발행본을 돌려준다(= 사용자 화면에
 * 실제로 보인다). 그 개정본을 예약 줄에도 또 적으면 같은 버전이 두 줄에 나와
 * 운영자가 "둘 중 무엇이 보이는가"를 판단할 수 없다.
 */
export function resolveLegalDocumentState<T extends LegalStateVersion>(
  versions: readonly T[],
  today: string = kstToday(),
): LegalDocumentState<T> {
  const current = selectCurrentLegalVersion(versions, today)

  const scheduled = versions
    .filter(
      (version) =>
        version.isPublished && version.effectiveDate > today && version.id !== current?.id,
    )
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))

  const drafts = versions
    .filter((version) => !version.isPublished)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return { current, scheduled: scheduled[0] ?? null, drafts }
}

export const LEGAL_TABS = ['edit', 'preview', 'history'] as const

export type LegalTab = (typeof LEGAL_TABS)[number]

export const LEGAL_TAB_LABEL: Record<LegalTab, string> = {
  edit: '편집',
  preview: '미리보기',
  history: '이력·비교',
}

/** `?tab=` 파싱. 모르는 값은 편집으로 떨어뜨린다(운영자가 링크를 손으로 고쳐도 열린다). */
export function parseLegalTab(raw: string | string[] | undefined): LegalTab {
  const value = firstValue(raw)

  return LEGAL_TABS.includes(value as LegalTab) ? (value as LegalTab) : 'edit'
}

/**
 * 사용자에게 지금 보이는 개정본을 뭐라고 부를지.
 *
 * 발행본이 전부 미래 시행일이면 `current_legal_version()` 은 그중 최신 발행본을
 * 돌려준다 — 시행 전이지만 독자는 그것을 본다. 그런 개정본을 "시행 중"이라고 적으면
 * 바로 옆의 시행일(미래)과 어긋나 운영자가 화면을 못 믿는다.
 */
export function legalCurrentTerm(status: LegalVersionStatus): string {
  return status === 'scheduled' ? '노출 중' : '시행 중'
}

/** 페이지 머리 아래 칩 한 개. 색은 화면에서 `LEGAL_STATUS_TONE` 으로 고른다. */
export type LegalStripChip = {
  key: string
  status: LegalVersionStatus
  label: string
  /** `?version=` 에 실을 개정본 id. */
  versionId: string
}

/** `2026-10-01` → `10/1`. 칩은 한 줄이라 연도까지 적을 자리가 없다. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-')

  return month === undefined || day === undefined ? isoDate : `${Number(month)}/${Number(day)}`
}

/** 초안을 통째로 나열하지 않는 한계. 넘으면 최신 한 개 + 나머지 건수로 접는다. */
const DRAFT_CHIP_LIMIT = 3

/**
 * 버전 칩 — "지금 무엇이 걸려 있는가"를 한 줄로.
 *
 * 이력 탭을 열지 않아도 시행 중·예약·초안을 한눈에 보고 그 자리에서 열 수 있어야
 * 한다. 칩은 전부 `?version=` 링크이므로 자바스크립트 없이도 움직인다.
 */
export function legalStripChips<T extends LegalStateVersion>(
  state: LegalDocumentState<T>,
  today: string = kstToday(),
): readonly LegalStripChip[] {
  const chips: LegalStripChip[] = []

  if (state.current !== null) {
    const status = deriveLegalStatus(state.current, state.current.version, today)

    chips.push({
      key: `current:${state.current.id}`,
      status,
      label: `${legalCurrentTerm(status)} ${state.current.version}`,
      versionId: state.current.id,
    })
  }

  if (state.scheduled !== null) {
    chips.push({
      key: `scheduled:${state.scheduled.id}`,
      status: 'scheduled',
      label: `예약 ${state.scheduled.version} (${shortDate(state.scheduled.effectiveDate)}부터)`,
      versionId: state.scheduled.id,
    })
  }

  const [newest] = state.drafts

  if (newest === undefined) {
    return chips
  }

  if (state.drafts.length > DRAFT_CHIP_LIMIT) {
    chips.push({
      key: `drafts:${newest.id}`,
      status: 'draft',
      label: `초안 ${newest.version} 외 ${state.drafts.length - 1}건`,
      versionId: newest.id,
    })

    return chips
  }

  for (const draft of state.drafts) {
    chips.push({
      key: `draft:${draft.id}`,
      status: 'draft',
      label: `초안 ${draft.version}`,
      versionId: draft.id,
    })
  }

  return chips
}

export type LegalConfirmCopy = {
  title: string
  description: string
  /** 실행 버튼 문구. 취소는 항상 "취소" 다. */
  action: string
}

/** 되돌릴 수 없는 저장에만 한 번 더 묻는다. */
const IMMUTABLE_NOTE = '발행한 개정본은 수정할 수 없습니다.'

/**
 * 저장 확인 문구. 임시저장은 `null` 이다 — 되돌릴 수 있는 저장까지 확인창을 띄우면
 * 운영자가 내용을 읽지 않고 누르는 습관이 들어, 정작 발행 확인이 무의미해진다.
 */
export function legalConfirmCopy(
  mode: LegalPublishMode,
  effectiveDate: string,
): LegalConfirmCopy | null {
  if (mode === 'publish') {
    return {
      title: '지금 발행할까요?',
      description: `저장 즉시 사용자 사이트에 공개됩니다. ${IMMUTABLE_NOTE}`,
      action: '발행',
    }
  }

  if (mode === 'schedule') {
    return {
      title: '예약 발행할까요?',
      description: `${formatEffectiveDate(effectiveDate)}부터 사용자 사이트에 공개됩니다. ${IMMUTABLE_NOTE}`,
      action: '예약',
    }
  }

  return null
}
