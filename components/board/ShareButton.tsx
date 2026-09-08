'use client'

import { useEffect, useRef, useState } from 'react'

import { resolveShareMode } from '@/lib/utils/share'

import type { SVGProps } from 'react'

type ShareButtonProps = {
  /** 공유 시트 제목. 보통 글 제목. */
  title: string
  /** 공유 시트 본문. 보통 글 요약. */
  text: string
  /** 정식(canonical) 절대 URL. */
  url: string
}

const COPIED_NOTICE = '링크가 복사되었습니다'

const NOTICE_DURATION_MS = 2000

/** 16px 선 아이콘. 아이콘 하나뿐인 조용한 버튼이라 파일 안에 직접 둔다. */
function ShareGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className="size-4"
      {...props}
    >
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.4 10.8 15.6 6.4M8.4 13.2l7.2 4.4" />
    </svg>
  )
}

/**
 * 상세 메타 줄 오른쪽 끝의 공유 버튼.
 *
 * 모바일에는 OS 공유 시트가 있으니 그것을 먼저 쓰고, 없으면 링크를 복사한다.
 * 복사까지 막힌 환경(비보안 컨텍스트·권한 거부)에서는 주소를 그대로 드러내
 * 사용자가 직접 복사하게 한다 — 어떤 경우에도 "아무 일도 안 일어남"이 없게.
 *
 * 안내 문구와 주소 입력칸은 모두 떠 있는(absolute) 요소라 눌러도 주변 배치가
 * 밀리지 않는다.
 */
export function ShareButton({ title, text, url }: ShareButtonProps) {
  const [notice, setNotice] = useState('')
  const [isRevealed, setIsRevealed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isRevealed) {
      inputRef.current?.select()
    }
  }, [isRevealed])

  function showNotice(message: string) {
    setNotice(message)

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      setNotice('')
    }, NOTICE_DURATION_MS)
  }

  async function share() {
    const mode = resolveShareMode({
      canShare: typeof navigator.share === 'function',
      canCopy: typeof navigator.clipboard?.writeText === 'function',
    })

    if (mode === 'share') {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // 사용자가 공유 시트를 닫은 경우도 여기로 온다. 조용히 넘어간다.
      }

      return
    }

    if (mode === 'copy') {
      try {
        await navigator.clipboard.writeText(url)
        showNotice(COPIED_NOTICE)

        return
      } catch {
        // 권한이 거부되면 아래의 주소 노출로 떨어진다.
      }
    }

    setIsRevealed(true)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void share()
        }}
        aria-label="링크 공유"
        title="공유"
        className="text-ink-muted hover:bg-sheet hover:text-ink focus-visible:outline-focus inline-flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ShareGlyph />
      </button>

      <span
        role="status"
        aria-live="polite"
        className={
          notice === ''
            ? 'sr-only'
            : 'bg-ink shadow-menu rounded-pill absolute top-full right-0 z-10 mt-2 px-3 py-1.5 text-[13px] leading-none font-medium whitespace-nowrap text-white'
        }
      >
        {notice}
      </span>

      {isRevealed ? (
        <input
          ref={inputRef}
          readOnly
          value={url}
          aria-label="공유 링크"
          className="border-line-soft text-ink shadow-menu absolute top-full right-0 z-10 mt-2 w-[260px] rounded-[8px] border bg-white px-2 py-1.5 text-[13px]"
        />
      ) : null}
    </div>
  )
}
