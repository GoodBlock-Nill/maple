import { INQUIRY_KIND_VALUES } from '@/lib/constants/inquiry-kind'

import type { InquiryKind } from '@/lib/constants/inquiry-kind'
import type { InquiryCategoryOption } from '@/types/domain'

/**
 * 카테고리 폴백 — 창구(kind)별.
 *
 * 실제 목록은 DB(`inquiry_categories`)가 소유하고 서버 컴포넌트가 읽어 폼에 넘긴다
 * (`lib/data/inquiry-categories.ts`). 여기 있는 배열은 **조회가 실패했을 때만** 쓰인다 —
 * 카테고리를 못 읽었다고 접수 자체를 막으면 "장애를 알리려는 문의"가 막힌다.
 *
 * 프리필 양식은 담지 않는다(원문은 DB 한 곳에만 둔다). 라벨·순서는 마이그레이션
 * 20260910000400(1:1 문의 · 버그제보)과 20260914000100(불법이용제보)의 시드와 같다.
 */

/** 1:1 문의 창구. 운영자 복구·건의처럼 사람이 답해야 하는 분류가 남았다. */
const INQUIRY_FALLBACK_LABELS: readonly string[] = [
  '재화·아이템',
  '콘텐츠·밸런스',
  '계정·이용환경',
  '기타·건의',
]

/** 버그제보 창구. "동작이 잘못됐다"는 신고들이다. */
const BUG_FALLBACK_LABELS: readonly string[] = [
  '접속·서버',
  '캐릭터·게임 진행',
  '저장·데이터',
  '기능·UI',
]

/** 불법이용제보 창구. 대상이 남이라 라벨도 "제보" 문체다. */
const REPORT_FALLBACK_LABELS: readonly string[] = [
  '불법 프로그램',
  '버그 악용·비정상 획득',
  '계정·현금 거래',
  '욕설·비매너',
  '기타 제보',
]

export const INQUIRY_CATEGORY_FALLBACK_LABELS: Record<InquiryKind, readonly string[]> = {
  inquiry: INQUIRY_FALLBACK_LABELS,
  bug: BUG_FALLBACK_LABELS,
  report: REPORT_FALLBACK_LABELS,
}

/**
 * 폴백 라벨을 폼이 쓰는 옵션 모양으로 올린다(설명·프리필·세부 유형 없음).
 *
 * 세부 유형이 비어 있으므로 폼은 유형 셀렉트를 잠그고 `INQUIRY_SUBTYPE_FALLBACK`
 * 으로 접수한다 — 조회가 깨진 상황에서 유형까지 고르라고 막아 세울 이유가 없다.
 * `key` 에 kind 를 섞는 이유는 세 창구의 폴백이 한 화면(수정 폼의 legacy 병합)에서
 * 만났을 때 React 키가 겹치지 않게 하려는 것이다.
 */
function toFallbackOptions(
  kind: InquiryKind,
  labels: readonly string[],
): readonly InquiryCategoryOption[] {
  return labels.map((label, index) => ({
    key: `fallback-${kind}-${index}`,
    label,
    description: null,
    prefill: '',
    subtypes: [],
    kind,
  }))
}

export const INQUIRY_CATEGORY_FALLBACK: Record<InquiryKind, readonly InquiryCategoryOption[]> =
  Object.fromEntries(
    INQUIRY_KIND_VALUES.map((kind) => [
      kind,
      toFallbackOptions(kind, INQUIRY_CATEGORY_FALLBACK_LABELS[kind]),
    ]),
  ) as Record<InquiryKind, readonly InquiryCategoryOption[]>
