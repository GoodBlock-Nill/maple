'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

/**
 * 관리 화면의 오류 경계.
 *
 * 이 파일은 `(admin)/layout.tsx` **안쪽**에서 그려진다(Next 문서: error.js 는 같은
 * 세그먼트의 layout 을 감싸지 않는다). 그래서 오류가 나도 사이드바와 상단바가
 * 남아 운영자가 다른 화면으로 바로 옮겨 갈 수 있다.
 *
 * 서버 컴포넌트에서 던진 오류의 `message` 는 프로덕션에서 일반 문구로 바뀌므로
 * 화면에 띄워도 쓸모가 없다. 대신 `digest` 를 보여 준다 — 서버 로그의 같은 값과
 * 맞춰 봐야 원인을 찾을 수 있고, 그 대조는 개발팀이 한다.
 *
 * 버튼은 `reset()` 이 아니라 `retry()` 다(Next 16.3 에서 안정화). `reset()` 은
 * 다시 가져오지 않고 경계만 다시 그려, 조회가 깨진 화면에서는 같은 오류가 곧바로
 * 되돌아온다.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('[admin] 화면을 그리지 못했습니다.', error.digest ?? error.message)
  }, [error])

  return (
    <>
      <PageHeader title="오류" />

      <Card>
        <EmptyState
          title="화면을 불러오지 못했습니다."
          description={
            error.digest === undefined
              ? '잠시 후 다시 시도해 주세요. 계속 실패하면 개발팀에 알려 주세요.'
              : `잠시 후 다시 시도해 주세요. 계속 실패하면 개발팀에 오류 코드 ${error.digest}를 알려 주세요.`
          }
          action={<Button onClick={() => retry()}>다시 시도</Button>}
        />
      </Card>
    </>
  )
}
