import {
  AUTH_ERROR_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_NOTICE_CLASS,
} from '@/components/auth/auth-scene-styles'
import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

type AuthFieldProps = {
  /** 라벨 문구. 시안에 라벨이 없는 줄(비밀번호 재입력)은 `hideLabel` 로 숨긴다. */
  label: string
  htmlFor: string
  children: ReactNode
  error?: string | null
  /** 성공·진행 안내. 오류와 같은 자리에 색만 달리 그린다. */
  notice?: string | null
  hideLabel?: boolean
  className?: string
}

/**
 * 시안(Figma 2041:2301)의 폼 한 줄 — 라벨 → 컨트롤 → 오류 슬롯.
 *
 * 오류 슬롯은 **문구가 있을 때만** 자리를 차지한다. 비워 두고 높이를 잡아 두면
 * 시안(입력 사이 24px)보다 카드가 24px 씩 길어져 푸터 위치가 어긋난다.
 */
export function AuthField({
  label,
  htmlFor,
  children,
  error,
  notice,
  hideLabel = false,
  className,
}: AuthFieldProps) {
  const message = error ?? notice ?? null

  return (
    <div className={cn('flex flex-col', className)}>
      <label htmlFor={htmlFor} className={cn(AUTH_LABEL_CLASS, hideLabel && 'sr-only')}>
        {label}
      </label>

      {/* 라벨↔입력 10px. 라벨을 숨긴 줄에서는 간격도 함께 사라진다. */}
      <div className={hideLabel ? undefined : 'mt-[10px]'}>{children}</div>

      {message === null ? null : (
        <p
          id={`${htmlFor}-message`}
          role={error === undefined || error === null ? 'status' : 'alert'}
          className={error === undefined || error === null ? AUTH_NOTICE_CLASS : AUTH_ERROR_CLASS}
        >
          {message}
        </p>
      )}
    </div>
  )
}
