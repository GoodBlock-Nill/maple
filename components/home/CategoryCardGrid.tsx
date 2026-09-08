import { CategoryCard } from '@/components/home/CategoryCard'
import { CATEGORY_CARDS } from '@/components/home/category-cards'
import { cn } from '@/lib/utils/cn'

type CategoryCardGridProps = {
  className?: string
}

/**
 * 1440 이상: 카드가 각자 absolute 좌표 + 회전으로 흩뿌려진다(시안).
 * 그 미만: 흐름 그리드(1~2열, 회전 없음)로 폴백한다 — 1440 좌표를 좁은
 * 컨테이너에 그대로 쓰면 우측 카드가 섹션 밖으로 잘린다.
 */
export function CategoryCardGrid({ className }: CategoryCardGridProps) {
  return (
    <ul
      className={cn(
        /* `justify-items-center` 는 그리드 아이템을 max-content 로 줄여 카드의
           `w-full` 이 0 이 된다(640 미만에서 카드가 통째로 사라졌다).
           칸은 늘려 두고 카드 자체를 `mx-auto` 로 가운데 둔다. */
        'card-deck frame:block frame:gap-0 grid grid-cols-1 gap-8 md:grid-cols-2',
        className,
      )}
    >
      {CATEGORY_CARDS.map((card) => (
        <li key={card.key} className="frame:contents">
          <CategoryCard card={card} />
        </li>
      ))}
    </ul>
  )
}
