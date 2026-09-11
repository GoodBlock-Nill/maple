import {
  MYPAGE_ERROR_CLASS,
  MYPAGE_HINT_CLASS,
  MYPAGE_LABEL_CLASS,
} from '@/components/account/mypage-styles'
import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

type AccountFieldProps = {
  label: string
  htmlFor: string
  children: ReactNode
  /** 입력 아래 도움말(시안 §4의 "UID 확인: …"). 입력과 6px 떨어진다. */
  help?: string
  error?: string
  className?: string
}

/**
 * 마이페이지 폼 한 줄 — 라벨(line 26) → 10px → 컨트롤 → 6px → 도움말 → 오류.
 *
 * 오류 슬롯은 **문구가 있을 때만** 자리를 차지한다. 비워 두고 높이를 잡아 두면
 * 카드가 시안보다 길어져 그 아래의 모든 것(마케팅 박스 · 구분선 · 탈퇴 블록 ·
 * 푸터)이 밀린다.
 */
export function AccountField({
  label,
  htmlFor,
  children,
  help,
  error,
  className,
}: AccountFieldProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={htmlFor} className={MYPAGE_LABEL_CLASS}>
        {label}
      </label>

      <div className="mt-[10px]">{children}</div>

      {help === undefined ? null : (
        <p id={`${htmlFor}-help`} className={cn(MYPAGE_HINT_CLASS, 'mt-[6px]')}>
          {help}
        </p>
      )}

      {error === undefined ? null : (
        <p id={`${htmlFor}-error`} role="alert" className={MYPAGE_ERROR_CLASS}>
          {error}
        </p>
      )}
    </div>
  )
}
