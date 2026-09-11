# 뉴스목록 v2 시안 스펙 (Figma 2UmKcpmy55IqMZ7Sg6vTeW 229:4490 "뉴스목록_시안_2", 2026-09-11)

스크린샷 `docs/reference/figma/news-v2/list-pc.png`(1440×2532 축소본). 아이콘
`public/images/news/v2/{pin.png(24), view-card.svg(25), clock-12.svg, eye-15.svg}`.
상단 밴드(벚꽃)·마스코트·제목 "뉴스목록"·푸터는 현행 news 변형 그대로(제목 y≈350, 툴바 y=460).
헤더는 support-v2-spec §1 의 1200 바(별도 작업).

## 1. 툴바 (Frame 7979, 1200×45, y=460)
- 좌: 카테고리 칩(현행 `CategoryChips`) — 전체(활성: bg #2a2a2a white) · 공지사항 · 패치노트 · 이벤트 …
  h45 · px 15 · radius 50 · Switzer Medium 17 · 비활성 white border #cdd3db #727272 · gap 10. **현행과 동일**(칩 종류는 DB 카테고리 그대로).
- 우(gap 15): 검색 300×45(현행 `SearchForm`) + **보기 전환 버튼** 104×45: white · border #cdd3db · radius 10 ·
  drop-shadow 3단 · px 12 · `view-card.svg` 25 + gap 8 + 라벨 Switzer Medium 17 #2a2a2a.
  라벨은 **현재 보기 모드 이름**("카드형" / "가로형"). 누르면 드롭다운(Dropdown Menu 229:4693 — white · radius 10 ·
  shadow 0 10 15 -3 rgba(0,0,0,.1), 0 4 6 -4 rgba(0,0,0,.1) · padding 4 · 항목 h40 px12 py8 radius 8 · 아이콘 24 + gap 8 +
  Switzer Medium 17 #2a2a2a · 선택된 항목 bg #dbdbdb) 에서 `가로형`(현행 행 목록) / `카드형`(§2) 을 고른다.
  시안 드롭다운의 "자세히(썸네일)" 항목은 이번 범위에서 **제외**(썸네일 자산 없음).
- 보기 모드는 URL `?view=card|list` 로 유지(카테고리·검색·더보기 링크에 keep). **기본값 = card**(시안이 보여 주는 화면).
  잘못된 값은 card 로 폴백.

## 2. 카드형 목록 (Frame 7990, 1200×1237, y=529)
- 트레이: bg #ededed · radius 20 · padding 16 · drop-shadow(현행 `ListSheet`) — 2열 grid, gap 16, 열 폭 574/576 → `grid-cols-2`.
- 카드 574×229(내용 높이에 따라 자연 높이, 행 안에서 stretch): white · border #cdd3db · radius 20 · padding 24 · drop-shadow 3단 ·
  세로 gap 24. 전체가 링크(`/news/[id]`), hover 는 현행 `BOARD_CARD_CLASS` 와 같은 반응.
  1. 머리줄(justify-between): 카테고리 뱃지(현행 `Badge size="md"` — px 10 py 5 radius 50 Switzer Medium 17; 색은 `NEWS_CATEGORY_MAP[..].badge`) …
     우측 **고정 핀 아이콘 24**(`pin.png`) — `is_pinned` 인 글만. 목록 정렬은 현행(고정 먼저) 그대로.
  2. 본문(gap 8): 제목 Switzer Medium **27**/24 tracking −0.2 #2a2a2a, 한 줄 말줄임 → 요약(`summary`) Switzer Medium 17/25 #727272,
     **2줄 클램프**(h56, 말줄임 `…`). 요약이 비어 있으면 줄을 비워 두지 않고 생략(카드 높이는 행에서 stretch 되므로 정렬 유지).
  3. 메타 줄(gap 12): `clock-12` + gap 6 + 날짜 `2026-01-11` Switzer Medium 16 #2a2a2a · `eye-15` + gap 6 + 조회수 — 현행 `MetaRow` 그대로.
- 페이지당 10건(2열×5행) 유지, 아래 `더보기(10/22)` 현행 `LoadMoreButton`(y=1600, 트레이 아래 64).
- 빈 목록: 현행 `BoardEmpty`.
- 가로형(list) 모드 = 현행 `NewsList`/`NewsRow` 그대로.

## 3. 반응형 (시안 없음 — 규칙)
- `lg` 미만: 카드 1열, padding 20, 제목 22px, 요약 16/24, 트레이 padding 12. 툴바는 현행처럼 세로 스택(칩 가로 스크롤, 검색 전체 폭 + 보기 버튼은 검색 옆 고정 폭).
- 모바일에서도 보기 전환은 노출(라벨 숨기고 아이콘만 44×44 로 축소해도 됨).

## 4. 데이터
- `NewsItem` 에 `isPinned: boolean` 추가(`news.is_pinned` 컬럼을 `NEWS_LIST_COLUMNS` 에 포함, 매퍼 반영). 상세·인접글 등 다른 사용처는
  기본 false 로 무해하게.
- `summary` 는 이미 있음(관리자 입력). 없을 때는 본문에서 파생하지 않는다(빈 문자열 → 요약 줄 생략).

## 5. 리스트형 (229:6096 "뉴스목록_시안_2" 두 번째 프레임, 2026-09-11 추가) — `docs/reference/figma/news-v2/list-row-pc.png`
- 가로형 → **"리스트형"** 으로 이름이 바뀌었다(툴바 버튼 라벨·드롭다운 항목 모두). 버튼 **120×45**, 아이콘 `view-list.svg`(fa7-solid:list-ul, 25).
- 행 = 카드형 카드와 같은 표면을 **1168 전체 폭 1열**로: white · border #cdd3db · radius 20 · padding 24 · drop-shadow 3단 · 세로 gap 24 ·
  높이 165. 행 사이 gap **16**(현행 12). 트레이는 카드형과 동일(#ededed · radius 20 · padding 16).
  1. 머리줄: 카테고리 뱃지 … 우측 고정 핀 24(`is_pinned` 만)
  2. 제목 Switzer Medium 27/24 tracking −0.2 #2a2a2a 한 줄 말줄임 (**요약 없음**)
  3. 메타 줄(`clock-12` 날짜 · `eye-15` 조회수, 16px) — 현행 `MetaRow`
- 즉 기존 `NewsRow`(제목 + 우측 뱃지 한 줄, 메타) 레이아웃은 폐기하고 카드형과 같은 세로 구조로 바꾼다. 모바일은 padding 20, 제목 22.
