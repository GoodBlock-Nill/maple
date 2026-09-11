/**
 * 뉴스 카테고리별 기본 템플릿 — '기본값으로 되돌리기'의 원본.
 *
 * **이 파일은 손으로 고치지 않는다.** 마이그레이션 시드와 글자 하나까지 같아야 하므로
 * 두 파일을 한 생성기가 함께 뽑는다(`node scripts/gen-news-templates.mjs`). 되돌리기가
 * 마이그레이션과 다른 문안을 심으면, 운영자는 "기본값"이 무엇인지 알 수 없게 된다.
 *
 * 본문은 에디터가 만드는 것과 같은 Tiptap HTML 이고, 태그는 정제기
 * (`lib/sanitize/post-html.ts`)의 허용 목록 안에만 있다 — 되돌린 직후 저장했을 때
 * 문단이 사라지지 않게.
 *
 * `{{날짜}}` 같은 자리표시자는 **치환되지 않는다.** 운영자가 그 자리를 직접 고쳐 쓰는
 * 평범한 글자다(자동 치환을 넣으면 "언제 무엇으로 바뀌는가"를 화면이 설명해야 한다).
 */

import { NEWS_CATEGORY_KEYS, type NewsCategoryKey } from '@/lib/constants/news'

export type NewsTemplateSeed = {
  title: string
  summary: string
  /** Tiptap HTML. 빈 템플릿은 빈 문자열이다(`<p></p>` 를 두지 않는다). */
  body: string
}

export const NEWS_TEMPLATE_SEEDS: Record<NewsCategoryKey, NewsTemplateSeed> = {
  notice: {
    title: '[공지] {{제목}}',
    summary: '',
    body: '<p>안녕하세요, 글자월드입니다.</p><h3>안내</h3><p>{{안내 내용}}</p><h3>유의사항</h3><ul><li><p>{{유의사항}}</p></li></ul>',
  },
  maintenance: {
    title: '[점검] {{날짜}} 정기 점검 안내',
    summary: '{{날짜}} {{시작 시각}}~{{종료 시각}} 서버 점검이 진행됩니다.',
    body: '<p>안녕하세요, 글자월드입니다.</p><p>더 나은 서비스를 위해 아래와 같이 서버 점검을 진행합니다.</p><h3>점검 일시</h3><p>{{날짜}} {{시작 시각}} ~ {{종료 시각}} (약 {{소요 시간}})</p><h3>점검 내용</h3><ul><li><p>{{점검 항목}}</p></li></ul><h3>유의사항</h3><ul><li><p>점검 중에는 게임에 접속할 수 없습니다.</p></li><li><p>점검 시간은 진행 상황에 따라 늘어나거나 줄어들 수 있습니다.</p></li></ul>',
  },
  update: {
    title: '[업데이트] {{날짜}} 업데이트 안내',
    summary: '',
    body: '<h3>적용 일시</h3><p>{{날짜}} {{시각}}</p><h3>업데이트 내용</h3><ul><li><p>{{업데이트 내용}}</p></li></ul><h3>유의사항</h3><ul><li><p>{{유의사항}}</p></li></ul>',
  },
  patch: {
    title: '[패치노트] v{{버전}}',
    summary: 'v{{버전}} 패치 내역입니다.',
    body: '<h3>버전</h3><p>v{{버전}} · {{적용 일시}}</p><h3>변경 사항</h3><ul><li><p>{{변경 내용}}</p></li></ul><h3>버그 수정</h3><ul><li><p>{{수정 내용}}</p></li></ul>',
  },
  event: {
    title: '[이벤트] {{이벤트명}}',
    summary: '{{시작일}} ~ {{종료일}} 진행되는 {{이벤트명}} 안내입니다.',
    body: '<h3>기간</h3><p>{{시작일}} {{시각}} ~ {{종료일}} {{시각}}</p><h3>참여 방법</h3><ul><li><p>{{참여 방법}}</p></li></ul><h3>보상</h3><ul><li><p>{{보상}}</p></li></ul><h3>유의사항</h3><ul><li><p>{{유의사항}}</p></li></ul>',
  },
  info: {
    title: '[안내] {{제목}}',
    summary: '',
    body: '<h3>안내</h3><p>{{안내 내용}}</p><h3>문의</h3><p>궁금한 점은 1:1 문의로 알려 주세요.</p>',
  },
}

/** 카테고리 키 → 기본 템플릿. 모르는 키는 빈 템플릿으로 떨어진다. */
export function newsTemplateSeed(category: string): NewsTemplateSeed {
  const known = (NEWS_CATEGORY_KEYS as readonly string[]).includes(category)

  return known
    ? NEWS_TEMPLATE_SEEDS[category as NewsCategoryKey]
    : { title: '', summary: '', body: '' }
}
