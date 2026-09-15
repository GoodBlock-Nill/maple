'use client'

import { Button } from '@/components/ui/Button'

import type { NewsHideCounts } from '@/lib/validation/news-state-eligibility'

/**
 * 뉴스 목록의 일괄 처리 바.
 *
 * 표를 감싼 `<form>` 안에 그려진다 — 숨김·해제 버튼은 제출 버튼이고, 누른 버튼의
 * `name="intent"`/`value` 가 체크박스(`ids`)와 함께 FormData 에 실린다. 그래서 이
 * 컴포넌트는 `onClick` 핸들러를 받지 않는다(삭제만 예외, 아래).
 *
 * 숨김은 발행된 글에만, 해제는 숨긴 글에만 걸린다(`countEligible`, 서버 액션과 같은
 * 규칙). 몇 건이 실제로 처리될지 버튼 옆에 적어 둔다 — 20건을 고르고 눌렀는데 3건만
 * 처리되는 것을 누른 **뒤에** 알게 되면 조치를 되짚어야 한다. `aria-live="polite"`
 * 영역 안이라 선택이 바뀌면 개수도 함께 읽힌다.
 *
 * 삭제만 콜백인 이유는 확인 다이얼로그를 거치기 때문이다. 다이얼로그 버튼은 표
 * 밖에 있어 제출 버튼으로 둘 수 없다.
 */

type NewsBulkBarProps = {
  selectedCount: number
  /** 고른 것 중 숨김·해제 대상 건수. */
  counts: NewsHideCounts
  /** 폼 제출(숨김·해제) 진행 중. */
  isPending: boolean
  /** 삭제 트랜지션 진행 중. */
  isDeleting: boolean
  onDeleteClick: () => void
}

export function NewsBulkBar({
  selectedCount,
  counts,
  isPending,
  isDeleting,
  onDeleteClick,
}: NewsBulkBarProps) {
  return (
    <div
      aria-live="polite"
      className="border-line bg-page/60 flex min-h-11 flex-wrap items-center gap-2 border-b px-4 py-2"
    >
      <span className="text-muted text-[13px]">{selectedCount}건 선택</span>
      <Button
        type="submit"
        name="intent"
        value="hide"
        variant="secondary"
        size="sm"
        disabled={counts.hide === 0 || isPending}
      >
        선택 숨김
      </Button>
      <Button
        type="submit"
        name="intent"
        value="unhide"
        variant="secondary"
        size="sm"
        disabled={counts.unhide === 0 || isPending}
      >
        선택 숨김 해제
      </Button>
      {selectedCount > 0 && (
        <span className="text-muted text-[12px]">
          발행 {counts.hide}건 · 숨김 {counts.unhide}건
        </span>
      )}
      <Button
        variant="danger"
        size="sm"
        disabled={selectedCount === 0 || isPending || isDeleting}
        onClick={onDeleteClick}
      >
        선택 삭제
      </Button>
    </div>
  )
}
