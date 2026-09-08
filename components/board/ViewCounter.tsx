'use client'

import { useEffect, useRef } from 'react'

import { recordPostView } from '@/lib/actions/view-actions'

type ViewCounterProps = {
  postId: string
}

/**
 * 상세 진입 시 조회수를 한 번만 올린다.
 *
 * 렌더 중에는 쿠키를 쓸 수 없어 서버 컴포넌트에서 직접 집계할 수 없다. 마운트
 * 이후 서버 액션을 호출하는 이 빈 컴포넌트가 그 다리 역할을 한다.
 *
 * ref 가드는 React 19 개발 모드의 이펙트 이중 실행에서 중복 호출을 막는다
 * (서버 쪽 24시간 쿠키 가드가 최종 방어선이다).
 */
export function ViewCounter({ postId }: ViewCounterProps) {
  const recordedRef = useRef(false)

  useEffect(() => {
    if (recordedRef.current) {
      return
    }

    recordedRef.current = true
    void recordPostView(postId)
  }, [postId])

  return null
}
