/**
 * 약관 **편집 중** 화면의 타이포그래피.
 *
 * 미리보기(`legal-prose.ts`)와 다른 값을 쓴다. 편집 화면은 "독자가 보는 모습"이
 * 아니라 "구조가 한눈에 보이는 모습"이어야 한다 — 글자를 17px 로 키우면 표 한 장이
 * 화면을 넘겨 열 편집이 불가능해진다. 대신 제목 3단계의 크기 차이는 뚜렷하게 둔다.
 *
 * 임의 변형자(`[&_h2]:…`)로 자식 요소 서식을 클래스 문자열 안에 담는다. Tailwind 는
 * 소스를 정적으로 훑으므로 리터럴로 둬야 유틸리티가 생성된다.
 *
 * 서식을 주는 태그 목록은 `lib/sanitize/legal-html.ts` 의 허용 태그와 같다.
 * 정제기가 지우는 태그에 스타일을 주면 에디터에서만 보이는 서식이 생긴다.
 */
export const LEGAL_EDITOR_CLASS = [
  'text-ink min-h-[420px] px-4 py-4 text-[14px] leading-relaxed focus:outline-none',
  '[&_p]:my-2',
  '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-[19px] [&_h2]:font-bold',
  '[&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-[16px] [&_h3]:font-bold',
  '[&_h4]:text-muted [&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:text-[14px] [&_h4]:font-bold',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-1 [&_li_p]:my-0',
  '[&_a]:text-accent-strong [&_a]:underline',
  '[&_strong]:font-bold [&_em]:italic',
  /* 표. 편집 중에는 셀 경계가 늘 보여야 한다 — 빈 셀도 클릭할 수 있어야 하고,
     선택된 셀(`selectedCell`)은 ProseMirror 가 클래스로 알려 준다. */
  '[&_table]:my-3 [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse',
  '[&_th]:border-line [&_th]:bg-page [&_th]:border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border-line [&_td]:border [&_td]:px-2 [&_td]:py-1.5',
  '[&_.selectedCell]:bg-accent-soft',
  /* Placeholder 확장은 빈 첫 문단에 `is-editor-empty` 와 `data-placeholder` 를
     붙이기만 한다. 실제로 글자를 그리는 것은 이 ::before 규칙이다. */
  '[&_p.is-editor-empty:first-child]:before:text-muted/70 [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
].join(' ')
