'use client'

import { useRef, useState, useTransition } from 'react'

import { UploadGlyph } from '@/components/account/mypage-icons'
import {
  MYPAGE_ERROR_CLASS,
  MYPAGE_HINT_CLASS,
  MYPAGE_UPLOAD_CLASS,
} from '@/components/account/mypage-styles'
import { uploadAvatarAction } from '@/lib/actions/profile-actions'
import { downscaleImage } from '@/lib/utils/downscale-image'
import { AVATAR_HINT, AVATAR_MIME_EXTENSIONS } from '@/lib/validation/account'

const AVATAR_PLACEHOLDER = '/images/mypage/avatar-placeholder.png'

/** 원본 사진을 그대로 올리면 10MB 제한에 걸린다. 107px 원형에 쓰기엔 512로 충분하다. */
const MAX_DIMENSION = 512

const ACCEPT = Object.keys(AVATAR_MIME_EXTENSIONS).join(',')

type AvatarUploaderProps = {
  /** 현재 프로필 사진. 없으면 시안의 기본 아바타. */
  avatarUrl: string | null
}

/**
 * 프로필 이미지 — 107 원형 + "이미지 업로드" 버튼 + 안내(시안 §4.1).
 *
 * 파일 선택은 숨긴 `<input type="file">` 이 받는다. 버튼을 그대로 쓰면 브라우저
 * 기본 파일 입력(회색 "파일 선택")이 그려져 시안과 어긋난다.
 *
 * 브라우저에서 한 번 줄여서 올린다. 축소는 편의일 뿐이고 형식·크기의 진짜 판정은
 * 서버 액션과 버킷 정책이 한다(`downscaleImage` 는 실패하면 원본을 돌려준다).
 */
export function AvatarUploader({ avatarUrl }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(avatarUrl)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleChange = (file: File | undefined) => {
    if (file === undefined) return

    setError(null)
    startTransition(async () => {
      const payload = new FormData()

      payload.set('file', await downscaleImage(file, MAX_DIMENSION))

      const result = await uploadAvatarAction(payload)

      if (result.ok) {
        setPreview(result.url)
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="flex items-center gap-6">
      {/* 아바타는 임의 외부 호스트(간편로그인 제공자)일 수 있어 next/image 의
          remotePatterns 화이트리스트로는 감당하지 못한다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview ?? AVATAR_PLACEHOLDER}
        alt=""
        width={107}
        height={107}
        className="size-[107px] shrink-0 rounded-full object-cover"
      />

      <div className="flex w-full max-w-[478px] flex-col gap-[10px]">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => handleChange(event.target.files?.[0])}
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          className={MYPAGE_UPLOAD_CLASS}
        >
          <UploadGlyph className="size-6" />
          {isPending ? '업로드 중…' : '이미지 업로드'}
        </button>

        <p className={MYPAGE_HINT_CLASS}>{AVATAR_HINT}</p>

        {error === null ? null : (
          <p role="alert" className={MYPAGE_ERROR_CLASS}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
