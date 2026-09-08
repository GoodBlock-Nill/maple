import { SiteHeader } from '@/components/layout/SiteHeader'

const MAIN_ID = 'main-content'

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className="rounded-pill focus:bg-ink focus:shadow-card-hover sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      {/* 푸터는 페이지마다 배경·마스코트가 달라 각 페이지(또는 PageShell)가 직접 렌더한다. */}
      <main id={MAIN_ID} className="flex-1">
        {children}
      </main>
    </>
  )
}
