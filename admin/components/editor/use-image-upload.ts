'use client'

import { useCallback, useState } from 'react'

import { downscaleImage } from '@/components/editor/downscale-image'
import { validatePostImage } from '@/components/editor/post-image'
import { uploadPostImageAction } from '@/components/editor/upload-action'

/**
 * 본문 이미지 업로드 상태 관리.
 *
 * 여러 장을 **순차로** 올린다. 병렬로 던지면 완료 순서가 뒤바뀌어 본문에 들어가는
 * 사진 순서가 고른 순서와 달라진다(서버 액션은 클라이언트에서 어차피 순차로
 * 디스패치된다 — Next 문서의 "Sequential dispatch").
 *
 * 한 장이 실패해도 나머지는 계속 올린다 — 열 장 중 한 장 때문에 전부 다시 고르게
 * 만들 이유가 없다. 실패 문구는 마지막 것만 남긴다.
 */

export type ImageUploadState = {
  isUploading: boolean
  error: string | null
  upload: (files: readonly File[]) => Promise<void>
}

export function useImageUpload(onUploaded: (url: string) => void): ImageUploadState {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) {
        return
      }

      setIsUploading(true)
      setError(null)

      for (const file of files) {
        /* 서버가 어차피 다시 검사하지만, 여기서 걸러야 잘못된 파일 하나 때문에
           왕복을 낭비하지 않는다. */
        const check = validatePostImage(file)

        if (!check.ok) {
          setError(check.message)
          continue
        }

        const formData = new FormData()

        formData.set('file', await downscaleImage(file))

        const result = await uploadPostImageAction(formData)

        if (result.ok) {
          onUploaded(result.url)
        } else {
          setError(result.message)
        }
      }

      setIsUploading(false)
    },
    [onUploaded],
  )

  return { isUploading, error, upload }
}
