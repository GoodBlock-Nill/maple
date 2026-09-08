import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

export type AdjacentPostLink = {
  id: string
  title: string
}

type AdjacentPostNavProps = {
  /** 링크 목적지 prefix. 뉴스는 `/news`, 커뮤니티는 `/community`. */
  basePath: string
  prev: AdjacentPostLink | null
  next: AdjacentPostLink | null
  className?: string
}

const ROW_CLASS =
  'rounded-panel border-line-soft bg-surface shadow-chip flex items-center gap-4 border px-6 py-4'

const LABEL_CLASS = 'text-ink-muted w-16 shrink-0 text-[16px] font-medium sm:w-20'

type AdjacentRowProps = {
  label: string
  emptyLabel: string
  basePath: string
  item: AdjacentPostLink | null
}

/** 링크가 없으면(글 목록의 끝) 뮤트된 안내 문구만 보여준다. */
function AdjacentRow({ label, emptyLabel, basePath, item }: AdjacentRowProps) {
  if (item === null) {
    return (
      <div className={ROW_CLASS}>
        <span className={LABEL_CLASS}>{label}</span>
        <span className="text-ink-soft min-w-0 flex-1 text-[16px]">{emptyLabel}</span>
      </div>
    )
  }

  return (
    <Link
      href={`${basePath}/${item.id}`}
      className={cn(
        ROW_CLASS,
        'hover:border-ink/40 transition-[border-color,transform] duration-150 hover:-translate-y-0.5',
      )}
    >
      <span className={LABEL_CLASS}>{label}</span>
      <span className="text-ink line-clamp-1 min-w-0 flex-1 text-[16px] font-medium">
        {item.title}
      </span>
    </Link>
  )
}

/**
 * 상세 페이지 하단의 이전/다음 글 내비게이션.
 *
 * 두 행을 `line-soft` 톤의 카드로 쌓는다(목록 카드와 같은 표면). 모바일에서도
 * 레이아웃이 바뀌지 않는다 — 애초에 세로로 쌓여 있어 별도 반응형 분기가 필요 없다.
 */
export function AdjacentPostNav({ basePath, prev, next, className }: AdjacentPostNavProps) {
  return (
    <nav aria-label="이전글 다음글" className={cn('mt-6 flex flex-col gap-3', className)}>
      <AdjacentRow
        label="이전 글"
        emptyLabel="이전 글이 없습니다"
        basePath={basePath}
        item={prev}
      />
      <AdjacentRow
        label="다음 글"
        emptyLabel="다음 글이 없습니다"
        basePath={basePath}
        item={next}
      />
    </nav>
  )
}
