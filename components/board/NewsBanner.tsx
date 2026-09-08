import Image from 'next/image'

import { getNewsBanner } from '@/lib/constants/news-banners'
import { cn } from '@/lib/utils/cn'

import type { NewsCategory } from '@/types/domain'

type NewsBannerProps = {
  category: NewsCategory
  className?: string
}

/**
 * 뉴스 상세 카드 맨 위의 말머리 배너.
 *
 * 카드 폭을 꽉 채우고 원본 비율(1200:628)을 유지한다. 상세 진입 시 첫 화면에
 * 바로 보이는 이미지라 `preload` 로 미리 받는다(Next 16 에서 `priority` 는
 * `preload` 로 대체되었다).
 *
 * `sizes` 의 1088px 은 데스크톱 실측 폭이다(본문 1200 − 시트 패딩 32 − 카드
 * 패딩 80). 어림값을 넣으면 필요보다 작은 후보가 뽑혀 배너가 흐려진다.
 */
export function NewsBanner({ category, className }: NewsBannerProps) {
  const banner = getNewsBanner(category)

  return (
    <Image
      src={banner.src}
      alt={banner.alt}
      width={banner.width}
      height={banner.height}
      sizes="(min-width: 1200px) 1088px, 100vw"
      preload
      className={cn('aspect-[1200/628] w-full rounded-[12px] object-cover', className)}
    />
  )
}
