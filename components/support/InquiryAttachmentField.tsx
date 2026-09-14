'use client'

import { useEffect, useMemo, useState } from 'react'

import { ExistingAttachmentList } from '@/components/support/InquiryAttachmentLists'
import { FieldError } from '@/components/support/InquiryFormRow'
import { InquiryUploadList } from '@/components/support/InquiryUploadList'
import { useInquiryUploads } from '@/components/support/use-inquiry-uploads'
import {
  ATTACHMENT_NOTICE_LINES,
  INQUIRY_FILE_PICK_LABEL,
} from '@/lib/constants/inquiry-attachment'
import { INQUIRY_ATTACHMENT_HEADING } from '@/lib/constants/support'
import {
  INQUIRY_ATTACHMENT_MAX_COUNT,
  INQUIRY_ATTACHMENT_TOTAL_MAX_MB,
} from '@/lib/supabase/storage'
import { formatFileSize } from '@/lib/utils/format-file-size'
import { INQUIRY_ATTACHMENT_ACCEPT, INQUIRY_UPLOAD_FIELD } from '@/lib/validation/inquiry-upload'

import type { InquiryAttachment } from '@/types/domain'
import type { ChangeEvent } from 'react'

/** 시안 v2: 파일 선택 버튼(bg #e7e7e7 · border #d5d9df · radius 5 · h40 · px16). */
const PICK_BUTTON_CLASS =
  'order-2 flex h-10 w-fit cursor-pointer items-center rounded-[5px] border border-[#d5d9df] ' +
  'bg-[#e7e7e7] px-4 focus-within:outline-2 focus-within:outline-offset-2 ' +
  'focus-within:outline-[var(--color-focus)] lg:order-1'

type InquiryAttachmentFieldProps = {
  /** 수정 모드에서 이미 올라가 있는 첨부. 접수 모드에서는 빈 배열. */
  attachments: readonly InquiryAttachment[]
  /** 서버 액션이 돌려준 오류. 선택 즉시 잡은 오류보다 오래 남는다. */
  error: string | undefined
  /**
   * 제출을 막아야 하는 상태(준비 중 · 업로드 중 · 규칙에 어긋난 선택)를 폼에 알린다.
   *
   * 규칙에 어긋난 선택에서도 잠그는 이유는 "첨부가 조용히 빠진 접수"를 막기
   * 위해서다 — 파일을 지우고 버튼을 열어 두면 오류를 못 본 사용자가 첨부 없는
   * 문의를 접수하고, 운영자는 근거 자료 없는 문의를 받는다.
   */
  onBlockedChange?: (isBlocked: boolean) => void
}

/**
 * 첨부 입력 — 이미지 · PDF · 영상이 **같은 길**로 간다(2026-09-14).
 *
 * 예전에는 이미지·PDF 만 폼과 함께 서버 액션 본문에 실려 갔고 영상만 직접 올라갔다.
 * 그래서 "사진은 3장·각 5MB, 영상은 2편·각 100MB" 같은 두 개의 표가 필요했다. 지금은
 * 무엇을 고르든 고르는 즉시 브라우저가 버킷으로 올리고(`useInquiryUploads`), 폼에는
 * 올라간 오브젝트의 경로만 숨은 필드로 싣는다. 남은 규칙은 하나다 —
 * 형식 불문 최대 5개 · 합계 200MB.
 *
 * 그래서 **고른 파일은 input 의 FileList 에 남기지 않는다**. 남겨 두면 본문(2MB)에
 * 그대로 실려 나가 요청이 액션에 닿기도 전에 끊긴다.
 *
 * 고른 사진은 올리기 전에 한 번 줄인다(커뮤니티 본문 이미지와 같은 헬퍼) — 요즘
 * 휴대폰 사진은 그대로 두면 몇 장만으로 합계 상한에 닿는다.
 */
