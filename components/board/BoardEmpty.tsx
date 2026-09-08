import { EmptyState } from '@/components/ui/EmptyState'

type BoardEmptyProps = {
  title?: string
  description?: string
}

export function BoardEmpty({
  title = '표시할 글이 없습니다',
  description = '검색어나 카테고리를 바꿔서 다시 찾아보세요.',
}: BoardEmptyProps) {
  return (
    <EmptyState title={title} description={description} className="bg-surface border-line-soft" />
  )
}
