# Figma 시안 (글자월드 웹디자인)

- 파일: https://www.figma.com/design/3DWCpzRZFWOMhvlcTpbFlj/
- 페이지: `Designs` (0:1), 데스크톱 1440px 기준. 모바일 시안 없음.

| 화면 | 노드 ID | 스크린샷 |
|---|---|---|
| 홈 | `489:2183` (메뉴 드래그 변형 `461:9961`) | home.png |
| 뉴스목록(공지사항·패치노트·이벤트) | `490:2781` | notice.png |
| 자유게시판 | `490:3223` | free.png |
| 가이드 – 확률형 아이템 정보 | `496:12103` (자세히보기 `493:7143`, `496:14071`) | guide.png |
| 랭킹 | `493:6646`, `496:12818` | ranking.png |
| 고객지원(1:1 문의 + FAQ) | `461:15245` | support.png |
| 소개(크리에이터 세글자) | `509:2958` | about.png |
| 레이아웃·푸터 변형 모음 | `499:2947` | layout.png |

## 추가 프레임 (2026-09-08 전수 확인)

| 화면 | 노드 ID | 스크린샷 | 메모 |
|---|---|---|---|
| Section 7 (초기 흑백 드래프트) | `237:15455` | section7.png | 3D 흑백 오브젝트 버전 홈 + 공지사항 아코디언 목록 + 파트너스 밴드. **폐기된 v0**, 참고만 |
| 홈(메뉴 드래그) | `461:9961` | home-menu-drag.png | 카드 hover 상태: 호버한 카드만 컬러, 나머지 3장은 그레이스케일+어두운 오버레이 |
| 가이드 자세히보기(인라인) | `493:7143` | guide-detail-1.png | 클릭한 아이템 카드가 그리드 상단에서 펼쳐짐. 등급표(등급/획득 아이템명/확률%/비고), 등급색 SS 보라·S 빨강·A 주황 |
| 가이드 자세히보기(모달) | `496:14071` | guide-detail-2.png | 같은 상세를 딤 배경 모달로 표시. 구현은 **모달 + `?item=id`** 채택 |
| 랭킹 2 | `496:12818` | ranking-2.png | 더보기 이후 11~20위 상태(TOP3 없음). 구현은 TOP3 유지 + 누적 |
| 레이아웃 Section 8 | `499:2944` | layout-section8.png | 헤더 컴포넌트, 카드 hover 상태, 카테고리 아이콘 7종(별=공지, 클립보드=패치노트, 말풍선=잡담/이벤트, ?=질문, i=정보, 사람=1:1문의, 말풍선?=FAQ) |
| 레이아웃 컴포넌트 모음 | `499:2946` | layout-components.png | 뉴스 카드 3변형(아이콘형/썸네일형/한 줄 컴팩트), 커뮤니티 행, 랭킹 TOP3+테이블, 문의 폼 2변형 |
| 뉴스 목록 내부 | `490:2795`(본문 1200×1763), `490:2996`(카드형/리스트형 드롭다운) | notice.png | 상단 배경 `490:2789`(벚꽃 PNG) + `490:2782`(벚꽃 GIF) |

## 배경 이미지 합성 방법

`public/images/{page}/*-bg.png|jpg`는 Figma의 다층 이미지 레이어를 브라우저에서 합성한 결과다. 재생성이 필요하면: `get_design_context`로 노드의 React+Tailwind 코드를 받고, 텍스트/버튼 노드를 제외한 뒤 React UMD + Babel standalone + `@tailwindcss/browser@4`를 넣은 HTML로 렌더링해 Playwright로 `deviceScaleFactor: 2`, `omitBackground: true` 스크린샷을 찍는다. 스펙 문서: `home-spec.md`, `news-community-spec.md`, `guide-ranking-support-about-spec.md`.

## 미수령 에셋 (Figma MCP 에셋 서버 불안정으로 보류, 2026-09-08)

`get_screenshot(nodeId, contentsOnly)` 한 번에 **하나씩** 호출한 뒤 바로 받으면 성공률이 높다. 받은 뒤 아래 경로에 저장하면 코드의 `TODO(asset)` 폴백이 자동으로 대체된다.

| 저장 경로 (`public/images/`) | 노드 | 크기 |
|---|---|---|
| ~~`ranking/deco-right.png`~~ 수령 | 493:7139 | 160×256 |
| ~~`ranking/deco-left.png`~~ 수령 | 493:7140 | 108×104 |
| ~~`ranking/top3-char-1.png` / `-2` / `-3`~~ 수령 | 496:11678 / 496:11676 / 496:11796 | 332×243 / 234×205 / 363×243 |
| ~~`ranking/crown.png`~~ 수령 | 496:11108 | 31×30 |
| ~~`ranking/guild-icon.png`~~ 수령 | 496:11111 | 32×35 |
| ~~`ranking/row-avatar.png`~~ 수령 | 493:7037 | 80×80 |
| ~~`ranking/medal-ribbon.png`~~ 수령 | 496:11182 | 60×80 |
| ~~`guide/top-bg-clean.png`~~ 수령 (흰 박스 없는 단풍) | 496:12104 | 1440×505 |
| ~~`guide/fallen-leaves.png`~~ 수령 | 496:12276 | 416×149 |
| ~~`guide/detail-icon-*.png`~~ 수령(box/pinkbean/slime/food) | 496:14389, 14409, 14419, 14429 | 48 / 32 |
| ~~`about/video-poster.png`~~ 수령: `about/video-still.png`(영상 스틸+50% 딤, 509:2966), 캐릭터는 `hero-overlay.png`에 합성 | 509:2966 | 1440×763 |
| ~~`about/hero-stage.png`, `about/hero-bush.png`~~ 수령 → `about/hero-overlay.png` 합성(1440×1017, 캐릭터 7 + 단상 + 풀숲) | 509:2978, 509:2979 | 1440×345, 1440×446 |
| ~~`about/avatar-dot.png`~~ 수령 | 509:3011 | 206×285 |
| ~~`about/mascot-footer.gif`~~ 수령(`mascot-footer.png`, 정지 이미지) | 540:6447 | 214×169 |
| ~~`about/footer-bg.png`~~ 수령·합성 완료(16 레이어) | 529:6317 하위 이미지 노드 | 1440×703 |

2026-09-08 추가 수령: `support/deco-484/485/479/508.png`, `support/top-bg.png`, `support/mascot-snowmen.png`, `ranking/mascot-panda.png`. 미수령: 없음(홈 `duck.gif` 크기 차이만 남음).
