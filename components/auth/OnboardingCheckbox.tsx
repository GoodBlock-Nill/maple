'use client'

import { CheckOnGlyph } from '@/components/auth/auth-icons'
import { CHECKBOX_BOX_CLASS, CHECKBOX_INPUT_CLASS } from '@/components/auth/onboarding-styles'

type OnboardingCheckboxProps = {
  /** FormData 키. 서버 액션(`completeOnboarding`)이 이 이름으로 읽는다. */
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** 라벨 텍스트를 쓰지 않는 자리(전체 동의)에서 접근성 이름을 직접 준다. */
  'aria-label'?: string
}

/**
 * 회원가입 화면의 체크박스 22(폰 18) — 시안 27:5222.
 *
 * 진짜 `<input type="checkbox">` 를 그대로 두되 투명하게 덮어 두고, 보이는 그림은
 * **리액트 상태로** 그린다. 두 가지를 동시에 지키기 위해서다.
 *   - 폼 제출·키보드·스크린리더·자동화 도구는 네이티브 입력을 그대로 쓴다
 *     (`sr-only` 로 숨기면 클릭 지점이 1px 로 쪼그라들어 다른 요소에 가린다).
 *   - 그림은 `:checked` 의사 클래스나 배경 이미지 요청에 기대지 않는다 — 전체
 *     동의가 네 칸을 한꺼번에 켜는 화면이라 "상태는 켜졌는데 그림만 그대로"인
 *     상황이 생기면 사용자가 무엇이 동의됐는지 알 수 없다.
 */
export function OnboardingCheckbox({
  name,
  checked,
  onChange,
  'aria-label': ariaLabel,
}: OnboardingCheckboxProps) {
  return (
    <span className={CHECKBOX_BOX_CLASS}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={ariaLabel}
        className={CHECKBOX_INPUT_CLASS}
      />
      {checked ? (
        <CheckOnGlyph className="pointer-events-none size-full" />
      ) : (
        <span
          aria-hidden
          className="pointer-events-none size-full rounded-[4px] border border-[#e5e5ec] bg-white"
        />
      )}
    </span>
  )
}
