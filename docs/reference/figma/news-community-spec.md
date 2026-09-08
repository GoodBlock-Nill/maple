# 뉴스 · 커뮤니티 목록 구현 스펙 (Figma → 코드)

프레임 `뉴스목록_시안_2` (490:2781, 1440×2532) · `자유게시판` (490:3223, 1440×2826). 스크린샷 `notice.png`, `free.png`, 컴포넌트 변형 모음 `layout-components.png`.
공용 셸(헤더·푸터 패널·토큰)은 `home-spec.md`를 따른다. 여기서는 **페이지 배경 변형 + 목록 UI**만 정의한다.

## 공용 "서브 페이지" 레이아웃 (`PageShell`)

```
[fixed 글래스 헤더]
[상단 배경 이미지 밴드: 페이지별 top-bg, 높이 ≈ 413~560, 아래로 흰색으로 페이드]
[본문 컨테이너 1200px 중앙, padding-top 120, gap 64]
   H1 64px semibold tracking -3.6px lh 75 중앙   + 제목 우측 마스코트(절대 배치)
   툴바 (칩 | 정렬/검색/액션)
   목록 시트: bg #ededed, radius 20, padding 16
   더보기 버튼
[푸터: 페이지별 footer-bg + 공용 글래스 패널 + 페이지별 마스코트]
```

- 본문 배경(페이지 바탕)은 `#fafafa`. 상단 배경 밴드는 헤더 뒤까지 올라간다(헤더는 밴드 위에 떠 있음).
- 페이지 제목 y: 뉴스 349 / 커뮤니티 351 (페이지 최상단 기준). 본문 프레임(Frame 7809)은 y≈230부터 시작해 `py-[120px]`.

### 페이지별 배경 · 마스코트 자산

| 페이지 | 상단 배경 | 상단 마스코트 (x, y, w×h, 1440 기준) | 푸터 배경 | 푸터 마스코트 |
|---|---|---|---|---|
| 뉴스 | `news/top-bg.png` 1440×560 (벚꽃, @2x, 투명) + 선택: `news/blossom.gif` 애니메이션 벚꽃을 좌상(-257px 중심, rotate 5°)·우상(+267px 중심, rotate -5°)에 겹침 | `news/mascot-top.gif` 토끼: x 931, y 283, 268×195 | `news/footer-bg.jpg` 1440×703 (벚꽃 나무, 상단 투명 → JPG로 저장했으므로 상단 ~230px는 페이지 배경색과 동일한 `#fafafa`로 채워져 있음. 문제되면 png로 교체) | `news/mascot-footer.gif` x 1172, y 310, 231×178 |
| 커뮤니티 | `community/top-bg.png` 1441×413 (바다 그라데이션+암석+산호, 투명) | `community/ship.png` 189×184 at (464, 27) · `community/starfish-big.png` 158×69 at (302, 256) · `community/starfish-small.png` 92×40 at (281, 311) · `community/axolotl.png`(GIF) 291×234 at (1044, 307) | `community/footer-bg.png` 1440×703 (해저 신전, 투명) | `community/mascot-footer.gif` x 1182, y 319, 154×199 (해파리) |

- 푸터 글래스 패널: 홈은 top 165, 서브 페이지는 **top 280** (h 353 동일). 패널 배경 그라데이션은 서브 페이지에서 `linear-gradient(147deg, rgba(178,178,178,.5~.55) 0%, transparent 110%)`, blur 뉴스 22.5px / 커뮤니티 15px → 공용 15px 사용.
- `SiteFooter`는 `variant: 'home' | 'news' | 'community' | …` prop으로 배경·마스코트만 바꾼다.

## 공용 목록 컴포넌트 토큰

