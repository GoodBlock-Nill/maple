import { Button } from '@/components/ui/Button'

/**
 * 발행본 잠금 안내.
 *
 * 예전에는 발행 카드 **아래** 회색 한 줄이었다. 잠긴 폼을 마주한 운영자가 가장 먼저
 * 묻는 것은 "왜 안 고쳐지는가"인데, 그 답이 화면 끝에 있으면 잠금을 고장으로 읽는다.
 * 그래서 폼 맨 위에 두고, 다음 행동(새 초안)을 버튼으로 함께 준다.
 */
export function LegalReadOnlyBanner({
  newDraftHref,
  historyHref,
}: {
  /** `?from=<id>` — 이 개정본의 본문을 복사한 새 초안. */
  newDraftHref: string
  historyHref: string
}) {
  return (
    <div
      role="status"
      data-testid="legal-readonly-banner"
      className="rounded-card border-warn/25 bg-warn-soft mb-5 flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
    >
      <div className="flex flex-col gap-1">
        <p className="text-warn text-[14px] font-bold">발행된 개정본은 수정할 수 없습니다.</p>
        <p className="text-warn text-[13px]">
          문안을 바꾸려면 이 버전을 복사한 새 초안에서 작업하세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button href={newDraftHref} size="sm">
          이 버전으로 새 초안 만들기
        </Button>
        <Button href={historyHref} variant="secondary" size="sm">
          이력 보기
        </Button>
      </div>
    </div>
  )
}
