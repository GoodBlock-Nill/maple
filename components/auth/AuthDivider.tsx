import { cn } from '@/lib/utils/cn'

type AuthDividerProps = {
  /** 시안은 로그인 #666 · 회원가입 #111 로 글자색만 다르다. */
  tone?: 'muted' | 'ink'
}

/** "또는" 구분선 — 양쪽 2px 선(rgba(102,102,102,.25)) + 가운데 문구, 사이 23px. */
export function AuthDivider({ tone = 'muted' }: AuthDividerProps) {
  return (
    <div className="flex h-6 items-center gap-[23px]">
      <span aria-hidden className="h-0.5 flex-1 bg-[rgba(102,102,102,0.25)]" />
      <span
        className={cn(
          'text-[17px] leading-none sm:text-[20px]',
          tone === 'ink' ? 'text-[#111]' : 'text-[#666]',
        )}
      >
        또는
      </span>
      <span aria-hidden className="h-0.5 flex-1 bg-[rgba(102,102,102,0.25)]" />
    </div>
  )
}
