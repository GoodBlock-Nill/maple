import type { NextConfig } from 'next'

/* `RemotePattern` 은 next 의 공개 진입점에서 내보내지 않는다. 내부 경로를
   import 하는 대신 설정 타입에서 그대로 끌어온다. */
type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>

/**
 * Supabase 스토리지 공개 버킷(`public-assets`) 호스트.
 *
 * 크리에이터 사진(`site_settings.creator_photo_url`)은 관리자가 이 버킷에
 * 올린 공개 URL 이다. 프로젝트 참조(ref)를 소스에 박아 두면 스테이징/운영을
 * 나눌 때 이 파일도 함께 고쳐야 하므로 환경 변수에서 호스트만 뽑아 쓴다.
 * 값이 없거나 URL 이 아니면 패턴을 추가하지 않는다 — 빌드가 죽는 것보다
 * 이미지 최적화가 해당 호스트를 거절하는 편이 낫다.
 */
function supabaseStoragePatterns(): RemotePatterns {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (raw === undefined || raw.trim() === '') {
    return []
  }

  try {
    const { hostname } = new URL(raw)

    return [
      {
        protocol: 'https',
        hostname,
        pathname: '/storage/v1/object/public/**',
      },
    ]
  } catch {
    return []
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        /* 소개 페이지 히어로가 유튜브 썸네일(i.ytimg.com/vi/{id}/maxresdefault.jpg)을
           배경으로 쓴다. site_settings.youtube_url 이 DB 로 옮겨져도 호스트는 동일하다. */
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
      ...supabaseStoragePatterns(),
    ],
  },
}

export default nextConfig
