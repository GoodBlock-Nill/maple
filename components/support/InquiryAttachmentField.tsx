'use client'

import { useEffect, useRef, useState } from 'react'

import {
  ExistingAttachmentList,
  SelectedFileList,
} from '@/components/support/InquiryAttachmentLists'
import { FieldError } from '@/components/support/InquiryFormRow'
import { InquiryVideoList } from '@/components/support/InquiryVideoList'
import { SUPPORT_LABEL_CLASS } from '@/components/support/support-styles'
import { useInquiryVideos } from '@/components/support/use-inquiry-videos'
import { ATTACHMENT_NOTICE } from '@/lib/constants/support'
import { INQUIRY_FILE_MAX_COUNT, INQUIRY_VIDEO_MAX_COUNT } from '@/lib/supabase/storage'
import { downscaleImage } from '@/lib/utils/downscale-image'
import { INQUIRY_ATTACHMENT_ACCEPT, validateInquiryAttachments } from '@/lib/validation/inquiry'
import { INQUIRY_VIDEO_FIELD, isVideoAttachment } from '@/lib/validation/inquiry-video'

import type { InquiryAttachment } from '@/types/domain'
import type { ChangeEvent } from 'react'

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
 * 첨부 입력. 이미지·PDF 와 영상이 **다른 길**로 간다.
 *
 * 이미지·PDF 는 폼과 함께 서버 액션 본문에 실려 간다. 본문 상한을 넘기면 액션이
 * 실행되기도 전에 요청이 500 으로 끊겨 사용자는 입력을 통째로 잃고 오류 화면만
 * 본다. 그래서 검사는 여기서, 즉 보내기 전에 한다 — 서버(`createInquiry`)의 같은
 * 검사는 직접 POST 를 막는 신뢰 경계이지 사용자 안내가 아니다.
 *
 * 영상은 본문에 실을 수 없다(100MB). 고르는 즉시 브라우저가 버킷에 직접 올리고
 * (`useInquiryVideos`), 폼에는 올라간 오브젝트의 경로만 숨은 필드로 싣는다.
 * 그래서 **영상 파일은 input 의 FileList 에 남겨 두지 않는다** — 남겨 두면 본문에
 * 그대로 실려 나가 상한을 넘긴다.
 *
 * 고른 사진은 올리기 전에 한 번 줄인다(커뮤니티 본문 이미지와 같은 헬퍼).
 * 요즘 휴대폰 사진은 그대로 두면 한 장이 상한을 넘어 "사진만 첨부하면 실패"가 된다.
 */
