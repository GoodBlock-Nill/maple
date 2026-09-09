'use client'

import { usePathname, useSearchParams } from 'next/navigation'

import { signOutAction } from '@/lib/actions/auth-actions'
import { navBreadcrumb } from '@/lib/nav'

import type { AdminUser } from '@/lib/auth/require-admin'

/**
 * 상단 바 — 브레드크럼 · 현재 관리자 · 로그아웃.
 *
 * 로그아웃은 `<form action={서버 액션}>` 이다. `onClick` + fetch 로 만들면
 * 자바스크립트가 죽었을 때 로그아웃 자체가 불가능해진다(관리자 화면에서는
 * 그게 곧 보안 문제다).
 */
export function Topbar({ admin, onOpenSidebar }: { admin: AdminUser; onOpenSidebar: () => void }) {
  const pathname = usePathname()
  /* 프리셋 메뉴(`/inquiries?source=email`)는 쿼리로만 구분된다 — 브레드크럼도 같이 본다. */
  const search = useSearchParams()
  const crumbs = navBreadcrumb(pathname, search)

  return (
    <header className="border-line bg-surface/95 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:px-8">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="메뉴 열기"
        className="border-line text-ink hover:bg-page focus-visible:outline-focus rounded-panel inline-flex h-9 w-9 items-center justify-center border focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <nav aria-label="현재 위치" className="min-w-0 flex-1">
        <ol className="text-muted flex items-center gap-1.5 text-[13px]">
          {crumbs.length === 0 ? (
            <li className="text-ink font-semibold">관리자</li>
          ) : (
            crumbs.map((crumb, index) => (
              <li key={crumb} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-line">
                    /
                  </span>
                )}
                <span
                  className={index === crumbs.length - 1 ? 'text-ink font-semibold' : undefined}
                >
                  {crumb}
                </span>
              </li>
            ))
          )}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden flex-col items-end leading-tight sm:flex">
          <span className="text-ink text-[13px] font-semibold">{admin.nickname}</span>
          <span className="text-muted text-[12px]">
            {admin.roleName ?? '역할 미지정'} · {admin.email}
          </span>
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="border-line text-muted hover:bg-page hover:text-ink focus-visible:outline-focus rounded-panel h-9 border px-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  )
}
