import Link from 'next/link'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { PolicyToc } from '@/components/policy/PolicyToc'
import { Container } from '@/components/ui/Container'

import type { PolicyTocEntry } from '@/components/policy/policy-prose'
import type { ReactNode } from 'react'

type PolicyDocumentShellProps = {
  /** 문서 제목. 헤더 링크(`POLICY_LINKS`)의 라벨을 그대로 쓴다. */
  heading: string
  /** `2026년 9월 18일` 표기. */
  effectiveDate: string
  version: string
  /** 버전 알약이 가리키는 주소. 개정본이 늘면 여기에 실제 select 가 온다. */
  versionHref: string
  entries: readonly PolicyTocEntry[]
  children: ReactNode
}

/**
 * 정책 문서 한 편의 껍데기 — 제목 · 시행일/버전 알약 · 목차 · 본문 카드.
 *
 * 발행본(DB HTML)과 폴백(코드 문안)이 **같은 껍데기**를 쓴다. 발행 전후로 여백이나
 * 알약 위치가 바뀌면 운영자는 자기가 뭘 망가뜨렸는지 알 수 없다.
 *
 * 카드의 `gap-12` 는 유지한다. 본문 블록 사이 간격은 각 렌더러가 알아서 주고,
 * 이 값은 "본문 ↔ 지식재산권 고지" 처럼 카드 안 큰 덩어리 사이에만 쓰인다.
 */
export function PolicyDocumentShell({
  heading,
  effectiveDate,
  version,
  versionHref,
  entries,
  children,
}: PolicyDocumentShellProps) {
  return (
    <>
      <div className="bg-page-sub pt-[190px] pb-24">
        <Container className="flex max-w-[960px] flex-col gap-8">
          <header className="flex flex-col gap-3">
            <h1 className="text-ink text-[clamp(28px,4vw,44px)] font-semibold">{heading}</h1>
            <div className="text-ink-muted flex flex-wrap items-center gap-3 text-[15px]">
              <span>시행일 {effectiveDate}</span>
              <span aria-hidden className="text-line-soft">
                ·
              </span>
              <Link
                href={versionHref}
                className="tap-area border-line-soft text-ink-muted hover:text-ink rounded-pill border px-3 py-1 text-[13px] transition-colors"
              >
                버전 {version}
              </Link>
            </div>
          </header>

          {/* 장(`<h2>`) 이 없는 문서(디스코드 안내문)는 빈 목차 상자만 남는다. */}
          {entries.length === 0 ? null : <PolicyToc entries={entries} />}

          <div className="rounded-panel border-line-soft bg-surface flex flex-col gap-12 border p-4 sm:p-10">
            {children}
          </div>
        </Container>
      </div>
      <SiteFooter variant="home" />
    </>
  )
}

type PolicyIpNoticeProps = {
  notice: string
}

/** 지식재산권 고지. 시안 푸터에 자리가 없어 개인정보처리방침 말미로 옮긴 블록이다. */
export function PolicyIpNotice({ notice }: PolicyIpNoticeProps) {
  return (
    <section aria-labelledby="ip-notice" className="border-line-soft border-t pt-8">
      <h2 id="ip-notice" className="text-ink text-[22px] font-bold sm:text-[27px]">
        지식재산권 고지
      </h2>
      <p className="text-ink-muted mt-4 text-[17px] leading-[1.8]">{notice}</p>
    </section>
  )
}
