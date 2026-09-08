import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge 는 기본 스케일만 알기 때문에 `@theme` 에서 새로 만든
 * `--radius-*` 이름을 충돌로 인식하지 못한다. 그러면 `cn('rounded-card',
 * 'rounded-[4px]')` 이 두 클래스를 모두 남겨 호출부의 재정의가 조용히 무시된다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['card', 'panel', 'pill'],
      shadow: ['card', 'card-hover', 'menu'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
