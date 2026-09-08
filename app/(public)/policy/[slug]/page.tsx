import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { PolicySectionArticle } from '@/components/policy/PolicySectionArticle'
import { PolicyToc } from '@/components/policy/PolicyToc'
import { Container } from '@/components/ui/Container'
import { IP_NOTICE, POLICY_LINKS } from '@/lib/constants/site'
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_VERSION,
} from '@/lib/content/privacy-policy'

import type { Metadata } from 'next'

type PolicyDoc = {
  title: string
  /** 확정 문안이 오기 전까지 노출하는 안내 문단. 구조화된 문서(`sections`)가 있으면 쓰지 않는다. */
  body: readonly string[]
  /** 넥슨 IP 고지를 이 문서에 싣는지 여부. */
  hasIpNotice: boolean
}

/**
 * 정책 문서.
 *
 * 개인정보처리방침은 `lib/content/privacy-policy.ts` 의 구조화된 문서를
 * `/policy/operating` 과 동일한 레이아웃으로 렌더링한다. 디스코드 운영정책은
 * 확정 문안이 오기 전까지 안내 문단만 보여 주는 플레이스홀더로 남겨 둔다.
 * IP 고지는 시안 푸터에 없어 여기(개인정보처리방침)로 옮겼다.
 */
const POLICY_DOCS: Record<string, PolicyDoc> = {
  privacy: {
    title: PRIVACY_POLICY_TITLE,
    body: [],
    hasIpNotice: true,
  },
  discord: {
    title: '디스코드 운영정책',
    body: [
      '글자월드 공식 디스코드 서버는 모두가 안전하게 즐길 수 있는 공간을 목표로 운영됩니다.',
      '정식 운영정책 문안은 준비 중입니다. 확정되는 대로 이 페이지에 게시합니다.',
    ],
    hasIpNotice: false,
  },
}

/** 개인정보처리방침 메타 설명. `doc.body` 는 비어 있어 별도로 둔다. */
const PRIVACY_DESCRIPTION =
  '글자월드가 수집하는 개인정보 항목, 처리 목적, 보유 기간, 위탁·국외 이전, 이용자의 권리 행사 방법을 안내합니다.'

export function generateStaticParams(): { slug: string }[] {
  return Object.keys(POLICY_DOCS).map((slug) => ({ slug }))
}

export async function generateMetadata(props: PageProps<'/policy/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const doc = POLICY_DOCS[slug]

  if (doc === undefined) {
    return {}
  }

  if (slug === 'privacy') {
    return { title: doc.title, description: PRIVACY_DESCRIPTION }
  }

  return { title: doc.title, description: doc.body[0] }
}

export default async function PolicyPage(props: PageProps<'/policy/[slug]'>) {
  const { slug } = await props.params
  const doc = POLICY_DOCS[slug]

  if (doc === undefined) {
    notFound()
  }

  const current = POLICY_LINKS.find((link) => link.href === `/policy/${slug}`)

  if (slug === 'privacy') {
    return <PrivacyPolicyPage label={current?.label} />
  }

  return (
    <>
      <div className="bg-page-sub pt-[190px] pb-24">
        <Container className="flex max-w-[840px] flex-col gap-8">
          <h1 className="text-ink text-[clamp(28px,4vw,44px)] font-semibold">
            {current?.label ?? doc.title}
          </h1>
          <div className="flex flex-col gap-4">
            {doc.body.map((paragraph) => (
              <p key={paragraph} className="text-ink-muted text-[17px] leading-[1.7]">
                {paragraph}
              </p>
            ))}
          </div>
          {doc.hasIpNotice ? (
            <section aria-labelledby="ip-notice" className="border-line-soft border-t pt-8">
              <h2 id="ip-notice" className="text-ink text-[20px] font-semibold">
                지식재산권 고지
              </h2>
              <p className="text-ink-muted mt-3 text-[15px] leading-[1.7]">{IP_NOTICE}</p>
            </section>
          ) : null}
        </Container>
      </div>
      <SiteFooter variant="home" />
    </>
  )
}

type PrivacyPolicyPageProps = {
  label?: string
}

/** 개인정보처리방침 전용 뷰 — `/policy/operating` 과 동일한 목차 + 본문 카드 레이아웃을 쓴다. */
function PrivacyPolicyPage({ label }: PrivacyPolicyPageProps) {
  return (
    <>
      <div className="bg-page-sub pt-[190px] pb-24">
        <Container className="flex max-w-[960px] flex-col gap-8">
          <header className="flex flex-col gap-3">
            <h1 className="text-ink text-[clamp(28px,4vw,44px)] font-semibold">
              {label ?? PRIVACY_POLICY_TITLE}
            </h1>
            <div className="text-ink-muted flex flex-wrap items-center gap-3 text-[15px]">
              <span>시행일 {PRIVACY_POLICY_EFFECTIVE_DATE}</span>
              <span aria-hidden className="text-line-soft">
                ·
              </span>
              <Link
                href={`/policy/privacy?ver=${PRIVACY_POLICY_VERSION}`}
                className="border-line-soft text-ink-muted hover:text-ink rounded-pill border px-3 py-1 text-[13px] transition-colors"
              >
                버전 {PRIVACY_POLICY_VERSION}
              </Link>
            </div>
          </header>

          <PolicyToc sections={PRIVACY_POLICY_SECTIONS} />

          <div className="rounded-panel border-line-soft bg-surface flex flex-col gap-12 border p-4 sm:p-10">
            {PRIVACY_POLICY_SECTIONS.map((section) => (
              <PolicySectionArticle key={section.id} section={section} />
            ))}

            <section aria-labelledby="ip-notice" className="border-line-soft border-t pt-8">
              <h2 id="ip-notice" className="text-ink text-[22px] font-bold sm:text-[27px]">
                지식재산권 고지
              </h2>
              <p className="text-ink-muted mt-4 text-[17px] leading-[1.8]">{IP_NOTICE}</p>
            </section>
          </div>
        </Container>
      </div>
      <SiteFooter variant="home" />
    </>
  )
}
