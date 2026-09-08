import { z } from 'zod'

import { INQUIRY_CATEGORIES, INQUIRY_TYPES } from '@/lib/constants/support'
import { INQUIRY_ATTACHMENT_MAX_BYTES, INQUIRY_ATTACHMENT_MAX_COUNT } from '@/lib/supabase/storage'

/**
 * 1:1 문의 입력 검증.
 *
 * 클라이언트 검증은 편의일 뿐이고 서버 액션이 같은 스키마로 다시 파싱한다.
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출되므로 신뢰 경계는 서버다.
 */

export const INQUIRY_TITLE_MIN = 2
export const INQUIRY_TITLE_MAX = 100
export const INQUIRY_CONTENT_MIN = 5
export const INQUIRY_CONTENT_MAX = 2_000

/**
 * 계정 ID 는 숫자 문자열이다. 서식을 DB CHECK 로 강제하지 않는 이유는 마이그레이션
 * 주석에 적힌 대로 "본인 확인용"이기 때문이라, 여기서도 **입력했을 때만** 자릿수를 본다.
 * 모르는 사용자가 문의 자체를 못 넣는 상황을 만들지 않는다.
 */
export const ACCOUNT_ID_PATTERN = /^[0-9]{10,20}$/u

const MEGABYTE = 1024 * 1024

export const INQUIRY_ATTACHMENT_MAX_MB = Math.floor(INQUIRY_ATTACHMENT_MAX_BYTES / MEGABYTE)

/** 버킷의 `allowed_mime_types`(마이그레이션 20260908000800)와 1:1 로 맞춘다. */
export const INQUIRY_ATTACHMENT_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
]

/** 값이 목록에 있는지만 본다. DB 컬럼이 text 라 enum 으로 좁힐 수 없다. */
function optionOf(options: readonly string[], message: string) {
  return z
    .string()
    .trim()
    .refine((value) => options.includes(value), { message })
}

export const createInquirySchema = z.object({
  /* 빈 문자열은 "입력하지 않음"으로 본다. DB 는 null 을 받는다. */
  accountId: z
    .string()
    .trim()
    .refine((value) => value === '' || ACCOUNT_ID_PATTERN.test(value), {
      message: '계정 ID 는 숫자 10~20자리로 입력해 주세요.',
    })
    .transform((value) => (value === '' ? null : value)),
  category: optionOf(INQUIRY_CATEGORIES, '카테고리를 선택해 주세요.'),
  type: optionOf(INQUIRY_TYPES, '유형을 선택해 주세요.'),
  title: z
    .string()
    .trim()
    .min(INQUIRY_TITLE_MIN, { message: `제목은 ${INQUIRY_TITLE_MIN}자 이상 입력해 주세요.` })
    .max(INQUIRY_TITLE_MAX, { message: `제목은 ${INQUIRY_TITLE_MAX}자 이하로 입력해 주세요.` }),
  content: z
    .string()
    .trim()
    .min(INQUIRY_CONTENT_MIN, { message: `내용은 ${INQUIRY_CONTENT_MIN}자 이상 입력해 주세요.` })
    .max(INQUIRY_CONTENT_MAX, { message: `내용은 ${INQUIRY_CONTENT_MAX}자 이하로 입력해 주세요.` }),
  /* DB 에 `privacy_consent` CHECK 가 걸려 있어 미동의는 어차피 저장되지 않는다.
     여기서 먼저 막아 제약 위반(23514) 대신 사람이 읽는 문구를 돌려준다. */
  consent: z.literal(true, { message: '개인정보 수집 및 이용에 동의해 주세요.' }),
})

export type CreateInquiryInput = z.infer<typeof createInquirySchema>

export type InquiryAttachmentCheck = { ok: true } | { ok: false; message: string }

/** 파일 객체의 필요한 부분만 본다(File 없이도 단위 테스트할 수 있게). */
export type UploadCandidate = { name: string; type: string; size: number }

/**
 * 첨부 검증. 버킷에도 개수·용량·MIME 제한이 있지만 거기서 걸리면 사용자는 영문
 * 스토리지 오류만 본다. 같은 규칙을 앞단에서 재서 한국어 안내를 돌려준다.
 */
export function validateInquiryAttachments(
  files: readonly UploadCandidate[],
): InquiryAttachmentCheck {
  if (files.length > INQUIRY_ATTACHMENT_MAX_COUNT) {
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
      return { ok: false, message: 'jpg · png · gif · pdf 파일만 올릴 수 있습니다.' }
    }

    if (file.size > INQUIRY_ATTACHMENT_MAX_BYTES) {
      return {
        ok: false,
        message: `첨부파일은 각 ${INQUIRY_ATTACHMENT_MAX_MB}MB 이하만 올릴 수 있습니다.`,
      }
    }
  }

  return { ok: true }
}
