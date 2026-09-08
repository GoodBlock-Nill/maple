/**
 * 에디터 본문의 타이포그래피.
 *
 * 사용자 사이트는 전역 `.prose-board` 클래스로 같은 일을 하지만, 관리자
 * `app/globals.css` 에는 그런 규칙이 없고 이 모듈 하나 때문에 전역 CSS 를 늘리고
 * 싶지도 않다. 그래서 **임의 변형자**(`[&_h2]:…`)로 자식 요소 서식을 클래스
 * 문자열 안에 담는다 — Tailwind 는 소스를 정적으로 훑으므로 이렇게 리터럴로 둬야
 * 유틸리티가 생성된다.
 *
 * 여기서 서식을 주는 태그 목록은 `lib/sanitize/post-html.ts` 의 허용 태그와 같다.
 * 정제기가 지우는 태그에 스타일을 주면 에디터에서만 보이는 서식이 생긴다.
 */
export const CONTENT_CLASS = [
  'text-ink min-h-[320px] px-4 py-4 text-[14px] leading-relaxed focus:outline-none',
  '[&_p]:my-2',
  '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[18px] [&_h2]:font-bold',
  '[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-[15px] [&_h3]:font-bold',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-1',
  '[&_blockquote]:border-line [&_blockquote]:text-muted [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3',
  '[&_a]:text-accent-strong [&_a]:underline',
  '[&_img]:rounded-panel [&_img]:my-3 [&_img]:max-w-full',
  '[&_strong]:font-bold [&_em]:italic [&_s]:line-through [&_u]:underline',
  /* Placeholder 확장은 빈 첫 문단에 `is-editor-empty` 와 `data-placeholder` 를
     붙이기만 한다. 실제로 글자를 그리는 것은 이 ::before 규칙이다. */
  '[&_p.is-editor-empty:first-child]:before:text-muted/70 [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
].join(' ')

/**
 * 저장된 본문을 **사용자 사이트와 같게** 그리는 클래스.
 *
 * 사용자 사이트의 `.prose-board`(`app/styles/components.css`)를 그대로 옮긴 것이다.
 * 치수(글자 17px · 행간 1.8 · 문단 간격 1.1em · 제목 21px/1.4/1.8em · 목록
 * 들여쓰기 1.3em · 인용 왼쪽선 3px)는 1:1 이고, **색만** 관리자 팔레트 토큰을 쓴다
 * (관리자 배경이 더 밝아 같은 hex 를 쓰면 대비가 어긋난다).
 *
 * `.video-embed` 규칙까지 함께 담는다 — `renderPostHtml()` 이 만들어 내는
 * 래퍼가 그 클래스를 쓰는데, 관리자에는 그 전역 CSS 가 없기 때문이다.
 */
export const PREVIEW_PROSE_CLASS = [
  'text-ink text-[17px] leading-[1.8]',
  '[&>*+*]:mt-[1.1em]',
  '[&_h2]:mt-[1.8em] [&_h2]:text-[21px] [&_h2]:leading-[1.4] [&_h2]:font-semibold',
  '[&_h3]:mt-[1.8em] [&_h3]:text-[21px] [&_h3]:leading-[1.4] [&_h3]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-[1.3em] [&_ol]:list-decimal [&_ol]:pl-[1.3em]',
  '[&_li+li]:mt-[0.4em]',
  '[&_a]:text-focus [&_a]:underline [&_a]:underline-offset-[3px]',
  '[&_strong]:font-semibold',
  '[&_blockquote]:border-line [&_blockquote]:text-muted [&_blockquote]:border-l-[3px] [&_blockquote]:pl-4',
  '[&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-[8px]',
  '[&_.video-embed]:bg-ink [&_.video-embed]:relative [&_.video-embed]:aspect-video [&_.video-embed]:w-full [&_.video-embed]:overflow-hidden [&_.video-embed]:rounded-[8px]',
  '[&_.video-embed_iframe]:absolute [&_.video-embed_iframe]:inset-0 [&_.video-embed_iframe]:h-full [&_.video-embed_iframe]:w-full [&_.video-embed_iframe]:border-0',
].join(' ')
