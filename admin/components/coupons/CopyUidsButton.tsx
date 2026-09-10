'use client'

import { useState } from 'react'

import { Button, useToast } from '@/components/ui'

/**
 * 지금 표에 보이는 UID 를 한 줄에 하나씩 클립보드로 옮긴다.
 *
 * 게임팀에 넘기는 형식이 **줄바꿈으로 구분한 UID 목록**이다. CSV 를 만들지 않는 이유는
 * 받는 쪽이 스프레드시트를 열지 않고 사내 도구의 입력칸에 그대로 붙여 넣기 때문이다 —
 * 헤더와 따옴표가 섞이면 그 자리에서 손으로 지워야 한다.
 *
 * 복사 대상은 **화면에 보이는 것**이다(상태 탭·페이지가 적용된 목록). 그래야 "대기
 * 건만 골라 넘긴다"가 탭 하나로 끝나고, 무엇을 복사했는지가 화면에 남는다.
 *
 * `navigator.clipboard` 는 보안 컨텍스트(https · localhost)에서만 동작한다. 실패하면
 * 조용히 넘어가지 않고 그 사실을 토스트로 알린다 — 붙여 넣었더니 이전 내용이
 * 들어가는 것이 가장 나쁘다.
 */
export function CopyUidsButton({ uids }: { uids: readonly string[] }) {
  const { showToast } = useToast()
  const [isCopying, setCopying] = useState(false)

  async function copy() {
    if (uids.length === 0) {
      return
    }

    setCopying(true)

    try {
      await navigator.clipboard.writeText(uids.join('\n'))
      showToast(`UID ${uids.length}개를 복사했습니다.`, 'success')
    } catch {
      showToast('복사하지 못했습니다. 표에서 직접 선택해 복사해 주세요.', 'error')
    } finally {
      setCopying(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy} disabled={uids.length === 0 || isCopying}>
      {isCopying ? '복사 중…' : `UID 복사 (${uids.length})`}
    </Button>
  )
}
