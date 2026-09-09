'use client'

import { useId, useState } from 'react'

import { DialogShell } from '@/components/ui/DialogShell'
import { CloseIcon } from '@/components/ui/icons'
import { youtubeEmbedUrl } from '@/lib/utils/youtube'

import type { ReactNode } from 'react'

type HeroVideoButtonProps = {
  youtubeId: string
  title: string
  /** 썸네일. 눌리는 면 전체가 버튼이다. */
  children: ReactNode
  className?: string
}

/**
 * 유튜브 배너의 썸네일 버튼 + 재생 모달.
 *
 * 히어로 안에서 바로 자동 재생하지 않는다 — 배너 자리는 카드 한 장 크기라
 * 영상이 너무 작고, 캐릭터 GIF 와 동시에 움직이면 시안의 리듬이 깨진다.
 * 누르면 모달에서 자동 재생(`youtubeEmbedUrl`, nocookie 도메인)한다.
 */
export function HeroVideoButton({ youtubeId, title, children, className }: HeroVideoButtonProps) {
  const [isOpen, setOpen] = useState(false)
  const titleId = useId()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title} 영상 재생`}
        className={className}
      >
        {children}
      </button>

      <DialogShell
        open={isOpen}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        className="max-w-[960px] p-3 sm:p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 id={titleId} className="text-ink truncate text-[16px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="rounded-bar text-ink hover:bg-ink/8 inline-flex size-10 shrink-0 items-center justify-center"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-[14px] bg-black">
          <iframe
            src={youtubeEmbedUrl(youtubeId)}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="size-full border-0"
          />
        </div>
      </DialogShell>
    </>
  )
}
