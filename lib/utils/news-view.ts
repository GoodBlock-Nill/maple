import { DEFAULT_NEWS_VIEW, NEWS_VIEW_VALUES } from '@/lib/constants/board'
import { parseOption } from '@/lib/utils/list-query'

import type { SearchParamValue } from '@/lib/utils/list-query'
import type { NewsView } from '@/types/domain'

/**
 * 뉴스 목록 `?view=` 파싱과 링크 정규화.
 *
 * 페이지와 테스트가 같은 규칙을 공유하도록 두 줄짜리 로직도 여기로 뺐다 —
 * 보기 모드는 카테고리·검색·더보기 링크 전부에 실려 다녀서, 한 곳이라도
 * 규칙이 어긋나면 링크를 타는 순간 보기가 기본값으로 되돌아간다.
 */

/** 허용 목록에 없는 값(`?view=galaxy`)은 404 대신 기본 화면(카드형)으로 떨어뜨린다. */
export function parseNewsView(value: SearchParamValue): NewsView {
  return parseOption<NewsView>(value, NEWS_VIEW_VALUES, DEFAULT_NEWS_VIEW)
}

/**
 * 링크에 실을 `view` 질의값. 기본값은 `null` 로 바꿔 `buildHref` 가 빼도록 한다 —
 * `/news` 와 `/news?view=card` 가 같은 화면이므로 URL 을 하나로 유지한다.
 */
export function newsViewParam(view: NewsView): NewsView | null {
  return view === DEFAULT_NEWS_VIEW ? null : view
}
