import { z } from 'zod'

import { INQUIRY_TYPES } from '@/lib/constants/support'
import {
  INQUIRY_ATTACHMENT_MAX_BYTES,
  INQUIRY_ATTACHMENT_MAX_COUNT,
  INQUIRY_ATTACHMENT_MAX_MB,
  INQUIRY_ATTACHMENT_TOTAL_MAX_BYTES,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
} from '@/lib/supabase/storage'

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
 * 계정 ID 는 숫자 문자열이다. 서식을 DB CHECK 로 강제하지 않는 이유는 마이그레이션
 * 주석에 적힌 대로 "본인 확인용"이기 때문이라, 여기서도 **입력했을 때만** 자릿수를 본다.
 * 모르는 사용자가 문의 자체를 못 넣는 상황을 만들지 않는다.
 */
export const ACCOUNT_ID_PATTERN = /^[0-9]{10,20}$/u

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

/** 파일 선택 대화상자에 넘길 `accept`. 확장자만 주면 일부 모바일 브라우저가 사진을 잠근다. */
export const INQUIRY_ATTACHMENT_ACCEPT = [
  ...INQUIRY_ATTACHMENT_MIME_TYPES,
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
].join(',')

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
 * 접수 입력 검증.
 *
 * 카테고리 목록은 DB(`inquiry_categories`)가 소유하므로 스키마를 **호출 시점에**
 * 만든다. 상수로 굳혀 두면 운영자가 관리자에서 추가한 카테고리가 서버 검증에서
 * 거절된다 — 화면에는 있는데 접수가 안 되는 상태가 된다.
 *
 * 허용 목록은 서버 액션이 `getInquiryCategoryLabels()` 로 읽어 넘긴다(조회 실패 시
 * 폴백 라벨). 신뢰 경계는 어디까지나 서버다.
 */
export function createInquirySchema(allowedCategories: readonly string[]) {
  return z.object({
    /* 빈 문자열은 "입력하지 않음"으로 본다. DB 는 null 을 받는다. */
    accountId: z
      .string()
      .trim()
      .refine((value) => value === '' || ACCOUNT_ID_PATTERN.test(value), {
        message: '계정 ID 는 숫자 10~20자리로 입력해 주세요.',
      })
      .transform((value) => (value === '' ? null : value)),
    category: optionOf(allowedCategories, '카테고리를 선택해 주세요.'),
    type: optionOf(INQUIRY_TYPES, '유형을 선택해 주세요.'),
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
    /* DB 에 `privacy_consent` CHECK 가 걸려 있어 미동의는 어차피 저장되지 않는다.
       여기서 먼저 막아 제약 위반(23514) 대신 사람이 읽는 문구를 돌려준다. */
    consent: z.literal(true, { message: '개인정보 수집 및 이용에 동의해 주세요.' }),
  })
}

export type CreateInquiryInput = z.infer<ReturnType<typeof createInquirySchema>>

/**
 * 수정 입력. 접수와 **같은 규칙**을 쓰되 동의 체크박스만 뺀다 — 동의는 접수
 * 시점에 이미 받아 `privacy_consent` 로 저장돼 있고, 수정 화면에서 다시 물으면
 * 체크를 풀었을 때 "동의 철회"처럼 보인다(철회는 삭제 요청으로 처리할 일이다).
 * 규칙을 새로 쓰지 않고 파생시키는 이유는 상한이 갈리면 "접수는 됐는데 수정은
 * 막히는" 문의가 생기기 때문이다.
 */
export function updateInquirySchema(allowedCategories: readonly string[]) {
  return createInquirySchema(allowedCategories).omit({ consent: true })
}

export type UpdateInquiryInput = z.infer<ReturnType<typeof updateInquirySchema>>

/** 서버 액션에 실려 오는 문의 id. uuid 가 아니면 조회 자체를 하지 않는다(22P02 방지). */
export const inquiryIdSchema = z.uuid()

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
 */
export function validateInquiryAttachments(
  files: readonly UploadCandidate[],
  /* 수정 화면에서 그대로 두는 기존 첨부 수. 개수 제한은 DB CHECK
     (`inquiries_attachments_max_3`)와 같아야 하므로 남길 것까지 합쳐서 센다. */
  keptCount = 0,
): InquiryAttachmentCheck {
  if (files.length + keptCount > INQUIRY_ATTACHMENT_MAX_COUNT) {
    return {
      ok: false,
      message: `첨부파일은 최대 ${INQUIRY_ATTACHMENT_MAX_COUNT}개까지 올릴 수 있습니다.`,
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
