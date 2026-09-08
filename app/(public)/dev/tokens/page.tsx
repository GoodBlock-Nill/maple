import { notFound } from 'next/navigation'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { SkeletonText } from '@/components/ui/Skeleton'

import {
  BADGE_SAMPLES,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  COLOR_GROUPS,
  RADIUS_SAMPLES,
  SURFACE_SAMPLES,
  TYPE_SCALE,
} from './tokens-data'

import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import type { Swatch } from './tokens-data'

export const metadata: Metadata = {
  title: '디자인 토큰',
  robots: { index: false, follow: false },
}

export default function TokensPage(_props: PageProps<'/dev/tokens'>) {
  // 내부 확인용 페이지라 운영 배포 대상이 아니다. 프로덕션에서 접근하면 404.
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <>
      <div className="pt-32 pb-16">
        <Container className="flex flex-col gap-10">
          <header className="flex flex-col gap-3">
            <Badge color="red" className="self-start">
              개발용 페이지
            </Badge>
            <h1 className="text-4xl font-semibold tracking-[-0.03em]">
              디자인 토큰 &amp; 프리미티브
            </h1>
            <p className="text-ink-muted max-w-2xl text-[15px]">
              운영 배포 대상이 아닌 내부 확인용 페이지입니다. 값은 app/globals.css, 뱃지 매핑은
              lib/constants/categories.ts에서 관리합니다.
            </p>
          </header>

          <Section title="Color">
            <div className="flex flex-col gap-6">
              {COLOR_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold">
                    {group.title}
                    <span className="text-ink-muted ml-2 font-medium">{group.description}</span>
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                    {group.items.map((item) => (
                      <SwatchChip key={item.name} swatch={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Surface">
            <div className="rounded-panel grid gap-4 bg-[linear-gradient(120deg,#9fd8ff,#ffd6f2)] p-6 sm:grid-cols-3">
              {SURFACE_SAMPLES.map((surface) => (
                <div
                  key={surface.label}
                  className={`rounded-card flex h-28 items-end p-4 text-[12px] font-semibold ${surface.className}`}
                >
                  {surface.label}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Button">
            <div className="rounded-panel flex flex-col gap-4 bg-[linear-gradient(120deg,#bfe9ff,#eaf6ff)] p-5">
              {BUTTON_VARIANTS.map((variant) => (
                <div key={variant} className="flex flex-wrap items-center gap-3">
                  <span className="text-ink-muted w-20 shrink-0 text-[12px] font-semibold">
                    {variant}
                  </span>
                  {BUTTON_SIZES.map((size) => (
                    <Button key={size} variant={variant} size={size}>
                      바로가기 {size}
                    </Button>
                  ))}
                  <Button variant={variant} size="md" disabled>
                    disabled
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Badge / Card / Form">
            <div className="grid gap-5 lg:grid-cols-3">
              <Card>
                <CardHeader title="공지사항" />
                <CardBody className="gap-3">
                  {BADGE_SAMPLES.slice(0, 4).map((badge) => (
                    <div key={badge.color} className="flex items-center gap-3">
                      <Badge color={badge.color}>{badge.label}</Badge>
                      <span className="truncate text-sm">샘플 게시글 제목입니다</span>
                    </div>
                  ))}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="EmptyState / Skeleton" />
                <CardBody className="gap-4">
                  <EmptyState
                    title="등록된 글이 없습니다."
                    description="첫 번째 글을 작성해 보세요."
                  />
                  <SkeletonText lines={3} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Form" />
                <CardBody className="gap-4">
                  <Input
                    label="닉네임"
                    placeholder="닉네임을 입력하세요"
                    hint="2~12자, 공백 불가"
                  />
                  <Input
                    label="이메일"
                    type="email"
                    defaultValue="wrong"
                    error="형식이 올바르지 않습니다."
                  />
                </CardBody>
              </Card>
            </div>
          </Section>

          <Section title="Typography">
            <div className="rounded-card border-line bg-surface flex flex-col gap-4 border p-5">
              {TYPE_SCALE.map((type) => (
                <div key={type.label} className="flex flex-col gap-1">
                  <span className="text-ink-muted text-[12px] font-semibold">{type.label}</span>
                  <p className={type.className}>글자월드 Design System 0123</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Radius">
            <div className="flex flex-wrap gap-4">
              {RADIUS_SAMPLES.map((radius) => (
                <div key={radius.label} className="flex flex-col items-center gap-2">
                  <div
                    className={`border-line bg-surface shadow-card size-24 border ${radius.className}`}
                  />
                  <span className="text-ink-muted text-[12px]">{radius.label}</span>
                </div>
              ))}
            </div>
          </Section>
        </Container>
      </div>
      <SiteFooter variant="home" />
    </>
  )
}

type SectionProps = {
  title: string
  children: ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  )
}

function SwatchChip({ swatch }: { swatch: Swatch }) {
  return (
    <div className="rounded-card border-line bg-surface overflow-hidden border">
      <div
        className={`flex h-16 items-end justify-end p-2 ${swatch.className} ${
          swatch.isDark ? 'text-white/70' : 'text-ink/50'
        }`}
      >
        <span className="text-[11px] font-semibold">Aa</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-ink text-[12px] font-semibold">{swatch.name}</p>
        <p className="text-ink-muted text-[11px] uppercase">{swatch.hex}</p>
      </div>
    </div>
  )
}
