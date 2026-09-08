import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge 는 기본 스케일만 알기 때문에 `@theme` 에서 새로 만든
 * `--radius-*` / `--shadow-*` 이름을 충돌로 인식하지 못한다. 그러면
 * `cn('rounded-pill', 'rounded-[10px]')` 이 두 클래스를 모두 남겨
 * 호출부의 재정의가 조용히 무시된다(글쓰기 버튼이 pill 로 남던 원인).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['bar', 'card', 'panel', 'pill'],
      shadow: ['card', 'card-hover', 'sheet', 'chip', 'tray', 'menu', 'top3'],
      /**
       * 반응형 서체 유틸리티(app/styles/tokens.css). 이 목록에 없으면
       * tailwind-merge 는 `text-*` 를 전부 **글자색**으로 분류한다. 그러면
       * `cn('text-ui', 'text-white')` 에서 크기 클래스가 색과 충돌한 것으로
       * 판정돼 조용히 지워진다(칩·말머리 뱃지가 15px 로 굳던 원인).
       */
      text: [
        'ui',
        'ui-sm',
        'prose',
        'input',
        'input-sm',
        'card-title',
        'card-sub',
        'title-lg',
        'title-md',
        'label-lg',
        'body-lg',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
