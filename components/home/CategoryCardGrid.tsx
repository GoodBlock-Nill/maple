import { CategoryCard } from '@/components/home/CategoryCard'
import { CATEGORY_CARDS } from '@/components/home/category-cards'
import { cn } from '@/lib/utils/cn'

type CategoryCardGridProps = {
  className?: string
}

/**
 * xl 이상: 카드가 각자 absolute 좌표 + 회전으로 흩뿌려진다(시안).
 * xl 미만: 흐름 그리드(1~2열, 회전 없음)로 폴백한다.
 */
export function CategoryCardGrid({ className }: CategoryCardGridProps) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 justify-items-center gap-8 md:grid-cols-2 xl:block xl:gap-0',
        className,
      )}
    >
      {CATEGORY_CARDS.map((card) => (
        <li key={card.key} className="xl:contents">
          <CategoryCard card={card} />
        </li>
      ))}
    </ul>
  )
}