export function InquiryAttachmentField({
  attachments,
  error,
  onBlockedChange,
}: InquiryAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [removedPaths, setRemovedPaths] = useState<readonly string[]>([])
  const [selected, setSelected] = useState<readonly File[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)

  /* 이미지·PDF 와 영상은 각자 자리를 쓰므로(2026-09-11) 남기는 기존 첨부도
     종류별로 나눠 센다 — 섞어 세면 "영상 2개를 남겼는데 이미지 자리가 준" 것처럼
     보인다. */
  const keptAttachments = attachments.filter(
    (attachment) => !removedPaths.includes(attachment.path),
  )
  const keptFileCount = keptAttachments.filter(
    (attachment) => !isVideoAttachment(attachment.mimeType),
  ).length
  const keptVideoCount = keptAttachments.length - keptFileCount

  const videos = useInquiryVideos(keptVideoCount)

  const fileCount = keptFileCount + selected.length
  const isBlocked = isPreparing || localError !== null || videos.isBlocked

  useEffect(() => {
    onBlockedChange?.(isBlocked)
  }, [isBlocked, onBlockedChange])

  function clearSelection(): void {
    const input = inputRef.current

    if (input !== null) {
      /* 빈 문자열 대입이 파일 목록을 비우는 규정된 방법이다. 목록을 직접 갈아
         끼우는 경로도 함께 태워 둔다(둘 중 하나만 되는 환경이 있다). */
      input.value = ''
      replaceFiles(input, [])
    }

    setSelected([])
    setLocalError(null)
  }

  function toggleRemoved(path: string, isRemoved: boolean): void {
    setRemovedPaths((paths) =>
      isRemoved ? [...paths, path] : paths.filter((value) => value !== path),
    )
    setLocalError(null)
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget
    const picked = [...(input.files ?? [])]

    setLocalError(null)

    if (picked.length === 0) {
      setSelected([])

      return
    }

    const pickedVideos = picked.filter((file) => isVideoAttachment(file.type))
    const pickedFiles = picked.filter((file) => !isVideoAttachment(file.type))

    setIsPreparing(true)

    /* 영상부터 붙인다 — 전송이 곧바로 시작돼야 사용자가 기다리는 시간이 줄고,
       이미지 개수 검사가 "몇 자리가 남았는지"를 정확히 알 수 있다. */
    const videoOutcome =
      pickedVideos.length === 0
        ? { message: null, accepted: 0 }
        : videos.addFiles(pickedVideos, keptFileCount + pickedFiles.length)

    const files = await Promise.all(pickedFiles.map(downscaleImage))
    const check = validateInquiryAttachments(
      files,
      keptFileCount,
      videos.count + videoOutcome.accepted,
    )

    /* 어긋난 선택도 화면에는 남겨 둔다(무엇이 문제인지 보여야 다시 고를 수 있다).
       대신 제출은 잠기고, 첨부를 포기하려면 "첨부 지우기"로 명시적으로 비운다. */
    setSelected(check.ok ? files : pickedFiles)
    setLocalError(videoOutcome.message ?? (check.ok ? null : check.message))

    /* 어느 경우에도 영상은 input 에서 빠진다. 남으면 본문 상한을 넘겨 요청이 끊긴다. */
    replaceFiles(input, check.ok ? files : pickedFiles)

    setIsPreparing(false)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-center gap-2">
        <span className={`${SUPPORT_LABEL_CLASS} font-bold`}>첨부파일</span>
        <span className="text-ink-muted text-ui">{ATTACHMENT_NOTICE}</span>
      </p>

      {/* 종류별 남은 자리를 한눈에 보여 준다 — 이미지·PDF 와 영상이 각자 상한을 쓰므로
          합쳐서 세면 "왜 아직 되는지/왜 막히는지"를 알 수 없다. */}
      <p className="text-ink-muted text-ui">
        이미지·PDF {fileCount}/{INQUIRY_FILE_MAX_COUNT} · 영상 {videos.count}/
        {INQUIRY_VIDEO_MAX_COUNT}
      </p>

      <ExistingAttachmentList attachments={attachments} onToggle={toggleRemoved} />

      {/* 시안: 라벨 폭에 맞는 작은 버튼. 블록 <label> 이라 전폭으로 늘어나던 것을 막는다. */}
      <label className="text-ui w-fit rounded-[5px] border border-[#d5d9df] bg-[#e7e7e7] px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]">
        <span className="text-ink flex h-10 items-center">파일 선택</span>
        <input
          ref={inputRef}
          type="file"
          name="attachments"
          multiple
          accept={INQUIRY_ATTACHMENT_ACCEPT}
          onChange={(event) => void handleChange(event)}
          className="sr-only"
        />
      </label>

      {/* 서버는 이 필드의 JSON 만 보고 영상 첨부를 확정한다(경로의 진위는 다시 검사한다). */}
      <input type="hidden" name={INQUIRY_VIDEO_FIELD} value={videos.value} readOnly />

      <InquiryVideoList rows={videos.rows} onRemove={videos.remove} onRetry={videos.retry} />

      <SelectedFileList files={selected} isPreparing={isPreparing} onClear={clearSelection} />

      <FieldError message={localError ?? error} />
    </div>
  )
}

/**
 * 고른 파일을 input 에 되돌려 넣는다(축소본이 전송되도록 · 영상이 빠지도록).
 *
 * `DataTransfer` 가 없는 환경(구형 브라우저·jsdom)에서는 그대로 둔다 — 원본이
 * 올라갈 뿐이고, 크기 판정은 이미 끝났으므로 접수가 실패하지는 않는다.
 */
function replaceFiles(input: HTMLInputElement, files: readonly File[]): void {
  if (typeof DataTransfer !== 'function') {
    return
  }

  const transfer = new DataTransfer()

  for (const file of files) {
    transfer.items.add(file)
  }

  input.files = transfer.files
}
