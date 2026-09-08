import { PAGE_HERO } from '@/components/layout/page-hero'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

import type { PageVariant } from '@/components/layout/page-hero'
import type { CSSProperties } from 'react'

type ComingSoonProps = {
  /** PageShell 과 같은 variant — 마스코트를 가리지 않도록 상단 여백을 계산하는 기준. */
  variant: PageVariant
  /**
   * 오픈 예정 시점 등 부가 안내 한 줄. 아직 확정된 일정이 없어 기본값은
   * 비워 둔다(오너 요청 — 요청 전까지 노출하지 않음).
   */
  since?: string
  eta?: string
}

/**
 * PageShell 의 children 래퍼가 기본으로 확보하는 여백(`mt-10 xl:mt-[52px]`,
 * `components/layout/PageShell.tsx` 참고) 중 xl 이상 구간 값. 마스코트는
 * `lg:block` 부터 노출되므로(`PageShell.tsx` 백드롭 레이어), xl 기준값으로
 * 여유를 계산해 lg 구간에도 그대로 적용하면 항상 과소가 아닌 과다 여백 쪽으로
 * 안전하게 보정된다.
 */
const CONTENT_WRAPPER_MARGIN_TOP_XL_PX = 52

/**
 * 제목(h1, `clamp(36px,5vw,64px)` `leading-[1.17]`)이 xl 이상(폰트가 64px 로
 * 고정되는 구간)에서 차지하는 렌더 높이 실측값. Figma 실측이 아니라
 * 브라우저 렌더 결과를 스크린샷으로 확인해 산출했다(64 × 1.17 ≈ 74.9 → 75).
 */
const TITLE_HEIGHT_AT_XL_PX = 75

/** 마스코트 하단과 카드 상단 사이에 남기는 여유. */
const MASCOT_CLEARANCE_PX = 20

/**
 * xl 이상에서 페이지 최상단 기준 children 영역이 기본으로 시작하는 y 좌표.
 * `PageShell` 이 실제로 그리는 값과 동일한 산식이어야 하므로, 값이 바뀌면
 * 이 계산도 함께 갱신해야 한다.
 */
function defaultContentTop(variant: PageVariant): number {
  return PAGE_HERO[variant].contentTop + TITLE_HEIGHT_AT_XL_PX + CONTENT_WRAPPER_MARGIN_TOP_XL_PX
}

/**
 * 페이지 최상단 기준 마스코트 최하단 y 좌표. 마스코트가 없는 variant 는 0.
 */
function mascotBottom(variant: PageVariant): number {
  const mascots = PAGE_HERO[variant].mascots
  return mascots.reduce((max, mascot) => Math.max(max, mascot.top + mascot.height), 0)
}

/**
 * 카드가 마스코트를 가리지 않도록 `lg:` 이상에서 추가로 밀어내야 하는
 * top 여백(px). `PageShell.tsx` 의 `PAGE_HERO` 설정에서 직접 계산하므로,
 * 마스코트 좌표가 바뀌어도 이 값을 손으로 다시 맞출 필요가 없다.
 */
function mascotClearanceTopOffset(variant: PageVariant): number {
  const desired = mascotBottom(variant) + MASCOT_CLEARANCE_PX
  const extra = desired - defaultContentTop(variant)
  return Math.max(0, Math.ceil(extra))
}

/**
 * 가이드·랭킹 공용 "서비스 준비 중" 화면.
 *
 * PageShell 안(제목 아래 children 슬롯)에 얹혀 상단 배경 밴드·제목·마스코트는
 * 그대로 유지하고, 목록·필터 등 실제 콘텐츠 영역만 이 카드로 대체한다.
 * `lg` 이상(마스코트가 보이는 구간)에서는 카드가 마스코트 하단보다 아래에서
 * 시작하도록 추가 top 여백을 계산해 얹는다 — 마스코트는 `lg` 미만에서는
 * 아예 숨겨지므로(`PageShell.tsx`) 그 구간은 건드리지 않는다.
 */
export function ComingSoon({ variant, since, eta }: ComingSoonProps) {
  const metaLine = since ?? eta
  const extraTopOffset = mascotClearanceTopOffset(variant)
  const style = { '--coming-soon-mascot-clearance': `${extraTopOffset}px` } as CSSProperties

  return (
    <div
      style={style}
      className={cn(
        'rounded-panel border-line-soft shadow-card flex flex-col items-center gap-6 border bg-white px-6 py-16 text-center sm:px-10 sm:py-20',
        'lg:mt-[var(--coming-soon-mascot-clearance)]',
      )}
    >
      <h2 className="text-ink text-title-lg font-bold">서비스 준비 중입니다</h2>
      <p className="text-ink-muted max-w-[480px] text-prose leading-[1.6]">
        더 재미있게 준비해서 곧 만나요! 오픈 소식은 뉴스에서 먼저 알려드릴게요.
      </p>
      {metaLine ? <p className="text-ink-muted text-[15px]">{metaLine}</p> : null}
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button href="/news" variant="dark" size="lg" className="w-full sm:w-auto">
          뉴스 보러가기
        </Button>
        <Button href="/" variant="light" size="lg" className="w-full sm:w-auto">
          홈으로
        </Button>
      </div>
    </div>
  )
}
