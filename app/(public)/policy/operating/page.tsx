import Link from 'next/link'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { PolicySectionArticle } from '@/components/policy/PolicySectionArticle'
import { PolicyToc } from '@/components/policy/PolicyToc'
import { Container } from '@/components/ui/Container'
import {
  OPERATING_POLICY_ADDENDUM,
  OPERATING_POLICY_EFFECTIVE_DATE,
  OPERATING_POLICY_SECTIONS,
  OPERATING_POLICY_TITLE,
  OPERATING_POLICY_VERSION,
} from '@/lib/content/operating-policy'

import type { Metadata } from 'next'

const DESCRIPTION =
  '글자월드 이용 원칙, 이용자 권리·의무, 금지행위와 제재 기준, 복구·환불 정책, 아동·청소년 보호정책과 이의신청 절차를 안내합니다.'

export function generateMetadata(): Metadata {
  return { title: OPERATING_POLICY_TITLE, description: DESCRIPTION }
}

export default function OperatingPolicyPage() {
  return (
    <>
      <div className="bg-page-sub pt-[190px] pb-24">
        <Container className="flex max-w-[960px] flex-col gap-8">
          <header className="flex flex-col gap-3">
            <h1 className="text-ink text-[clamp(28px,4vw,44px)] font-semibold">
              {OPERATING_POLICY_TITLE}
            </h1>
            {/* 버전 선택 자리표시자 — 개정본이 하나뿐이라 지금은 현재 버전으로
                되돌아가는 링크지만, 개정본이 늘면 여기에 실제 select 를 놓는다. */}
            <div className="text-ink-muted flex flex-wrap items-center gap-3 text-[15px]">
              <span>시행일 {OPERATING_POLICY_EFFECTIVE_DATE}</span>
              <span aria-hidden className="text-line-soft">
                ·
              </span>
              <Link
                href={`/policy/operating?ver=${OPERATING_POLICY_VERSION}`}
                className="border-line-soft text-ink-muted hover:text-ink rounded-pill border px-3 py-1 text-[13px] transition-colors"
              >
                버전 {OPERATING_POLICY_VERSION}
              </Link>
            </div>
          </header>

          <PolicyToc sections={OPERATING_POLICY_SECTIONS} />

          <div className="rounded-panel border-line-soft bg-surface flex flex-col gap-12 border p-4 sm:p-10">
            {OPERATING_POLICY_SECTIONS.map((section) => (
              <PolicySectionArticle key={section.id} section={section} />
            ))}

            <section
              aria-labelledby="policy-addendum-heading"
              className="border-line-soft border-t pt-8"
            >
              <h2
                id="policy-addendum-heading"
                className="text-ink text-[22px] font-bold sm:text-[27px]"
              >
                {OPERATING_POLICY_ADDENDUM.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-1.5 pl-1">
                {OPERATING_POLICY_ADDENDUM.items.map((item) => (
                  <li
                    key={item}
                    className="text-ink-muted marker:text-line-soft list-disc pl-1 text-[17px] leading-[1.8] marker:content-['–_']"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Container>
      </div>
      <SiteFooter variant="home" />
    </>
  )
}
