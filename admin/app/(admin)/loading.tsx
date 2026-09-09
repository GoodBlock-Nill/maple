import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

/** 표 골격의 줄 수. 기본 페이지 크기보다 적게 둔다 — 화면을 채우기만 하면 된다. */
const ROWS = 6

/**
 * 화면 전환 중의 골격.
 *
 * 이 파일이 있으면 Next 가 페이지를 `<Suspense>` 로 감싸므로, 조회가 느린 화면에서
 * 사이드바만 남고 본문이 비는 시간이 사라진다. 값이 아니라 **모양**만 흉내 낸다 —
 * 숫자 0 이나 "없음" 을 먼저 보여 주면 운영자가 그것을 결과로 읽는다.
 */
export default function AdminLoading() {
  return (
    <>
      <header className="mb-5 flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </header>

      <Card>
        <div className="flex flex-col gap-3 px-5 py-4" role="status" aria-live="polite">
          <span className="text-muted text-[13px]">불러오는 중…</span>

          {Array.from({ length: ROWS }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </Card>
    </>
  )
}
