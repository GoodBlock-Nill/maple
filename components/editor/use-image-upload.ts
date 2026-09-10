'use client'

import { useCallback, useState } from 'react'

import { uploadPostImage } from '@/lib/actions/upload-actions'
import { downscaleImage } from '@/lib/utils/downscale-image'
import { validatePostImage } from '@/lib/validation/upload'

/**
 * 본문 이미지 업로드 상태 관리.
 *
 * 여러 장을 **순차로** 올린다. 병렬로 던지면 완료 순서가 뒤바뀌어 본문에 들어가는
 * 사진 순서가 사용자가 고른 순서와 달라지고, 업로드 도배 한도에도 한꺼번에 걸린다.
 *
 * 한 장이 실패해도 나머지는 계속 올린다 — 열 장 중 한 장 때문에 전부 다시 고르게
 * 만들 이유가 없다. 실패 문구는 마지막 것만 남긴다.
 */

export type ImageUploadState = {
  isUploading: boolean
  error: string | null
  clearError: () => void
  upload: (files: readonly File[]) => Promise<void>
}

export function useImageUpload(onUploaded: (url: string) => void): ImageUploadState {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const upload = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) {
        return
      }

      setIsUploading(true)
      setError(null)

      for (const file of files) {
        /* 서버가 어차피 다시 검사하지만, 여기서 걸러야 잘못된 파일 하나 때문에
           왕복과 도배 한도를 낭비하지 않는다. */
        const check = validatePostImage(file)

        if (!check.ok) {
          setError(check.message)
          continue
        }

        const formData = new FormData()

        formData.set('file', await downscaleImage(file))

        const result = await uploadPostImage(formData)

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

  return { isUploading, error, clearError, upload }
}
