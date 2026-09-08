import type { ReactNode } from 'react'

/** 로그인·재설정·초대 수락이 공유하는 카드. 폭과 여백을 한곳에서 관리한다. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="w-full max-w-[380px]">
      <p className="font-maple mb-6 text-center text-[22px] font-bold text-white">
        글자월드 <span className="text-accent">ADMIN</span>
      </p>

      <div className="rounded-card bg-surface shadow-menu px-6 py-7">
        <h1 className="text-ink text-[18px] font-bold">{title}</h1>
        {description !== undefined && <p className="text-muted mt-1 text-[13px]">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>

      {footer !== undefined && <div className="mt-4 text-center text-[13px]">{footer}</div>}
    </div>
  )
}
