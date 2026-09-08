import { absoluteUrl } from '@/lib/utils/absolute-url'

/**
 * 공유 동작 결정 + 공유 링크 생성.
 *
 * 브라우저 API 접근은 컴포넌트가 하고, "어떤 방식으로 공유할지"는 여기서
 * 순수 함수로 정한다. 그래야 jsdom 없이도 분기를 검증할 수 있다.
 */

/** 공유 링크는 현재 주소가 아니라 정식(canonical) 절대 URL 이다. */
export function newsShareUrl(id: string): string {
  return absoluteUrl(`/news/${id}`)
}

export type ShareMode =
  /** OS 공유 시트(`navigator.share`). 주로 모바일. */
  | 'share'
  /** 클립보드 복사 + 안내 문구. 데스크톱 기본값. */
  | 'copy'
  /** 둘 다 막혔을 때 주소를 화면에 드러내 직접 복사하게 한다. */
  | 'reveal'

export type ShareCapabilities = {
  canShare: boolean
  canCopy: boolean
}

export function resolveShareMode({ canShare, canCopy }: ShareCapabilities): ShareMode {
  if (canShare) {
    return 'share'
  }

  if (canCopy) {
    return 'copy'
  }

  return 'reveal'
}
