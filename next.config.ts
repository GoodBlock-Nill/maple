import type { NextConfig } from 'next'

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
    ],
  },
}

export default nextConfig
