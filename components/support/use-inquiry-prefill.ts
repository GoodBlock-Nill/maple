'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { findInquiryCategory, isDiscardableContent } from '@/lib/utils/inquiry-prefill'

import type { InquiryCategoryOption } from '@/types/domain'

/**
 * 카테고리 선택 ↔ 문의 내용 프리필의 상태 기계.
 *
 * 화면(`InquiryFields`)이 마크업만 그리도록 판정과 상태를 여기 모았다. 흐름은 셋뿐이다.
 *
 *   고른다 → 지울 것이 없다 → 곧바로 양식을 채운다
 *   고른다 → 사용자가 쓴 내용이 있다 → `pendingLabel` 을 세우고 화면이 확인 모달을 연다
 *   확인 → 갈아 끼운다 / 취소 → 아무 일도 없다(셀렉트는 이전 값 그대로 다시 그려진다)
 *
 * 셀렉트와 textarea 를 **제어 입력**으로 두는 이유는 취소 때문이다. 비제어로 두면
 * 사용자가 이미 바꾼 셀렉트를 되돌릴 수단이 없어, 모달에서 취소해도 화면의
 * 카테고리와 내용이 어긋난 채 제출된다.
 */
export type InquiryPrefillState = {
  category: string
  content: string
  /** 확인 대기 중인 카테고리 라벨. null 이면 모달을 닫는다. */
  pendingLabel: string | null
  /** 선택된 카테고리의 안내 문구(없으면 null). */
  description: string | null
  selectCategory: (label: string) => void
  setContent: (value: string) => void
  confirmPending: () => void
  cancelPending: () => void
}

export function useInquiryPrefill({
  categories,
  initialCategory = '',
  initialContent = '',
}: {
  categories: readonly InquiryCategoryOption[]
  initialCategory?: string
  initialContent?: string
}): InquiryPrefillState {
  const [category, setCategory] = useState(initialCategory)
  const [content, setContent] = useState(initialContent)
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)

  /** 라벨을 확정하고 그 카테고리의 양식을 내용에 채운다(양식이 없으면 비운다). */
  const apply = useCallback(
    (label: string) => {
      setCategory(label)
      setContent(findInquiryCategory(categories, label)?.prefill ?? '')
      setPendingLabel(null)
    },
    [categories],
  )

  const selectCategory = useCallback(
    (label: string) => {
      if (label === category) {
        return
      }

      if (isDiscardableContent(content, categories)) {
        apply(label)

        return
      }

      setPendingLabel(label)
    },
    [apply, categories, category, content],
  )

  const confirmPending = useCallback(() => {
    if (pendingLabel !== null) {
      apply(pendingLabel)
    }
  }, [apply, pendingLabel])

  const cancelPending = useCallback(() => {
    setPendingLabel(null)
  }, [])

  return {
    category,
    content,
    pendingLabel,
    description: findInquiryCategory(categories, category)?.description ?? null,
    selectCategory,
    setContent,
    confirmPending,
    cancelPending,
  }
}

/** 시안의 기본 높이. 빈 칸일 때의 모습은 그대로 둔다. */
const MIN_TEXTAREA_HEIGHT = 150

/** 이보다 길어지면 상자를 더 키우지 않고 안에서 스크롤한다(폼이 화면을 삼키지 않게). */
const MAX_TEXTAREA_HEIGHT = 420

/**
 * 내용에 맞춰 늘어나는 textarea.
 *
 * 프리필 양식은 카테고리마다 길이가 다르다(3줄 ~ 13줄). 고정 높이로 두면 긴 양식은
 * 아래쪽 항목이 상자 밖에 갇히고, 사용자는 **보이지 않는 항목을 채우지 않는다.**
 * 서버 렌더에는 인라인 높이가 없으므로 하이드레이션 전에는 클래스의 기본 높이가
 * 그대로 쓰인다(빈 폼의 첫 화면이 흔들리지 않는다).
 */
export function useAutoGrowTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = ref.current

    if (element === null) {
      return
    }

    /* 먼저 auto 로 되돌려야 줄어들 때도 scrollHeight 가 실제 내용 높이를 낸다. */
    element.style.height = 'auto'
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`
  }, [value])

  return ref
}
