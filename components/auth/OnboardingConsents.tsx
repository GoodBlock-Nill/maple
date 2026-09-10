'use client'

import Link from 'next/link'

import { ChevronRightGlyph } from '@/components/auth/auth-icons'
import { CONSENT_ROW_CLASS, CONSENT_TEXT_CLASS } from '@/components/auth/onboarding-styles'
import { OnboardingCheckbox } from '@/components/auth/OnboardingCheckbox'
import { CONSENT_ITEMS, ONBOARDING_COPY } from '@/lib/content/onboarding'
import { cn } from '@/lib/utils/cn'

import type { ConsentItem, ConsentName } from '@/lib/content/onboarding'

/** 동의 네 칸. 만 14세 확인도 체크박스라 같은 상태에 담는다. */
export type ConsentValues = Record<ConsentName | 'ageConfirmed', boolean>

type OnboardingConsentsProps = {
  values: ConsentValues
  onToggle: (name: keyof ConsentValues, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  /** 마케팅 안내 모달을 연다(발행 문서가 없어 링크 대신 모달이다). */
  onOpenMarketing: () => void
}

const DETAIL_CLASS =
  'ml-auto flex shrink-0 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

const DETAIL_ICON_CLASS = 'size-5 md:size-6'

/** [필수]/[선택] 머리표 + 항목명. 둘 사이 간격은 시안 4 다. */
function ConsentLabel({ item }: { item: ConsentItem }) {
  return (
    <span className={CONSENT_TEXT_CLASS}>
      <span className="mr-1">{item.required ? '[필수]' : '[선택]'}</span>
      {item.label}
    </span>
  )
}

/**
 * 약관 동의 블록 — 전체 동의 · 구분선 · 항목 3개 · 만 14세 확인(시안 §약관).
 *
 * 체크 상태는 부모(`OnboardingForm`)가 들고 있다. 버튼 활성 조건이 네 칸을 한꺼번에
 * 보고, 실패 카드에서 되돌아왔을 때도 입력이 남아 있어야 하기 때문이다.
 */
export function OnboardingConsents({
  values,
  onToggle,
  onToggleAll,
  onOpenMarketing,
}: OnboardingConsentsProps) {
  const allChecked =
    values.termsAgreed && values.privacyAgreed && values.marketingAgreed && values.ageConfirmed

  return (
    <div>
      <label className="flex items-start gap-3">
        <OnboardingCheckbox name="agreeAll" checked={allChecked} onChange={onToggleAll} />
        <span>
          <span className="block text-[16px] leading-[22px] font-medium tracking-[-0.45px] text-[#1e2938] md:text-[18px] md:leading-[26px]">
            {ONBOARDING_COPY.agreeAll}
          </span>
          <span className="mt-1 block text-[14px] leading-[20px] font-medium tracking-[-0.35px] text-[#727272]">
            {ONBOARDING_COPY.agreeAllDescription}
          </span>
        </span>
      </label>

      <div aria-hidden className="mt-[14px] h-px bg-[#e5e5ec] md:mt-4" />

      <div className="mt-6 flex flex-col gap-4 md:mt-8 md:gap-5">
        {CONSENT_ITEMS.map((item) => (
          <div key={item.name} className={CONSENT_ROW_CLASS}>
            <label className="flex flex-1 items-center gap-3">
              <OnboardingCheckbox
                name={item.name}
                checked={values[item.name]}
                onChange={(checked) => onToggle(item.name, checked)}
              />
              <ConsentLabel item={item} />
            </label>

            {item.href === null ? (
              <button
                type="button"
                onClick={onOpenMarketing}
                aria-label={item.detailLabel}
                className={DETAIL_CLASS}
              >
                <ChevronRightGlyph className={DETAIL_ICON_CLASS} />
              </button>
            ) : (
              /* 새 탭으로 연다 — 같은 탭에서 문서를 열면 입력하던 닉네임과 체크가 사라진다. */
              <Link
                href={item.href}
                target="_blank"
                rel="noreferrer"
                aria-label={item.detailLabel}
                className={DETAIL_CLASS}
              >
                <ChevronRightGlyph className={DETAIL_ICON_CLASS} />
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* 화살표가 없는 행이라 PC 높이는 체크박스(22)와 같다 — 24 로 두면 아래 버튼이 밀린다. */}
      <label className={cn(CONSENT_ROW_CLASS, 'mt-6 gap-3 md:mt-8 md:h-[22px]')}>
        <OnboardingCheckbox
          name="ageConfirmed"
          checked={values.ageConfirmed}
          onChange={(checked) => onToggle('ageConfirmed', checked)}
        />
        <span className={CONSENT_TEXT_CLASS}>{ONBOARDING_COPY.ageConfirm}</span>
      </label>
    </div>
  )
}
