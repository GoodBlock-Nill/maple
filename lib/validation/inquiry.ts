import { z } from 'zod'

import { allowedInquiryTypes } from '@/lib/utils/inquiry-subtypes'

import type { InquiryCategoryChoice } from '@/lib/utils/inquiry-subtypes'

/**
 * 1:1 문의 입력 검증.
 *
 * 클라이언트 검증은 편의일 뿐이고 서버 액션이 같은 스키마로 다시 파싱한다.
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출되므로 신뢰 경계는 서버다.
 */

export const INQUIRY_TITLE_MIN = 2
export const INQUIRY_TITLE_MAX = 100
export const INQUIRY_CONTENT_MIN = 5

/**
 * 카테고리 프리필 양식의 상한. DB CHECK(`inquiry_categories_prefill_length`)와
 * 같은 숫자여야 관리자에서 저장된 양식이 사용자 폼에서 잘리지 않는다.
 */
export const INQUIRY_PREFILL_MAX = 2_000

/**
 * 내용 상한.
 *
 * 프리필 양식이 그대로 내용 칸에 들어간다. 상한을 양식 상한과 같게 두면 양식이
 * 긴 카테고리에서는 **한 글자도 더 못 쓰는** 폼이 된다. 양식 최대치를 채우고도
 * 같은 분량을 더 쓸 수 있도록 두 배로 잡는다.
 */
export const INQUIRY_CONTENT_MAX = INQUIRY_PREFILL_MAX * 2

/**
 * 메이플월드 계정 ID.
 *
 * 2026-09-11 제품 결정으로 **필수 항목**이 됐다(운영자가 본인 확인 없이 답변할 수
 * 있는 문의가 없다). 그런데 서식까지 숫자 10~20자리로 굳히면, 클라이언트 화면에
 * 보이는 값이 그 모양이 아닌 사용자가 문의 자체를 남기지 못한다 — 접수를 막는 것이
 * 오탈자를 잡는 것보다 늘 비싸다. 그래서 "사람이 옮겨 적을 수 있는 식별자"까지만
 * 좁힌다(영문·숫자·_·-, 2~40자). 자릿수 확인은 운영자가 화면에서 한다.
 *
 * 상한 40 은 DB CHECK(`inquiries_account_id_length`, 마이그레이션 20260910000900)와
 * 같은 숫자다.
 */
export const ACCOUNT_ID_MIN = 2
export const ACCOUNT_ID_MAX = 40
export const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{2,40}$/u

const ACCOUNT_ID_MESSAGE = `계정 ID는 영문·숫자·_·- 로 ${ACCOUNT_ID_MIN}~${ACCOUNT_ID_MAX}자로 입력해 주세요.`

/**
 * 세부 유형 오류 문구.
 *
 * "고르지 않았다"와 "이 카테고리에 없는 값이다"를 한 문장으로 합친다 — 사용자가
 * 화면에서 할 수 있는 일은 어느 쪽이든 "다시 고르기" 하나뿐이다.
 */
const SUBTYPE_MESSAGE = '세부 문의 유형을 선택해 주세요.'

/** 값이 목록에 있는지만 본다. DB 컬럼이 text 라 enum 으로 좁힐 수 없다. */
function optionOf(options: readonly string[], message: string) {
  return z
    .string()
    .trim()
    .refine((value) => options.includes(value), { message })
}

/**
 * 브라우저는 textarea/input 값을 폼 전송 시 CRLF 로 정규화한다(HTML 사양).
 * 그대로 저장하면 글자 수 계산·검색·사용자 화면이 보이지 않는 `\r` 에 흔들리므로
 * 길이를 재기 전에 LF 로 되돌린다. 관리자 쪽(`admin/lib/validation/inquiries.ts`)과
 * 같은 규칙이라 한쪽만 CRLF 를 남기는 일이 없다.
 */
