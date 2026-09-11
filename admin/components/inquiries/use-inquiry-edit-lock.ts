'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  claimInquiryEditAction,
  readInquiryCollabAction,
  releaseInquiryEditAction,
} from '@/lib/actions/inquiry-lock-actions'
import {
  INQUIRY_COLLAB_POLL_MS,
  INQUIRY_LOCK_HEARTBEAT_MS,
} from '@/lib/validation/inquiry-assignment'

import type { InquiryCollabState } from '@/lib/data/inquiry-assignment'

/**
 * 답변 폼의 "작성 중" 소프트 락.
 *
 * 하는 일은 넷이다.
 *   1. 폼이 뜨면 잠금을 잡는다(`claim`). 남이 쥐고 있으면 **막힌 상태**로 시작한다.
 *   2. 60초마다 같은 호출로 하트비트를 보낸다 — 5분간 조용하면 DB 가 만료로 본다.
 *   3. 20초마다 협업 상태를 다시 읽는다. 상대가 답변을 끝내면 배너가 스스로 사라지고,
 *      내 잠금을 누가 가로채 갔으면 반대로 배너가 뜬다.
 *   4. 폼을 떠날 때 잠금을 푼다(언마운트 · 탭 닫기).
 *
 * 탭을 닫는 경우는 **보장되지 않는다.** `pagehide` 에서 시작한 요청은 브라우저가
 * 중간에 끊을 수 있다. 그래서 만료(5분)가 진짜 안전망이고, 이 정리는 "보통은 즉시
 * 풀린다"를 위한 것이다.
 */

export type InquiryLockHolder = {
  nickname: string
  /** 마지막 하트비트 시각. 배너가 "n분 전 활동"으로 옮긴다. */
  at: string | null
}

export type InquiryEditLock = {
  /** 값이 있으면 **다른 운영자가 쓰고 있다.** 폼은 이때 잠긴다. */
  lockedBy: InquiryLockHolder | null
  /** 20초 폴링으로 갱신되는 스레드 상태(답변 수 · 상태 · 담당자). */
  collab: InquiryCollabState | null
  /** "그래도 이어서 작성" — 남의 잠금을 가로챈다(감사 로그에 남는다). */
  takeOver: () => Promise<void>
  /** 저장에 성공했을 때처럼 폴링을 기다리지 않고 즉시 다시 읽는다. */
  refresh: () => Promise<void>
}

export function useInquiryEditLock({
  inquiryId,
  adminId,
  enabled,
}: {
  inquiryId: string
  adminId: string
  /** 취소·종료된 문의에는 답변 폼 자체가 없다. 그때는 잠금도 잡지 않는다. */
  enabled: boolean
}): InquiryEditLock {
  const [lockedBy, setLockedBy] = useState<InquiryLockHolder | null>(null)
  const [collab, setCollab] = useState<InquiryCollabState | null>(null)
  /* 언마운트 정리에서 "내가 쥐고 있었나"를 보려면 렌더와 무관한 값이어야 한다.
     상태로 두면 cleanup 이 옛 값을 보고 남의 잠금을 풀려 시도한다. */
  const holdsLockRef = useRef(false)

  const claim = useCallback(
    async (force: boolean) => {
      const result = await claimInquiryEditAction(inquiryId, force)

      holdsLockRef.current = result.ok
      setLockedBy(
        result.ok ? null : { nickname: result.editingNickname ?? '다른', at: result.editingAt },
      )
    },
    [inquiryId],
  )

  const refresh = useCallback(async () => {
    const state = await readInquiryCollabAction(inquiryId)

    if (state === null) {
      // 조회가 깨졌다. 마지막으로 받은 값을 그대로 둔다(빈 배너로 깜빡이지 않게).
      return
    }

    setCollab(state)

    if (state.editing === null) {
      holdsLockRef.current = false
      setLockedBy(null)

      return
    }

    if (state.editing.id === adminId) {
      holdsLockRef.current = true
      setLockedBy(null)

      return
    }

    holdsLockRef.current = false
    setLockedBy({ nickname: state.editing.nickname, at: state.editing.at })
  }, [adminId, inquiryId])

  useEffect(() => {
    if (!enabled) {
      return
    }

    /* 첫 잠금·조회도 **콜백 안에서** 부른다. 이펙트 본문에서 곧바로 상태를 바꾸면
       렌더 직후 연쇄 렌더가 나고(react-hooks/set-state-in-effect), 여기서 급할 것은
       하나도 없다 — 한 틱 뒤에 잡아도 잠금은 같은 값이다. */
    const initial = window.setTimeout(() => {
      void claim(false)
      void refresh()
    }, 0)

    const heartbeat = window.setInterval(() => {
      // 하트비트는 가로채지 않는다. 이미 남이 쥐고 있으면 막힌 상태를 유지한다.
      void claim(false)
    }, INQUIRY_LOCK_HEARTBEAT_MS)
    const poll = window.setInterval(() => void refresh(), INQUIRY_COLLAB_POLL_MS)

    const release = () => {
      if (holdsLockRef.current) {
        void releaseInquiryEditAction(inquiryId)
      }
    }

    /* `beforeunload` 가 아니라 `pagehide` 를 듣는다 — 모바일 사파리는 탭 전환에서
       beforeunload 를 부르지 않고, bfcache 로 들어갈 때도 이쪽만 온다. */
    window.addEventListener('pagehide', release)

    return () => {
      window.clearTimeout(initial)
      window.clearInterval(heartbeat)
      window.clearInterval(poll)
      window.removeEventListener('pagehide', release)
      release()
    }
  }, [claim, enabled, inquiryId, refresh])

  const takeOver = useCallback(async () => {
    await claim(true)
    await refresh()
  }, [claim, refresh])

  return { lockedBy, collab, takeOver, refresh }
}
