import 'server-only'

import { logFailure } from '@/lib/actions/action-failure'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import { ASSET_TYPE_ERROR, PUBLIC_ASSET_EXTENSIONS } from '@/lib/validation/settings'

/**
 * `public-assets` 버킷 업로드 — 설정(크리에이터 사진 · 배너)과 확률형 아이템
 * 아이콘이 함께 쓴다. 업로드 규칙이 두 벌이 되면 한쪽만 확장자 검사를 놓치는
 * 식으로 갈라지므로 한곳에 둔다.
 *
 * 쓰기는 세션 클라이언트로 한다 — 스토리지 정책이 다시 검사하게 두어야 권한
 * 버그가 조용히 통과하지 않는다.
 */

const BUCKET = 'public-assets'

export type UploadResult = { url: string } | { error: string }

/** 값이 비어 있는 file input 은 크기 0짜리 File 로 온다. 업로드로 치지 않는다. */
export function readFile(formData: FormData, name: string): File | null {
  const value = formData.get(name)

  return value instanceof File && value.size > 0 ? value : null
}

/**
 * @param buildPath 확장자를 받아 버킷 안 경로를 만든다. 새 파일마다 UUID 를 쓰면
 *   같은 이름의 다른 파일이 서로를 덮어쓰는 사고를 막는다.
 * @param upsert 경로가 고정된 자산(크리에이터 사진)만 true. 이때 URL 에 갱신
 *   시각을 붙인다 — 안 붙이면 CDN 이 옛 이미지를 계속 내려 준다.
 */
export async function uploadPublicAsset(
  file: File,
  buildPath: (extension: string) => string,
  { upsert = false, label = '이미지' }: { upsert?: boolean; label?: string } = {},
): Promise<UploadResult> {
  const extension = PUBLIC_ASSET_EXTENSIONS[file.type]

  if (extension === undefined) {
    return { error: ASSET_TYPE_ERROR }
  }

  const supabase = await createClient()
  const path = buildPath(extension)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert })

  if (error !== null) {
    return {
      error: logFailure(
        'assets',
        `${label}${josa(label, '을')} 올리지 못했습니다. 파일 크기를 줄이거나 잠시 후 다시 시도해 주세요.`,
        error,
      ),
    }
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  return { url: upsert ? `${publicUrl}?v=${Date.now()}` : publicUrl }
}
