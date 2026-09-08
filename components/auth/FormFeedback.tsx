import type { FormState } from '@/lib/actions/form-state'

type FormFeedbackProps = {
  state: FormState
}

/**
 * 폼 상단 알림.
 *
 * `role="alert"` 로 스크린 리더가 제출 직후 읽도록 한다. 오류와 안내를 같은
 * 자리에서 그리되 색으로 구분한다(색만으로 구분하지 않도록 문구도 다르다).
 */
export function FormFeedback({ state }: FormFeedbackProps) {
  if (state.formError !== undefined) {
    return (
      <p
        role="alert"
        className="border-badge-red/40 text-badge-red rounded-[10px] border bg-white/70 px-4 py-3 text-[15px]"
      >
        {state.formError}
      </p>
    )
  }

  if (state.message !== undefined) {
    return (
      <p
        role="status"
        className="border-line-soft text-ink rounded-[10px] border bg-white/70 px-4 py-3 text-[15px]"
      >
        {state.message}
      </p>
    )
  }

  return null
}
