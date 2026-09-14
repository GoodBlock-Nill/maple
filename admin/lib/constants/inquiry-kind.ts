/**
 * 고객지원 접수 종류(kind).
 *
 * 1:1 문의 · 버그제보 · 불법이용제보는 폼·첨부·상태·답변이 전부 같고 **분류 하나만**
 * 다르다(마이그레이션 20260914000100). 그 하나를 여기 한곳에 모아 둔다 —
 * 라벨·경로·버튼 문구가 화면마다 흩어지면 "버그제보"가 어디서는 "버그 제보"가 된다.
 *
 * `lib/constants/inquiry-kind.ts` 와 `admin/lib/constants/inquiry-kind.ts` 는 **글자
 * 그대로 같아야 한다.** 두 벌인 이유는 별도 pnpm 패키지라 서로를 import 하지 않기
 * 때문이고, 어긋나면 사용자가 낸 "버그제보"가 관리자 목록에서 다른 이름으로 보인다.
 * 둘이 같은지는 양쪽 단위 테스트가 지킨다(한쪽을 고치면 반드시 복사한다).
 */

/** `inquiries.kind` · `inquiry_categories.kind` (text + CHECK) 와 1:1. */
export type InquiryKind = 'inquiry' | 'bug' | 'report'

export type InquiryKindOption = {
  value: InquiryKind
  /** 목록 뱃지·상세 메타의 표기. 문장 안에 들어가는 짧은 이름이다. */
  label: string
  /** 고객지원 메뉴의 항목 이름. 1:1 문의만 "문의하기"가 붙는다. */
  menuLabel: string
  /** 접수 폼 경로. 세 라우트가 같은 페이지 컴포넌트를 kind 만 바꿔 그린다. */
  path: string
  /** 제출 버튼 문구. 제보는 "문의"가 아니다. */
  submitLabel: string
}

/**
 * 표시 순서다. 메뉴(PC 5행 · 모바일 세그먼트 탭)와 관리자 카테고리 화면의 kind 별
 * 섹션이 이 순서를 그대로 따른다.
 */
export const INQUIRY_KINDS = [
  {
    value: 'inquiry',
    label: '1:1 문의',
    menuLabel: '1:1 문의하기',
    path: '/support',
    submitLabel: '문의하기',
  },
  {
    value: 'bug',
    label: '버그제보',
    menuLabel: '버그제보',
    path: '/support/bug',
    submitLabel: '제보하기',
  },
  {
    value: 'report',
    label: '불법이용제보',
    menuLabel: '불법이용제보',
    path: '/support/report',
    submitLabel: '제보하기',
  },
] as const satisfies readonly InquiryKindOption[]

/**
 * 기본 종류.
 *
 * DB 의 기본값(`default 'inquiry'`)과 같아야 한다. 카테고리를 찾지 못한 문의가
 * 떨어지는 자리이기도 하다 — 분류를 잃은 문의는 1:1 문의 창구에 남아 사람이 본다.
 */
export const DEFAULT_INQUIRY_KIND: InquiryKind = 'inquiry'

/** 값만 필요한 곳(검증 · 쿼리 파라미터 판정)이 쓰는 목록. 순서는 위와 같다. */
export const INQUIRY_KIND_VALUES: readonly InquiryKind[] = INQUIRY_KINDS.map((kind) => kind.value)

/** 값으로 한 건 찾기. 목록 순회 대신 이쪽을 쓴다. */
export const INQUIRY_KIND_MAP: Record<InquiryKind, InquiryKindOption> = {
  inquiry: INQUIRY_KINDS[0],
  bug: INQUIRY_KINDS[1],
  report: INQUIRY_KINDS[2],
}

/**
 * DB·URL 에서 온 문자열을 좁힌다.
 *
 * 생성된 타입은 `kind: string` 이다(CHECK 제약은 타입에 나타나지 않는다). 그래서
 * 경계에서 한 번 판정하고, 그 뒤로는 `InquiryKind` 로만 다닌다.
 */
export function isInquiryKind(value: unknown): value is InquiryKind {
  return typeof value === 'string' && INQUIRY_KIND_VALUES.some((kind) => kind === value)
}

/**
 * 표시 라벨.
 *
 * 인자를 `string` 으로 받는 이유는 호출자 대부분이 DB 값(=`string`)을 그대로 넘기기
 * 때문이다. 알 수 없는 값은 기본 종류의 라벨로 떨어진다 — CHECK 제약이 세 값만
 * 허용하므로 실제로는 오지 않지만, 화면이 빈칸을 그리는 것보다 낫다.
 */
export function inquiryKindLabel(kind: string): string {
  return isInquiryKind(kind)
    ? INQUIRY_KIND_MAP[kind].label
    : INQUIRY_KIND_MAP[DEFAULT_INQUIRY_KIND].label
}