| 요소 | 스펙 |
|---|---|
| 칩(카테고리) | h 45, px 15, py 10, pill. 활성: bg `#2a2a2a` 글자 white. 비활성: bg white, border 1px `#cdd3db`, 글자 `#727272`. 17px medium. 간격 10. 그림자 `0 .33px .37px rgba(0,0,0,.12), 0 1.5px 1.4px rgba(0,0,0,.07), 0 4px 4.5px rgba(0,0,0,.05)` (= `shadow-chip`) |
| 검색 | w 300, h 45, radius 10, bg white, border `#cdd3db`, px 12, gap 8, 아이콘 `brand/icon-search.svg` 25px, placeholder "검색어를 입력해주세요" 17px `#727272`, shadow-chip. Enter 시 `?q=` |
| 보기 전환(뉴스) | 검색 우측 15px. 같은 박스 스타일, 아이콘 25 + 라벨 17px `#2a2a2a`. 드롭다운: white, radius 10, shadow `0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)`, 항목 px12 py8 radius 8, 활성 bg `#dbdbdb`, 17px `#2a2a2a`. 항목 3개: **가로형**(한 줄 행) / **자세히**(썸네일 카드) / **타일**(2열 카드, 기본). URL `?view=row|detail|tile` |
| 정렬(커뮤니티) | 좌측. "최신순" 17px `#727272` + `brand/icon-sort-caret.svg` 25px(rotate 90, 열림 시 +180°). 옵션 최신순/조회순/인기순(구 좋아요순, URL 값은 `likes` 유지) → `?sort=latest|views|likes`. 드롭다운은 `LinkMenu` 공용 컴포넌트: listbox 역할 + 체크마크, `useTransition`으로 트리거에 대기 상태 표시 |
| 글쓰기(커뮤니티) | 110×47, radius 10, bg `#2a2a2a`, border `#2a2a2a`, 아이콘 `brand/icon-write.svg` 25 + "글쓰기" 17px semibold white, inset `0 0 14px rgba(255,255,255,.6)`, drop `0 6px 5px rgba(0,0,0,.25)`. 링크 `/community/write` (비로그인 → `/login?next=`) |
| 목록 시트 | bg `#ededed`, radius 20, p 16, shadow `0 .33px .37px rgba(0,0,0,.12), 0 1.5px 1.4px rgba(0,0,0,.07)` |
| 뱃지 | pill, px 10, py 5, 17px medium. 공지사항 bg `#f2e5ff` / 글자 `#921cff` · 점검안내 `#e5efff` / `#2e6eff` · 업데이트 안내 `#e5f8ff` / `#0ea5c9` · 패치노트 `#fff2e5` / `#ff9728` · 이벤트(시안 미표기) `#e5fff1` / `#00b894` · 안내사항 `#ffe9f6` / `#ff5fb8` · 잡담 `#f2e5ff` / `#921cff` · 질문 `#e5efff` / `#2e6eff` · 정보 `#e5fff1` / `#00b894`. 점검안내·업데이트 안내·안내사항 3색은 배너 아트의 주조색에서 뽑았고, 뉴스 '안내사항'은 커뮤니티 '정보'와 키가 겹쳐 `news-info` 토큰을 따로 둔다 |
| 메타 | 아이콘+숫자 묶음 gap 6, 묶음 간격 12, 16px medium `#2a2a2a`. 시계 `brand/icon-clock.svg` 12×12 → `YYYY-MM-DD`, 눈 `brand/icon-eye.svg` 15×12 → 조회수, 좋아요 `brand/icon-like.svg` 11×12 |
| 더보기 | h 44, pill, bg `#2a2a2a`, border `#505967`, px 17, 16px medium `#edeef0`, shadow `0 1px 0 rgba(27,31,35,.2)`. 라벨 `더보기(표시수/전체수)`. 클릭 → `?page=N+1` (1~N 누적 표시). 전부 표시되면 숨김 |

## 뉴스 목록 (`/news`)

> **업데이트(2026-09-08)**: 제품 결정으로 보기 전환(카드형/자세히/가로형 토글)이 제거되었다. 뉴스 목록은 항상 가로형(리스트) 레이아웃으로만 렌더링된다. 아래 타일 뷰·자세히 뷰 설명은 히스토리 참고용이며 더 이상 코드에 존재하지 않는다.

- 칩: 전체 / 공지사항 / 점검안내 / 업데이트 안내 / 패치노트 / 이벤트 / 안내사항 → `?category=notice|maintenance|update|patch|event|info` (없으면 전체).
  - **업데이트(2026-09-08)**: 말머리가 3종 → 6종으로 늘었다(Figma `공지별 배너_1200x628`, 2032:1882 의 배너 6종과 1:1). 칩이 한 줄에 담기지 않으므로 뉴스 칩만 가로 스크롤 대신 줄바꿈(`CategoryChips wrap`)을 쓴다. 커뮤니티·가이드·랭킹 칩은 종전대로 한 줄 + 좁은 화면 스크롤이다.
- 툴바 우측: 검색(300) + 보기 전환. 툴바와 시트 사이 24px.
- **타일 뷰(기본)**: 시트 안 2열 grid, gap 16. 카드: bg white, border `#cdd3db`, radius 20, p 24, gap 24, shadow-chip.
  - 1행: 뱃지 (좌). (`layout-components.png` 변형에서는 좌측에 24×24 아이콘 박스(별/클립보드) + 우측 뱃지 — 아이콘 박스는 선택 사항, 기본 뷰는 뱃지만.)
  - 2행: 제목 27px medium `#2a2a2a` tracking -0.2 lh 24 → 요약 17px `#727272` lh 25, 2줄 clamp (h 56).
  - 3행: 메타(날짜·조회수).
  - 전체가 `<Link href="/news/[id]">`. hover: border `#2a2a2a`/40 + translateY(-2px).
- **자세히 뷰**: 1열, 카드 좌측에 썸네일(정방형 120~160, radius 12, 없으면 회색 플레이스홀더) + 우측 제목/요약/메타, 뱃지 우상단.
- **가로형 뷰**: 1열 행, h≈56: 아이콘 박스 + 제목(1줄 clamp) … 우측 뱃지, 아래 메타 한 줄. 
- 페이지당 10건. 더보기 라벨 `더보기(10/22)`.
- 모바일: 1열, 툴바는 칩 스크롤 + 검색 전폭, 보기 전환 숨김(타일 고정).

## 커뮤니티 목록 (`/community`)

