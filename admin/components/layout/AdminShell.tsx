'use client'

import { Suspense, useCallback, useState } from 'react'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ToastProvider } from '@/components/ui/Toast'

import type { AdminUser } from '@/lib/auth/require-admin'
import type { ReactNode } from 'react'

/**
 * 관리자 화면 골격.
 *
 * 사이드바 열림 상태를 사이드바와 상단 바가 함께 써야 해서 둘을 감싸는 클라이언트
 * 컴포넌트를 둔다. `children` 은 서버에서 렌더된 트리를 그대로 받으므로 페이지
 * 코드는 여전히 서버 컴포넌트다(데이터 조회가 클라이언트로 내려가지 않는다).
 */
export function AdminShell({ admin, children }: { admin: AdminUser; children: ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openSidebar = useCallback(() => setSidebarOpen(true), [])

  return (
    <ToastProvider>
      {/* 사이드바·상단 바는 `useSearchParams()` 로 프리셋 메뉴(출처 필터)를 구분한다.
          관리자 라우트는 레이아웃의 `requireAdmin()`(쿠키) 때문에 모두 동적이라 실제로
          폴백까지 가지 않지만, Next 문서가 요구하는 경계를 명시해 빌드가 정적 렌더를
          시도할 때 깨지지 않게 한다. */}
      <Suspense fallback={null}>
        <Sidebar isOpen={isSidebarOpen} onNavigate={closeSidebar} permissions={admin.permissions} />
      </Suspense>

      {/* 드로어가 열렸을 때만 존재하는 백드롭. 데스크톱(lg)에서는 아예 렌더하지 않는다. */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={closeSidebar}
          className="fixed inset-0 z-30 cursor-default bg-black/40 lg:hidden"
        />
      )}

      <div className="lg:pl-[260px]">
        <Suspense fallback={null}>
          <Topbar admin={admin} onOpenSidebar={openSidebar} />
        </Suspense>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8">{children}</main>
      </div>
    </ToastProvider>
  )
}
