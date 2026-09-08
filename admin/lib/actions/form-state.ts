import type { ZodError } from 'zod'

/**
 * `useActionState` 로 오가는 폼 결과의 공통 모양.
 *
 * 필드 오류는 입력 옆에, `formError` 는 폼 상단에 그린다. 성공 시 대부분
 * `redirect()` 로 빠져나가므로 상태가 화면에 남지 않는다.
 */
export type FormState = {
  formError?: string
  fieldErrors?: Record<string, string>
  /** 리다이렉트하지 않는 액션(초대 메일 발송 등)의 완료 안내. */
  message?: string
}

export const EMPTY_FORM_STATE: FormState = {}

/** zod 오류를 필드별 첫 메시지로 눌러 담는다. 한 필드에 여러 줄을 띄우지 않는다. */
export function toFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path[0]

    if (typeof key === 'string' && fieldErrors[key] === undefined) {
      fieldErrors[key] = issue.message
    }
  }

  return fieldErrors
}

/** `FormData` 값을 문자열로 좁힌다. 파일이 오면 빈 문자열로 취급한다. */
export function readField(formData: FormData, name: string): string {
  const value = formData.get(name)

  return typeof value === 'string' ? value : ''
}