- 칩: 전체 / 잡담 / 질문 / 정보 → `?category=chat|question|info`. 그룹 폭 343.
- 2번째 툴바 행: 좌 정렬 드롭다운, 우 검색(300) + 글쓰기(110). 행 간격 24.
- 시트 안 세로 리스트, gap 12. 행 카드: bg white, border `#cdd3db`, radius 20, px 24, py 15, gap 20, shadow-chip.
  - 1행(h 48, gap 24): 뱃지 + 제목 27px medium `#2a2a2a` + `(댓글수)` 27px `#727272` (gap 10). 1줄 clamp.
  - 2행: 좌 메타(날짜 · 조회수 · 좋아요) / 우 작성자 `cin***` 26px medium `#727272` (닉네임 앞 3자 + `***` 마스킹).
  - 행 전체 `<Link href="/community/[id]">`.
- `layout-components.png` 변형: 뱃지 대신 좌측 24px 아이콘 박스(말풍선/?/i) + 우측 상단 뱃지. 기본은 좌측 뱃지 버전(free.png)을 따른다.
- 페이지당 10건, `더보기(10/100)`.

## 상세 · 작성 (시안 없음 — 목록 스타일에서 파생)

- `/news/[id]`, `/community/[id]`: 같은 PageShell + 상단 배경. 시트 안 단일 흰 카드(p 32~40): 뱃지 + 제목 32px + 메타 → 구분선 → 마크다운 본문(17px lh 1.8) → (커뮤니티) 좋아요 버튼 + 댓글 목록/작성 폼. 하단 "목록으로" 더보기 스타일 버튼.
- **뉴스 상세 배너(2026-09-08 추가)**: 카드 최상단, 뱃지 위에 말머리 배너를 깐다. 자산 `public/images/news/banners/<category>.png` (Figma `공지별 배너_1200x628`, 2032:1882), 카드 폭 전체 · 비율 1200:628 · radius 12 · 아래 여백 24. 첫 화면 이미지라 `next/image` 의 `preload`(Next 16 에서 `priority` 대체)를 쓴다. 같은 배너를 `generateMetadata` 의 Open Graph · Twitter 이미지(절대 URL, `NEXT_PUBLIC_SITE_URL` 기준)로도 쓴다. 매핑은 `lib/constants/news-banners.ts` 단일 출처이며 알 수 없는 말머리는 공지사항 배너로 떨어진다. 목록 행에는 배너를 넣지 않는다(행 높이 81px 유지).
- `/community/write`: 시트 안 폼 카드. 카테고리 셀렉트(칩 스타일 라디오) + 제목 input + **본문 에디터** + 등록(글쓰기 버튼 스타일). 고객지원 폼 필드 스타일(`support` 시안: input h 44, radius 10, border `#cdd3db`, placeholder `#9a9a9a`) 재사용.

에디터(시안에 없는 추가분)

시안은 마크다운 textarea 였지만 제품 요구가 "에디터 + 이미지 첨부 + 영상 임베드"로 바뀌었다.
시안의 입력 표면 규칙(흰 바탕 · `#cdd3db` 테두리)은 그대로 따르고 모서리만 12로 키운다.

- 표면: `components/editor/PostEditor.tsx`. 흰 바탕, border `#cdd3db`, radius 12, 본문 영역 최소 높이 320.
- 툴바: 에디터 상단에 `sticky`(스크롤해도 서식 버튼이 따라온다). 390px 에서는 줄바꿈으로 접힌다.
  버튼 h 36, radius 8, 활성 상태는 `#2a2a2a` 배경 + 흰 글자이며 `aria-pressed` 로도 알린다.
  굵게 · 기울임 · 밑줄 · 취소선 / H2 · H3 / 목록 · 번호 · 인용 / 링크 · 이미지 · 영상.
- 링크·영상은 창(prompt)이 아니라 툴바 아래로 펼쳐지는 인라인 입력 줄을 쓴다.
  잘못된 주소는 그 줄에 바로 문구를 띄운다(모바일에서 창이 뜨면 커서 위치를 잃는다).
- 본문 타이포는 상세 화면과 같은 `.prose-board` 를 그대로 쓴다. 쓰면서 보는 모양과 저장 후
  보는 모양이 달라지지 않게 하려는 것이다.
- 이미지: 툴바 버튼 · 끌어다 놓기 · 붙여넣기 3경로. 본문 안에서는 `max-width:100%` + radius 8.
- 영상: 16:9 반응형(`.video-embed`). 저장은 자리표시자, 표시는 `youtube-nocookie` / `player.vimeo` iframe.

## 목업 데이터

- `lib/mock/news.ts`: 22건 (공지 12 / 패치 6 / 이벤트 4), 제목·요약·조회수·날짜 다양화. `lib/mock/community.ts`: 100건 생성기(카테고리 순환, 댓글수·좋아요 랜덤 시드 고정).
- 데이터 접근은 `lib/data/news.ts`, `lib/data/community.ts`의 async 함수(`getNewsList({category,q,view,page})` 등)로만. Phase 4에서 Supabase로 교체.
