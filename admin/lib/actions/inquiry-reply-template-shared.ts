import { revalidatePath } from 'next/cache'

import { readField } from '@/lib/actions/form-state'

/**
 * 답변 템플릿 액션이 함께 쓰는 문구 · 폼 읽기 · 캐시 무효화.
 *
 * 액션 파일에서 떼어 낸 이유는 길이 때문만이 아니다 — "무엇이 실패 문구인가"가
 * 한곳에 모여 있어야 등록·수정·삭제가 같은 말을 쓴다(운영자는 같은 실패를 화면마다
 * 다른 문장으로 읽으면 다른 문제라고 생각한다).
 */

export const INQUIRY_REPLY_TEMPLATES_PATH = '/inquiries/reply-templates'

export const TEMPLATE_NOT_FOUND = '템플릿을 찾을 수 없습니다.'

export const TEMPLATE_AUDIT_TABLE = 'inquiry_reply_templates'

const DUPLICATE_NAME = '같은 카테고리에 같은 이름의 템플릿이 있습니다.'

const CATEGORY_GONE = '고른 카테고리가 사라졌습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.'

/* 무효화할 곳은 이 목록 화면 하나다. 문의 상세('템플릿 불러오기'의 선택지)는
   `force-dynamic` 이라 요청마다 다시 읽고, 사용자 사이트는 이 테이블을 보지 않는다. */
export function revalidateInquiryReplyTemplates(): void {
  revalidatePath(INQUIRY_REPLY_TEMPLATES_PATH)
}

/**
 * 제약 위반을 운영자가 고칠 수 있는 문구로 옮긴다. 그 밖은 `null`(= 일반 실패).
 *
 * 23505 는 같은 묶음의 이름 중복(`inquiry_reply_templates_name_key`), 23503 은 그 사이
 * 카테고리가 지워진 경우다. 둘 다 "잠시 후 다시"로 뭉개면 운영자가 같은 실패를 반복한다.
 */
export function toTemplateFieldError(code: string | undefined): Record<string, string> | null {
  if (code === '23505') {
    return { name: DUPLICATE_NAME }
  }

  if (code === '23503') {
    return { categoryId: CATEGORY_GONE }
  }

  return null
}

/** 폼 → 스키마 입력. 체크박스는 값이 없으면 아예 오지 않는다(= 꺼짐). */
export function readTemplateInput(formData: FormData) {
  return {
    categoryId: readField(formData, 'categoryId'),
    name: readField(formData, 'name'),
    body: readField(formData, 'body'),
    isActive: formData.get('isActive') !== null,
  }
}
