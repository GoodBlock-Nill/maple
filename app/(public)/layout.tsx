import { SiteHeader } from '@/components/layout/SiteHeader'
import { getCurrentUser } from '@/lib/auth/current-user'

const MAIN_ID = 'main-content'

export default async function PublicLayout({ children }: LayoutProps<'/'>) {
  // 헤더의 로그인/로그아웃 표시는 세션에 따라 달라진다. 레이아웃에서 한 번만 읽어
  // 내려보내면 페이지마다 같은 조회를 반복하지 않는다.
  const user = await getCurrentUser()

  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className="rounded-pill focus:bg-ink focus:shadow-card-hover sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>
      <SiteHeader user={user} />
      {/* 푸터는 페이지마다 배경·마스코트가 달라 각 페이지(또는 PageShell)가 직접 렌더한다. */}
      <main id={MAIN_ID} className="flex-1">
        {children}
      </main>
    </>
  )
}
