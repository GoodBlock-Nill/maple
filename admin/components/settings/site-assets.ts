import { clientSiteUrl } from '@/lib/supabase/env'

/**
 * 사용자 사이트 자산 주소 해석.
 *
 * DB 에 담기는 이미지 주소는 두 종류다 — Storage 공개 URL(`https://…`)과 사용자
 * 사이트의 정적 경로(`/images/guide/icon-item-1.png`). 후자를 그대로 `<img src>`
 * 에 넣으면 **관리자 앱**에서 찾으므로 전부 깨진 이미지가 된다. 관리자에는 그
 * 파일이 없다.
 *
 * 사이트 주소를 앞에 붙여 실제 파일을 그대로 보여 준다. 미리보기가 사용자
 * 사이트와 같은 그림을 내려면 이 한 줄이 필요하다.
 *
 * 사이트 주소는 `NEXT_PUBLIC_CLIENT_SITE_URL` 이라 서버·클라이언트 어느 쪽에서
 * 불러도 같은 값이 나온다(Next 가 빌드 시 문자열로 치환한다).
 */
export function siteAssetSrc(url: string): string {
  if (url === '' || !url.startsWith('/')) {
    return url
  }

  return `${clientSiteUrl()}${url}`
}
