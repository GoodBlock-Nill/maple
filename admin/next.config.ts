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
  /**
   * 화면 설명서(`docs/admin/SCREENS-GUIDE.html`)를 `/docs/screens` 로 연다.
   *
   * 원본은 저장소 `docs/admin/` 에만 두고(단일 출처), 빌드·개발 서버 기동 때
   * `scripts/sync-docs.mjs` 가 `public/docs/screens.html` 로 한 벌 떠 온다.
   * 주소에 `.html` 을 노출하지 않으려고 rewrite 로 가린다 — 배열로 돌려주면
   * 파일시스템(pages · public) 검사 뒤(afterFiles)에 적용된다.
   */
  async rewrites() {
    return [
      { source: '/docs/screens', destination: '/docs/screens.html' },
      { source: '/docs/inquiry-thread', destination: '/docs/inquiry-thread.html' },
    ]
  },
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