export function InquiryAttachmentField({
  attachments,
  error,
  onBlockedChange,
}: InquiryAttachmentFieldProps) {
  const [removedPaths, setRemovedPaths] = useState<readonly string[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)

  /* 삭제 표시한 기존 첨부는 자리를 비운 것으로 센다 — "하나 빼고 하나 넣기"는
     정상 동작이라 막지 않는다. */
  const kept = useMemo(
    () => attachments.filter((attachment) => !removedPaths.includes(attachment.path)),
    [attachments, removedPaths],
  )

  const uploads = useInquiryUploads(kept)

  const isBlocked = isPreparing || localError !== null || uploads.isBlocked

  useEffect(() => {
    onBlockedChange?.(isBlocked)
  }, [isBlocked, onBlockedChange])

  function markRemoved(path: string): void {
    setRemovedPaths((paths) => (paths.includes(path) ? paths : [...paths, path]))
    setLocalError(null)
  }

  /** 칩의 X 가 어긋난 선택에서 빠져나오는 길이다(잠긴 제출 버튼을 다시 여는 것도 이것이다). */
  function removeUpload(id: string): void {
    uploads.remove(id)
    setLocalError(null)
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget
    const picked = [...(input.files ?? [])]

    setLocalError(null)
    /* 고른 파일을 input 에 남기지 않는다 — 업로드는 이미 시작되고, 남은 파일은
       본문 상한(2MB)에 걸려 폼 전체를 끊는다. 같은 파일을 다시 고를 수 있어야
       하므로 비우는 것도 필요하다(값이 같으면 change 가 뜨지 않는다). */
    input.value = ''

    if (picked.length === 0) {
      return
    }

    setIsPreparing(true)
    setLocalError(await uploads.addFiles(picked))
    setIsPreparing(false)
  }

  const usedCount = kept.length + uploads.count
  const usedBytes = kept.reduce((sum, attachment) => sum + attachment.size, 0) + uploads.bytes

  return (
    <div className="flex flex-col gap-3">
      <span className="text-ink text-[16px] leading-[22px] font-medium">
        {INQUIRY_ATTACHMENT_HEADING}
      </span>

      {/* 폰에서는 안내가 버튼 위에 선다(시안 m-4) — 버튼 옆에 두면 두 줄 안내가
          버튼을 밀어내 한 글자씩 접힌다. */}
      <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
        <label className={PICK_BUTTON_CLASS}>
          <span className="text-ink text-[15px] font-medium lg:text-[16px] lg:leading-[22px]">
            {INQUIRY_FILE_PICK_LABEL}
          </span>
          <input
            type="file"
            /* name 이 없어야 폼 전송값에 섞이지 않는다 — 파일은 이미 버킷에 있다. */
            multiple
            accept={INQUIRY_ATTACHMENT_ACCEPT}
            onChange={(event) => void handleChange(event)}
            className="sr-only"
          />
        </label>

        <p className="order-1 text-[13px] leading-[18px] text-[#727272] lg:order-2">
          {ATTACHMENT_NOTICE_LINES.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>

      {/* 지금 얼마나 썼는지. 상한이 하나뿐이라 한 줄로 읽힌다. */}
      {usedCount === 0 ? null : (
        <p aria-live="polite" className="text-ink-muted text-[13px] leading-[18px]">
          {usedCount}/{INQUIRY_ATTACHMENT_MAX_COUNT} · {formatFileSize(usedBytes)}/
          {INQUIRY_ATTACHMENT_TOTAL_MAX_MB}MB
        </p>
      )}

      <ExistingAttachmentList
        attachments={attachments}
        removedPaths={removedPaths}
        onRemove={markRemoved}
      />

      {/* 서버는 이 필드의 JSON 만 보고 첨부를 확정한다(경로의 진위는 다시 검사한다). */}
      <input type="hidden" name={INQUIRY_UPLOAD_FIELD} value={uploads.value} readOnly />

      {isPreparing ? (
        <p aria-live="polite" className="text-ink-muted text-[15px]">
          첨부파일을 준비하는 중입니다…
        </p>
      ) : null}

      <InquiryUploadList rows={uploads.rows} onRemove={removeUpload} onRetry={uploads.retry} />

      <FieldError message={localError ?? error} />
    </div>
  )
}
