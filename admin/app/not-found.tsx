import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-page flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-maple text-ink text-[28px] font-bold">404</p>
      <p className="text-muted text-[14px]">요청하신 관리자 화면을 찾을 수 없습니다.</p>
      <Link
        href="/"
        className="text-accent-strong focus-visible:outline-focus text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        대시보드로 이동
      </Link>
    </div>
  )
}
