# Figma 시안 (글자월드 웹디자인)

- 파일: https://www.figma.com/design/3DWCpzRZFWOMhvlcTpbFlj/
- 페이지: `Designs` (0:1), 데스크톱 1440px 기준. 모바일 시안 없음.

> 이 디렉터리의 시안·스펙 문서에 나오는 연락처 이메일(옛 `contact@글자월드.co.kr`)은 참고용 디자인
> 원본 표기다. 실제 서비스의 문의 이메일은 제품 결정으로 `care@gjstory.com` 으로 바뀌었다
> (2026-09-10, `lib/constants/site.ts`). 이 문서들은 역사적 기록이라 고치지 않는다.

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
| 로그인 (2026-09-10 추가) | `2041:2289` | auth/login.png |
| 회원가입 입력 전·후 | `2041:2365`, `2041:2473` | auth/signup-1.png, auth/signup-2.png — 수치는 `auth-spec.md` |

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

## GIF 에셋 전수 스캔 (2026-09-08, Figma Plugin API — GIF 매직바이트 판별)

| 화면 | GIF 노드 | 표시 w×h @ x,y (프레임 로컬) | 로컬 파일 |
|---|---|---|---|
| 홈 | I489:2184;344:6906 / 6908 / 6917(반전) / 6935(반전) | 201×152 @1151,78 / 160.73² @1118.63,348.4 / 124.19×211.33 @130,158 / 235×214 @209,465 | `home/chars/pixchar-right.gif`, `mushroom.gif`, `pixchar-left.gif`, `boy.gif` |
| 홈 | 496:13627 드래곤(165.57°+flip) / 496:13640 슬라임 / 496:13641 오리 / I489:2263;461:15737 푸터 | 301.29×284.9 bbox @−79.93,664.94 / 170.1×175.77 @1301.44,1317.5 / 364×192 @1076,727.5 / 275.89×149.34 @1132.11,1848.33 | `home/dragon.gif`, `slime.gif`, `duck.gif`, `footer/home-mascot.gif` |
| 뉴스 | 490:2794 / I490:2995;461:15991 (벚꽃 GIF 그룹 490:2782는 **숨김** → PNG가 정본) | 268.12×195 @930.94,282.82 / 231.23×177.65 @1171.9,2138.96 | `news/mascot-top.gif`, `news/mascot-footer.gif` |
| 커뮤니티 | 490:3545 / I490:3547;461:16269 | 290.77×233.63 @1044.5,306.87 / 154.36×198.89 @1182,2442.93 | `community/axolotl.gif`, `community/mascot-footer.gif` |
| 가이드 | 496:12279 / I496:12280;461:16630 | 169.71×100.17 @1085.11,330.45 / 182×235.34 @1243,1931.45 | `guide/mascot-top.gif`, `guide/mascot-footer.gif` |
| 랭킹 | 493:7138 / I493:7142;461:16893 | 214.38×177.1 @1059.31,349.4 / 248.42×200.43 @1179.72,2616.07 | `ranking/mascot-panda.gif`, `ranking/mascot-footer.gif` |
| 고객지원 | 461:15262 / I461:17063;461:17062 | 271.19×198.07 @979.87,264.93 / 216×198.17 @1154,1396.92 | `support/mascot-top.gif`, `support/mascot-footer.gif` |
| 소개 | 10개 — `about-gif-spec.md` 표와 동일(전부 일치 확인) | | `about/chars/*.gif`, `avatar-dot.gif`, `mascot-footer.gif` |

배경 재export: `home/hero-bg-v2.jpg`(캐릭터·텍스트 제외), `home/mid-under-v2.png`(드래곤 제외)는 Figma에서 해당 레이어를 숨긴 클론을 @2x export한 것이다(방법은 메모리 `figma-asset-render-workflow` 참고). 브라우저 합성본은 폐기.
파일명에 `-v2` 를 붙인 이유: 같은 경로를 덮어쓰면 `next/image` 최적화 캐시가 예전(캐릭터가 구워진) 이미지를 계속 내려준다. 새 이름을 쓰면 캐시 키가 달라져 항상 최신 파일이 나간다.

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
※ 상단 마스코트는 정지 PNG 대신 애니메이션 GIF(`guide/mascot-top.gif`, `support/mascot-top.gif`, `ranking/mascot-panda.gif`)를 쓴다. 위 PNG 3장은 더 이상 참조되지 않는다.

2026-09-08 재수출: `about/footer-bg.png` → `about/footer-bg-v2.png`(선명도 개선). 파일명을 바꿔
next/image 최적화 캐시가 구본을 계속 서빙하는 문제를 우회했다.

2026-09-08 정리: GIF로 대체된 정지 이미지(`guide/mascot-top.png`, `support/mascot-snowmen.png`, `ranking/mascot-panda.png`)와 소개 페이지의 폐기 합성본(`about/video-poster.png`, `hero-overlay.png`, `creator-panel.png`, `avatar-dot.png`, `mascot-footer.png`)을 삭제. 위 표의 해당 행은 이력용.
