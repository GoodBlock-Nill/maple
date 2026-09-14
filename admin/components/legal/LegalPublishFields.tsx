'use client'

import { Input } from '@/components/ui/Input'
import {
  LEGAL_PUBLISH_MODES,
  LEGAL_VERSION_MAX_LENGTH,
  type LegalPublishMode,
} from '@/lib/validation/legal'

/**
 * 발행 설정 — 버전 · 시행일 · 상태.
 *
 * 상태와 시행일을 **같은 묶음**에 둔 이유: 이 문서에서 "예약"은 별도 시각 입력이
 * 아니라 "시행일이 아직 오지 않은 발행본"이다. 두 값을 떨어뜨려 놓으면 운영자가
 * 예약을 고르고도 시행일을 오늘로 둬서 즉시 공개되는 사고가 난다.
 *
 * 선택 상태는 폼(`LegalForm`)이 들고 있다 — 저장 확인창을 띄울지(발행·예약) 말지
 * (임시저장)가 이 값으로 갈리므로, 두 곳이 각자 기억하면 확인 문구와 실제 저장이
 * 어긋난다.
 */

const MODE_LABEL: Record<LegalPublishMode, string> = {
  draft: '임시저장',
  publish: '발행',
  schedule: '예약',
}

const MODE_HINT: Record<LegalPublishMode, string> = {
  draft: '사용자 사이트에 보이지 않습니다.',
  publish: '저장과 동시에 공개됩니다. 시행일은 오늘 이하여야 합니다.',
  schedule: '시행일이 되면 자동으로 이 버전이 노출됩니다.',
}

type LegalPublishFieldsProps = {
  defaultVersion: string
  /** `2026-09-18` 형태. */
  defaultEffectiveDate: string
  mode: LegalPublishMode
  onModeChange: (mode: LegalPublishMode) => void
  /** 버전·시행일 입력. 폼의 "저장 안 함" 경고가 이 신호로 켜진다. */
  onChange?: () => void
  versionError?: string
  effectiveDateError?: string
  /** 발행본을 열었을 때는 새 버전만 만들 수 있어 상태 선택을 잠근다. */
  isLocked?: boolean
}

export function LegalPublishFields({
  defaultVersion,
  defaultEffectiveDate,
  mode,
  onModeChange,
  onChange,
  versionError,
  effectiveDateError,
  isLocked = false,
}: LegalPublishFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4" disabled={isLocked}>
      <legend className="text-ink mb-1 text-[13px] font-semibold">발행 설정</legend>

      <Input
        label="버전"
        name="version"
        required
        defaultValue={defaultVersion}
        onChange={onChange}
        maxLength={LEGAL_VERSION_MAX_LENGTH}
        hint="시행일 기준 YYYYMMDD. 같은 날 두 번 고치면 20260909-2 처럼 씁니다. 사용자 사이트 약관 화면의 버전 알약에 그대로 나옵니다."
        error={versionError}
      />

      <Input
        type="date"
        label="시행일"
        name="effectiveDate"
        required
        defaultValue={defaultEffectiveDate}
        onChange={onChange}
        hint="이 날짜부터 사용자 사이트가 이 버전을 보여 줍니다."
        error={effectiveDateError}
      />

      <div className="flex flex-col gap-2">
        {LEGAL_PUBLISH_MODES.map((value) => (
          <label key={value} className="flex items-start gap-2 text-[13px]">
            <input
              type="radio"
              name="publishMode"
              value={value}
              checked={mode === value}
              onChange={() => {
                onModeChange(value)
                onChange?.()
              }}
              className="accent-accent mt-0.5 size-4"
            />
            <span className="flex flex-col">
              <span className="text-ink font-semibold">{MODE_LABEL[value]}</span>
              <span className="text-muted text-[12px]">{MODE_HINT[value]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
