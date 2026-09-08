/**
 * 인증 화면 레이아웃.
 *
 * 사이드바가 없는 유일한 영역이다. 로그인 전에는 메뉴를 보여 줄 이유가 없고,
 * 보여 주면 눌러 봤자 전부 다시 로그인으로 튕긴다.
 */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="bg-sidebar flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      {children}
    </div>
  )
}
