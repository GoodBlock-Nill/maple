import Image from 'next/image'

import { cn } from '@/lib/utils/cn'
import { formatDateIso } from '@/lib/utils/format-date'

type MetaRowProps = {
  date: string
  views: number
  likes?: number
  className?: string
}

const ICON = {
  date: { src: '/images/brand/icon-clock.svg', width: 12, height: 12 },
  views: { src: '/images/brand/icon-eye.svg', width: 15, height: 12 },
  likes: { src: '/images/brand/icon-like.svg', width: 11, height: 12 },
} as const

type MetaItemProps = {
  icon: (typeof ICON)[keyof typeof ICON]
  label: string
  value: string
}

function MetaItem({ icon, label, value }: MetaItemProps) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Image src={icon.src} alt="" width={icon.width} height={icon.height} aria-hidden />
      <span className="sr-only">{label}</span>
      {value}
    </span>
  )
}

/** 아이콘+값 묶음(gap 6)을 12px 간격으로 늘어놓는 메타 줄. */
export function MetaRow({ date, views, likes, className }: MetaRowProps) {
  return (
    <p
      className={cn(
        'text-ink flex flex-wrap items-center gap-x-3 gap-y-1 text-[16px] leading-[19px] font-medium',
        className,
      )}
    >
      <MetaItem icon={ICON.date} label="작성일" value={formatDateIso(date)} />
      <MetaItem icon={ICON.views} label="조회수" value={String(views)} />
      {likes === undefined ? null : (
        <MetaItem icon={ICON.likes} label="좋아요" value={String(likes)} />
      )}
    </p>
  )
}