export function normalizeCRLF(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

/** CRLF 정규화 + trim 뒤 길이 제한을 검사하는 평문 필드. */
function plainTextField(min: number, max: number, minMessage: string, maxMessage: string) {
  return z
    .string()
    .transform((value) => normalizeCRLF(value).trim())
    .pipe(z.string().min(min, { message: minMessage }).max(max, { message: maxMessage }))
}

/**
 * 접수 · 수정이 공유하는 본문 필드.
 *
 * 카테고리 목록은 DB(`inquiry_categories`)가 소유하므로 스키마를 **호출 시점에**
 * 만든다. 상수로 굳혀 두면 운영자가 관리자에서 추가한 카테고리가 서버 검증에서
 * 거절된다 — 화면에는 있는데 접수가 안 되는 상태가 된다.
 *
 * 세부 유형(`type`)은 카테고리에 매달려 있어 필드 하나만 보고는 판정할 수 없다.
 * 여기서는 "무언가 고르긴 했는가"까지만 보고, 목록 대조는 아래 `checkSubtype` 이
 * 두 값을 함께 보며 한다.
 */
function inquiryFields(allowedCategories: readonly string[]) {
  return {
    /* 필수. 비어 있을 때와 서식이 틀렸을 때의 문구를 나눠, 사용자가 "무엇을 고쳐야
       하는지"를 한 줄로 알 수 있게 한다. DB 컬럼은 여전히 nullable 이다 — 이메일로
       들어온 문의(수신 함수)와 필수가 되기 전의 옛 문의에 값이 없다. */
    accountId: z
      .string()
      .trim()
      .min(1, { message: '메이플월드 계정 ID를 입력해 주세요.' })
      .regex(ACCOUNT_ID_PATTERN, { message: ACCOUNT_ID_MESSAGE }),
    category: optionOf(allowedCategories, '카테고리를 선택해 주세요.'),
    type: z.string().trim().min(1, { message: SUBTYPE_MESSAGE }),
    title: plainTextField(
      INQUIRY_TITLE_MIN,
      INQUIRY_TITLE_MAX,
      `제목은 ${INQUIRY_TITLE_MIN}자 이상 입력해 주세요.`,
      `제목은 ${INQUIRY_TITLE_MAX}자 이하로 입력해 주세요.`,
    ),
    content: plainTextField(
      INQUIRY_CONTENT_MIN,
      INQUIRY_CONTENT_MAX,
      `내용은 ${INQUIRY_CONTENT_MIN}자 이상 입력해 주세요.`,
      `내용은 ${INQUIRY_CONTENT_MAX}자 이하로 입력해 주세요.`,
    ),
  }
}

/**
 * 세부 유형 ↔ 카테고리 대조.
 *
 * 두 값을 함께 봐야 하므로 필드 검증이 아니라 객체 검증이다. 폼은 카테고리를 바꿀
 * 때 유형 선택을 비우지만, 이 액션은 UI 를 거치지 않는 직접 POST 로도 불린다 —
 * "접속·서버 + 콘텐츠 개선 의견" 같은 엇갈린 조합이 저장되지 않게 서버가 다시 본다.
 *
 * `extraTypes` 는 수정 화면의 옛 값이다(접수 당시의 '문의' · 없어진 세부 유형).
 * 허용하지 않으면 본문 오타 하나 고치려던 사용자가 유형부터 다시 정해야 한다.
 */
function checkSubtype(categories: readonly InquiryCategoryChoice[], extraTypes: readonly string[]) {
  return (value: { category: string; type: string }, ctx: z.RefinementCtx): void => {
    const allowed = [...allowedInquiryTypes(categories, value.category), ...extraTypes]

    if (!allowed.includes(value.type)) {
      ctx.addIssue({ code: 'custom', path: ['type'], message: SUBTYPE_MESSAGE })
    }
  }
}

/**
 * 접수 입력 검증.
 *
 * 허용 목록은 서버 액션이 `getInquiryCategories()` 로 읽어 넘긴다(조회 실패 시
 * 폴백 카테고리). 신뢰 경계는 어디까지나 서버다.
 */
export function createInquirySchema(categories: readonly InquiryCategoryChoice[]) {
  return z
    .object({
      ...inquiryFields(categories.map((category) => category.label)),
      /* DB 에 `privacy_consent` CHECK 가 걸려 있어 미동의는 어차피 저장되지 않는다.
         여기서 먼저 막아 제약 위반(23514) 대신 사람이 읽는 문구를 돌려준다. */
      consent: z.literal(true, { message: '개인정보 수집 및 이용에 동의해 주세요.' }),
    })
    .superRefine(checkSubtype(categories, []))
}

export type CreateInquiryInput = z.infer<ReturnType<typeof createInquirySchema>>

/**
 * 수정 입력. 접수와 **같은 필드 · 같은 대조**를 쓰되 동의 체크박스만 뺀다 — 동의는
 * 접수 시점에 이미 받아 `privacy_consent` 로 저장돼 있고, 수정 화면에서 다시 물으면
 * 체크를 풀었을 때 "동의 철회"처럼 보인다(철회는 삭제 요청으로 처리할 일이다).
 *
 * 규칙을 새로 쓰지 않고 `inquiryFields` · `checkSubtype` 를 나눠 쓰는 이유는 상한이
 * 갈리면 "접수는 됐는데 수정은 막히는" 문의가 생기기 때문이다.
 */
export function updateInquirySchema(
  categories: readonly InquiryCategoryChoice[],
  /** 이 문의가 이미 들고 있는 유형. 목록에서 사라졌어도 그대로 저장할 수 있어야 한다. */
  legacyTypes: readonly string[] = [],
) {
  return z
    .object(inquiryFields(categories.map((category) => category.label)))
    .superRefine(checkSubtype(categories, legacyTypes))
}

export type UpdateInquiryInput = z.infer<ReturnType<typeof updateInquirySchema>>

/** 서버 액션에 실려 오는 문의 id. uuid 가 아니면 조회 자체를 하지 않는다(22P02 방지). */
export const inquiryIdSchema = z.uuid()

/**
 * 폼이 제출을 열어 줄 최소 조건 — **필수 항목이 모두 채워졌는가**.
 *
 * 값의 모양(자릿수 · 상한)은 보지 않는다. 제목이 한 글자라고 버튼을 잠그면 사용자는
 * 이유를 모른 채 눌리지 않는 버튼을 본다. 그 판정은 스키마가 맡고, 결과는 필드 옆
 * 문구로 돌아온다. 여기서는 "아직 아무것도 고르지 않은 폼"만 막는다.
 *
 * 첨부는 선택 항목이라 세지 않는다(2026-09-11 제품 결정).
 */
export const INQUIRY_REQUIRED_FIELDS = [
  'accountId',
  'category',
  'type',
  'title',
  'content',
] as const

export function isInquiryFormFilled(formData: FormData, requireConsent: boolean): boolean {
  const filled = INQUIRY_REQUIRED_FIELDS.every((name) => {
    const value = formData.get(name)

    return typeof value === 'string' && value.trim() !== ''
  })

  /* 체크박스는 체크했을 때만 FormData 에 담긴다. 값이 아니라 존재 여부로 판단한다
     (수정 화면에는 아예 없다 — 동의는 접수 시점에 이미 받았다). */
  return filled && (!requireConsent || formData.get('consent') !== null)
}
