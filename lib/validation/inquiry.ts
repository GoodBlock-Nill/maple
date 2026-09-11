import { z } from 'zod'

import { allowedInquiryTypes } from '@/lib/utils/inquiry-subtypes'
import {
  INQUIRY_ATTACHMENT_MAX_BYTES,
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_MAX_TOTAL,
  INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
  INQUIRY_FILE_MAX_COUNT,
} from '@/lib/supabase/storage'
import { INQUIRY_VIDEO_EXTENSIONS, INQUIRY_VIDEO_MIME_TYPES } from '@/lib/validation/inquiry-video'

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
 * 글자월드 계정 ID.
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
 * 웹 폼이 받는 형식. 버킷(마이그레이션 20260909000300)은 zip · txt 까지 열려 있지만
 * 그쪽은 **이메일로 들어오는 첨부**를 담기 위한 것이라 여기서는 일부러 좁게 둔다.
 * 대신 버킷이 허용하는 이미지 형식(webp 포함)은 모두 받는다 — 휴대폰·캡처 도구가
 * 만드는 파일이라 "왜 이 사진만 안 되지"가 생기지 않게 한다.
 */
export const INQUIRY_ATTACHMENT_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]

/**
 * 파일 선택 대화상자에 넘길 `accept`.
 *
 * 확장자만 주면 일부 모바일 브라우저가 사진을 잠그고, MIME 만 주면 확장자로만
 * 판단하는 환경이 파일을 잠근다 — 그래서 둘 다 적는다. 영상 형식도 여기에 들어가야
 * 픽셀/아이폰의 갤러리 선택기가 동영상 탭을 함께 보여 준다.
 */
export const INQUIRY_ATTACHMENT_ACCEPT = [
  ...INQUIRY_ATTACHMENT_MIME_TYPES,
  ...INQUIRY_VIDEO_MIME_TYPES,
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  ...INQUIRY_VIDEO_EXTENSIONS,
].join(',')

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
      .min(1, { message: '글자월드 계정 ID를 입력해 주세요.' })
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

export type InquiryAttachmentCheck = { ok: true } | { ok: false; message: string }

/** 파일 객체의 필요한 부분만 본다(File 없이도 단위 테스트할 수 있게). */
export type UploadCandidate = { name: string; type: string; size: number }

function totalBytes(files: readonly UploadCandidate[]): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

/**
 * 첨부 검증. 버킷에도 개수·용량·MIME 제한이 있지만 거기서 걸리면 사용자는 영문
 * 스토리지 오류만 본다. 같은 규칙을 앞단에서 재서 한국어 안내를 돌려준다.
 *
 * 합계 제한은 버킷이 아니라 서버 액션 본문 상한 때문에 있다. 합계가 상한을 넘으면
 * 액션이 실행되지 않아 **아무 메시지도 돌려줄 수 없으므로**, 폼이 보내기 전에
 * 여기서 먼저 걸러야 한다(`InquiryAttachmentField` 가 같은 함수를 부른다).
 *
 * `files` 는 이미지·PDF 만 받는다(영상은 이 함수에 실리지 않고 `validateInquiryVideo`
 * 가 따로 본다). 개수는 이미지·PDF 와 영상이 **각자 자리**를 쓰므로(2026-09-11
 * 오너 지시) 종류별 상한을 먼저 보고, 그다음 둘을 합친 전체 상한을 한 번 더 본다 —
 * DB CHECK 도 같은 순서로 셋을 나눠 둔다(`inquiries_attachments_file_kind_max_3` ·
 * `inquiries_attachments_video_kind_max_2` · `inquiries_attachments_max_5`).
 */
export function validateInquiryAttachments(
  files: readonly UploadCandidate[],
  /* 수정 화면에서 그대로 두는 기존 "이미지·PDF" 첨부 수(영상은 넣지 않는다). */
  keptFileCount = 0,
  /* 이미 확정됐거나(기존 첨부) 지금 올리는 중인 영상 수. 본문에는 실리지 않지만
     같은 문의의 첨부라 전체 상한에는 함께 들어간다. */
  videoCount = 0,
): InquiryAttachmentCheck {
  if (files.length + keptFileCount > INQUIRY_FILE_MAX_COUNT) {
    return {
      ok: false,
      message: `이미지·PDF는 최대 ${INQUIRY_FILE_MAX_COUNT}개까지 첨부할 수 있습니다.`,
    }
  }

  if (files.length + keptFileCount + videoCount > INQUIRY_ATTACHMENT_MAX_TOTAL) {
    return {
      ok: false,
      message: `첨부파일은 최대 ${INQUIRY_ATTACHMENT_MAX_TOTAL}개까지 첨부할 수 있습니다.`,
    }
  }

  for (const file of files) {
    if (file.size <= 0) {
      return { ok: false, message: '빈 파일은 올릴 수 없습니다.' }
    }

    if (!INQUIRY_ATTACHMENT_MIME_TYPES.includes(file.type)) {
      return { ok: false, message: 'jpg · png · gif · webp · pdf 파일만 올릴 수 있습니다.' }
    }

    if (file.size > INQUIRY_ATTACHMENT_MAX_BYTES) {
      return {
        ok: false,
        message: `${file.name} 은(는) ${INQUIRY_ATTACHMENT_MAX_MB}MB 를 넘습니다. 첨부파일은 각 ${INQUIRY_ATTACHMENT_MAX_MB}MB 이하만 올릴 수 있습니다.`,
      }
    }
  }

  /* 새로 올리는 파일만 센다. 그대로 두는 기존 첨부는 다시 전송되지 않는다. */
  if (totalBytes(files) > INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES) {
    return {
      ok: false,
      message: `첨부파일은 합쳐서 ${INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB 이하만 올릴 수 있습니다.`,
    }
  }

  return { ok: true }
}
