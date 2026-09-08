import type { NextConfig } from 'next'

/**
 * 관리자 화면이 그리는 원격 이미지는 Supabase Storage(public-assets · post-images)
 * 뿐이다. 호스트는 프로젝트 URL 에서 파생되므로 하드코딩하지 않고 환경 변수에서
 * 뽑아낸다 — 프로젝트를 옮겨도 설정 파일을 고칠 필요가 없다.
 *
 * `next.config.ts` 는 빌드/기동 시 Node 에서 한 번만 평가된다. 값이 없으면
 * remotePatterns 를 비워 두고(이미지 최적화만 실패) 빌드 자체는 막지 않는다.
 */
function supabaseStorageHostname(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (rawUrl === undefined || rawUrl.trim() === '') {
    return null
  }

  try {
    return new URL(rawUrl).hostname
  } catch {
    return null
  }
}

const storageHostname = supabaseStorageHostname()

const nextConfig: NextConfig = {
  images: {
    remotePatterns:
      storageHostname === null
        ? []
        : [
            {
              protocol: 'https',
              hostname: storageHostname,
              pathname: '/storage/v1/object/public/**',
            },
          ],
  },
}

export default nextConfig
