import { notFound } from 'next/navigation'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { Container } from '@/components/ui/Container'
import { IP_NOTICE, POLICY_LINKS } from '@/lib/constants/site'

import type { Metadata } from 'next'

type PolicyDoc = {
  title: string
  /** 확정 문안이 오기 전까지 노출하는 안내 문단. */
  body: readonly string[]
  /** 넥슨 IP 고지를 이 문서에 싣는지 여부. */
  hasIpNotice: boolean
}

/**
 * 정책 문서 플레이스홀더.
 *
 * 푸터 Legal 열의 두 링크가 죽지 않도록 최소 문서만 세워 둔다.
 * IP 고지는 시안 푸터에 없어 여기(개인정보처리방침)로 옮겼다.
 * TODO(content): 확정 약관이 오면 본문을 교체한다.
 */
const POLICY_DOCS: Record<string, PolicyDoc> = {
  privacy: {
    title: '개인정보처리방침',
    body: [
      '글자월드는 이용자의 개인정보를 소중히 다루며, 관련 법령에 따라 안전하게 관리합니다.',
      '정식 개인정보처리방침 문안은 준비 중입니다. 확정되는 대로 이 페이지에 게시합니다.',
    ],
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

export function generateStaticParams(): { slug: string }[] {
  return Object.keys(POLICY_DOCS).map((slug) => ({ slug }))
}

export async function generateMetadata(props: PageProps<'/policy/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const doc = POLICY_DOCS[slug]

  if (doc === undefined) {
    return {}
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
