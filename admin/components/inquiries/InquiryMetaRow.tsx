import type { ReactNode } from 'react'

/**
 * 문의 메타 정보의 한 줄(`<dt>` · `<dd>`).
 *
 * 웹 문의와 이메일 문의가 서로 다른 항목을 보여 주지만 **모양은 같아야 한다** —
 * 운영자가 두 화면을 오갈 때 눈이 같은 자리를 찾는다. 그래서 줄 컴포넌트만 따로 둔다.
 */
export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted text-[12px] font-semibold">{label}</dt>
      <dd className="text-ink text-[14px]">{children}</dd>
    </div>
  )
}

export function MetaList({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
}
