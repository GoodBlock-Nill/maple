'use client'

import Link from 'next/link'

import { FieldError } from '@/components/support/InquiryFormRow'
import { SupportCheckbox } from '@/components/support/SupportCheckbox'
import {
  PRIVACY_CONSENT_LABEL,
  PRIVACY_CONSENT_LINK_LABEL,
  PRIVACY_POLICY_PATH,
} from '@/lib/constants/support'

const CONSENT_ID = 'inquiry-consent'
const CONSENT_ERROR_ID = 'inquiry-consent-error'

type InquiryConsentFieldProps = {
  /** 서버가 돌려준 동의 항목 오류. 없으면 줄 자체가 그려지지 않는다. */
  error?: string
}

/**
 * 개인정보 수집·이용 동의 한 줄(시안: 체크박스 30 + 문구 + `내용 보기` 링크).
 *
 * 접수 폼에서 떼어 냈다 — 체크박스·라벨·링크·오류가 한 묶음으로 움직이고,
 * 단위 테스트가 폼 전체(서버 액션 포함)를 세우지 않고도 이 줄만 확인할 수 있다.
 *
 * 오류는 체크박스의 `aria-describedby` 로도 이어 둔다. 색과 자리만으로 묶으면
 * 스크린 리더 사용자는 "무엇이 잘못됐는지"를 필드에서 듣지 못한다.
 */
export function InquiryConsentField({ error }: InquiryConsentFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <SupportCheckbox
          id={CONSENT_ID}
          name="consent"
          required
          aria-describedby={error === undefined ? undefined : CONSENT_ERROR_ID}
        />
        <label htmlFor={CONSENT_ID} className="text-ui cursor-pointer text-[#1e2938]">
          {PRIVACY_CONSENT_LABEL}
        </label>
        <Link
          href={PRIVACY_POLICY_PATH}
          className="tap-area text-ui text-[#0067ff] underline underline-offset-2"
        >
          {PRIVACY_CONSENT_LINK_LABEL}
        </Link>
      </div>
      <FieldError id={CONSENT_ERROR_ID} message={error} />
    </div>
  )
}
