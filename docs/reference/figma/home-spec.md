# 홈 · 공용 셸 구현 스펙 (Figma → 코드)

Figma 파일 `3DWCpzRZFWOMhvlcTpbFlj`, 프레임 `홈` (489:2183, 1440×2217). 스크린샷: `home.png`.
모든 수치는 1440px 데스크톱 기준. 모바일 시안은 없으므로 아래 "반응형 규칙"을 따른다.

배경 레이어는 Figma의 20여 개 이미지 레이어를 브라우저에서 합성해 `public/images/`에 1장씩 넣어 두었다. 코드에서는 **이미지 1장 + 실제 HTML 텍스트/버튼**만 다룬다.

## 에셋 (`public/images/`)

| 파일 | 원본 크기(px, 1x) | 용도 |
|---|---|---|
| `brand/logo.svg` | 99×36 (푸터 109×40) | 로고 "글자월드" (핑크·노랑 카툰 로고) |
| `brand/arrow-cta.svg` | 31×31 | 히어로 CTA 우측 원형 화살표 아이콘 |
| `brand/arrow-card.svg` | 41.86×41.86 | 카테고리 카드 "바로가기" 좌측 원형 화살표 |
| `brand/sns-youtube.svg`, `sns-discord.svg`, `sns-facebook.svg` | 32 / 14 / 13.7×25.75 | 푸터 SNS 아이콘 |
| `home/hero-bg-v2.jpg` | 1440×760 (@2x 저장) | 히어로 배경 전체(하늘 그라데이션+맵). 캐릭터 GIF·텍스트/버튼 없음 |
| `home/mid-under-v2.png` | 1440×1102 (@2x, 투명) | 카드 섹션 **아래** 레이어: 흰 구름 윤곽+연하늘 그라데이션+구름(드래곤은 GIF 로 분리) |
| `home/mid-over.png` | 1440×1102 (@2x, 투명) | 카드 섹션 **위** 레이어(pointer-events:none): 카드 하단을 덮는 구름 + 하단 숲 |
| `home/card-notice.png` 등 4종 | 333×365 (@2x, 투명) | 카드 상단 아트. 하단이 물결 모양으로 마스킹되어 있어 색 패널 위에 겹친다 |
| `home/slime.gif`, `dragon.gif`, `duck.gif` | 170×176 / 252×229 / 364×192 | 애니메이션 GIF 마스코트. `<img>`로 unoptimized 렌더 |
| `footer/home-bg.jpg` | 1440×588 (@2x) | 홈 푸터 배경(잔디+블러). 글래스 패널 없음 |
| `footer/home-mascot.gif` | 276×149 | 푸터 우측 마스코트(애니메이션) |

## 디자인 토큰 (시안 실측)

| 토큰 | 값 | 비고 |
|---|---|---|
| ink | `#2a2a2a` | 제목·본문·검정 버튼 배경 |
| ink-muted | `#737373` | 히어로 서브카피 |
| footer-muted | `#c2c2c2` | 푸터 링크·카피라이트 |
| line-soft | `#cdd3db` | 로그인 버튼 테두리 |
| glass | `rgba(255,255,255,.4)` + `backdrop-blur(7.5px)` + `border 1px #fff` + `inset 0 0 33px rgba(255,255,255,.4)` | 헤더·CTA 래퍼 |
| discord gradient | `linear-gradient(77.6deg, #5290f4 0%, #3b82f6 52%, #406ae4 104%)`, border `#3b82f6`, shadow `0 6px 5px rgba(82,144,244,.4)` | 디스코드 CTA |
| card-notice / card-patch / card-free / card-support | `#ffaee7` / `#74b1ff` / `#33c791` / `#ffba43` | 카드 하단 패널 |
| card sheet | `linear-gradient(180deg,#fff 0%,#f6f6f6 35%)` + `inset 0 0 15px rgba(0,0,0,.25)` | 카드 전체 배경·내부 그림자 |
| radius | 헤더 10px · 버튼 50px(pill) · 카드 15px · 푸터 패널 20px | |
| 서체 | 시안은 Switzer(라틴) + 시스템 한글. 프로젝트는 **Pretendard** 단일 사용. 로고는 이미지 | |

## 1. 헤더 (`menu` 489:2262, 1440×110)

- 페이지 위에 **떠 있는(fixed/absolute)** 글래스 바. 배경 이미지 위에 겹친다. 상단 여백 20px, 가로 중앙 정렬, 콘텐츠 폭에 맞춘 너비(auto). 좌우 패딩 20px, 상하 15px, 라운드 10px.
- 내부: 로고(99×36) → 53px 간격 → 메뉴 5개(소개·뉴스·커뮤니티·가이드·고객지원, 16px semibold `#2a2a2a`, 간격 50px, letter-spacing −0.2px) → 53px → 버튼 2개(간격 12px).
- 로그인: h 40, px 12, 흰 배경, border `#cdd3db`, pill, `inset 0 0 9px #ddd`, 16px medium `#31373d`.
- 회원가입: h 40, 배경 `#2a2a2a`, border black, pill, `inset 0 0 14px rgba(255,255,255,.5)`, drop-shadow `0 6px 5px rgba(0,0,0,.15)`, 흰 글자.
- 스크롤 시 상단 고정(sticky) 유지. 모바일(<1024px): 로고 + 햄버거 + 회원가입만 노출, 메뉴는 드로어.

> **변경 — 제품 결정 2026-09-08 (시안과 다름).**
> 로그인 수단이 간편로그인(구글·카카오·네이버)으로 바뀌면서 "가입"과 "로그인"의
> 구분이 사라졌다(첫 로그인이 곧 가입이다). 그래서 시안의 버튼 **2개 대신 1개**만 둔다.
>
> - 미로그인: **진한 필 "로그인" 하나**. 표면은 시안의 회원가입 버튼 그대로
>   (h 40 · 배경 `#2a2a2a` · pill · `inset 0 0 14px rgba(255,255,255,.5)` · drop-shadow).
>   시안의 흰 배경 로그인 버튼(테두리 `#cdd3db`)은 쓰지 않는다.
> - 로그인 상태: `닉네임님` + 로그아웃(흰 버튼).
> - 모바일(<1024px): 로고 + **로그인**(미로그인일 때만) + 햄버거. 드로어 하단도
>   같은 진한 필 하나이며, 로그인 상태에서는 닉네임 + 로그아웃으로 바뀐다.
> - 나머지 치수(메뉴 간격 50px, 우측 그룹 간격 12px, 로고 99×36, 라운드 10px)는 그대로다.
> - `/register` 는 화면을 없애고 `/login` 으로 **308 영구 이동**한다(옛 링크 보존).
- 라우트 매핑: 소개 `/about`, 뉴스 `/news`, 커뮤니티 `/community`, 가이드 `/guide`, 고객지원 `/support`.

## 2. 히어로 (`홈_상단 이미지` 489:2184, 1440×760)

- 배경: `hero-bg-v2.jpg`를 `object-cover`, 섹션 높이는 1280 이상에서 `100vw×760/1440`(1440 에서 정확히 760) / 1024~1279 760 / 640~1023 680 / 그 아래 560. 헤더가 위에 겹치므로 섹션은 페이지 최상단에서 시작.
- 텍스트 블록(344:6918): 가로 중앙, top 186px, 패딩 50px, 세로 간격 24px.
  - H1 "새로운 즐거움의 시작, 글자월드" 64px semibold, line-height 75px, letter-spacing −3.6px, `#2a2a2a`. 모바일 36~40px, 두 줄 허용.
  - 서브 "지금 바로 글자월드에서 당신만의 특별한 메이플 이야기를 펼쳐보세요." 22px semibold, lh 30.8px, `#737373`.
  - CTA 2개(간격 20px), 각각 **글래스 링(패딩 6px, pill, white/40 + blur 7.5 + border white) 안에 버튼 h 47**:
    - "메이플월드 바로가기": 배경 `#2a2a2a`, border black, pl 30 pr 12, 텍스트 16px semibold white, 우측 `arrow-cta.svg` 31px, `inset 0 0 14px rgba(255,255,255,.6)`, drop-shadow `0 6px 5px rgba(0,0,0,.25)`. href `/play`.
    - "디스코드 바로가기": discord gradient(위 토큰). href `/discord`.
- 배경의 캐릭터/맵 요소는 이미지에 포함되어 있으므로 별도 배치 없음.

## 3. NEWS & COMMUNITY 섹션 (Frame 7940 496:13570, 1440×1102, 페이지 y=596.5)

히어로 하단(y 596.5)과 **163px 겹쳐** 시작한다(구름이 히어로 아랫부분을 덮음). 구현: 섹션에 `margin-top:-164px` 또는 히어로 높이를 596으로 두고 구름을 위로 올린다.

레이어 순서(아래→위): `mid-under-v2.png` → 드래곤 GIF → 카드 4장 → 제목 텍스트 → `mid-over.png`(pointer-events:none) → 슬라임 GIF → 오리 GIF.

- 제목 "NEWS & COMMUNITY": 64px semibold uppercase `#2a2a2a`, 중앙, 프레임 기준 top 280px.
- 오리 GIF: 우측, x 1076 y 131, 364×192 (제목 우측 위에 걸침).
- 카드 4장(각 333×482, 프레임 기준 좌표·회전):

| 카드 | x | y | 회전 | 링크 |
|---|---|---|---|---|
| 공지사항 Notice | 57 | 415 | −4° | `/news?category=notice` |
| 패치노트 Patch notes | 400 | 386 | +3.5° | `/news?category=patch` |
| 자유게시판 Community | 662 | 433 | −5.5° | `/community` |
| 고객지원 Support | 1054 | 384 | +4° | `/support` |

  (회전값은 인스턴스 바운딩 박스로 역산한 근사치. 시안 인상: 살짝 흩뿌린 카드 느낌. 데스크톱은 absolute 배치, <1024px에서는 2열 grid·회전 0, <640px 1열.)

- 카드 구조(333×482, radius 15, 전체 배경 card sheet 그라데이션, inset shadow):
  1. 색 패널: top 191.5, h 291, 좌우 패딩 30, 상단 패딩 134, 하단 30, 배경색 카드별 토큰, radius 15.
     - 제목 35px semibold `#2a2a2a` / 영문 부제 25px semibold opacity .5 (간격 15px).
     - 하단 "바로가기": `arrow-card.svg` 41.86px + 텍스트 20px semibold (간격 10px).
  2. 아트 이미지 `card-*.png`: top 0, 333×365, 패널 위에 겹침(z-index 위). 물결 모양 하단은 PNG 알파에 포함.
  - hover: translateY(−6px) + 회전 0으로 복귀, transition 200ms.
- 슬라임 GIF: x 1301 y 721, 170×176 (고객지원 카드 우하단에 걸침).
- `mid-over.png`의 하단 숲이 프레임 y 753~1103을 차지하고 그대로 푸터 위로 이어진다.

## 4. 푸터 (`홈_푸터` 489:2263, 1440×588)

- 배경 `footer/home-bg.jpg` object-cover. 상단이 앞 섹션의 숲과 자연스럽게 이어진다(별도 구분선 없음).
- 글래스 패널: 1300×353, 중앙, top 165, radius 20, `backdrop-blur(15px)`, border `1px rgba(255,255,255,.4)`, 배경 `linear-gradient(147deg, rgba(124,124,124,.47) 0%, rgba(0,0,0,0) 110%)`. 패딩 좌우 150 / 상하 40.
  - 1행(간격 100px): [로고 109×40 → 20px → 소개문 18px white lh 25 (폭 309) → 40px → 이메일 pill 버튼(흰 배경, px 40 py 15, 18px semibold `#2a2a2a`)] | [Menu 20px medium white + 링크 5개 16px `#c2c2c2` 간격 16] | [Legal 20px + 개인정보처리방침·디스코드 운영정책].
  - 구분선 1px white/40, 폭 992.
  - 2행: "Copyright © 글자월드. All rights reserved." 16px medium `#c2c2c2` | 우측 SNS 32px 3개(간격 6): 유튜브(SVG 자체 배경), 디스코드·페이스북은 `#edf1f4` 배경 radius 7 안에 아이콘.
- 마스코트 GIF `home-mascot.gif`: 패널 우측 상단에 걸침. x 1132, y 219, 276×149, drop-shadow `0 0 32px rgba(0,0,0,.25)`.
- IP 고지 문구는 시안에 없지만 넥슨 가이드 준수를 위해 Legal 아래 12px `#c2c2c2`로 유지한다.

## 반응형 규칙 (시안 없음, 자체 결정)

- 컨테이너: 1440 기준 좌우 패딩 150 → `max-w-[1140px]` 상당. 1024~1439에서는 비율 축소(`clamp`/`%`) 대신 컨테이너 폭 고정 + 배경 object-cover.
- 배경 이미지는 전부 `object-cover`, 초점 중앙. 카드 섹션 배경은 `background-size: 100% auto`가 아닌 `cover`로 두어 세로 늘어남을 허용.
- 텍스트 크기: H1 64→clamp(36px, 6vw, 64px). 섹션 제목 64→clamp(32px, 5vw, 64px).
- 카드: ≥1280 absolute+회전, 1024~1279 4열 grid 회전 유지(±3°), <1024 2열, <640 1열(각 카드 폭 100%, 최대 333).
- 헤더: <1024 햄버거 드로어. 드로어 배경은 글래스 대신 흰색.
- 애니메이션 GIF는 `prefers-reduced-motion`일 때 첫 프레임 정지 이미지로 대체하지 않아도 되나, `<img>`에 `aria-hidden`.

## 9. GIF 캐릭터 레이어 (2026-09-08 추가 — 정지 프레임 구워넣기 폐기)

Figma Plugin API로 프레임 `홈`(489:2183)의 이미지 fill을 전부 스캔해 **GIF 매직바이트**로 판별한 결과, 홈에는 애니메이션 GIF가 8개 있다.
배경 이미지는 GIF 캐릭터·텍스트를 숨긴 채 Figma에서 다시 export(@2x)했으므로 **배경에는 캐릭터가 더 이상 구워져 있지 않다.**
아래 좌표는 모두 1440 기준 CSS px, 각 섹션 로컬 좌표(x, y = 좌상단), `w×h`는 시안에서의 표시 크기(scaleMode FILL → `object-fit: cover`).

### 히어로 (`home/hero-bg-v2.jpg`, 1440×760, 캐릭터 없음)

| 파일 (`public/images/home/chars/`) | Figma 노드 | 표시 w×h | x, y | 변형 | GIF 원본 px |
|---|---|---|---|---|---|
| `pixchar-right.gif` | I489:2184;344:6906 | 201×152 | 1151, 78 | 없음 | 268×202 |
| `mushroom.gif` | I489:2184;344:6908 | 160.73×160.73 | 1118.63, 348.4 | 없음 | 200×200 |
| `pixchar-left.gif` | I489:2184;344:6917 | 124.19×211.33 | 130, 158 | **좌우 반전** `scaleX(-1)` | 171×291 |
| `boy.gif` | I489:2184;344:6935 | 235×214 | 209, 465 | **좌우 반전** `scaleX(-1)` | 235×214 |

z-order: 배경 → 캐릭터 4종 → 텍스트/CTA 블록(Frame 7809). 캐릭터는 텍스트 블록과 겹치지 않는다.

### NEWS & COMMUNITY 섹션 (`home/mid-under-v2.png`, 1440×1102, 드래곤 없음 — 재export)

| 파일 | Figma 노드 | 이미지 w×h | 위치 | 변형 |
|---|---|---|---|---|
| `home/dragon.gif` | 496:13627 (Frame 7940 > Frame 7940 안) | 252.09×229.30 | 회전 후 바운딩박스 301.29×284.90 의 좌상단 = (−79.93, 68.44). 즉 이미지 박스 left −55.33, top 96.24 | Figma rotation 165.57° + flip. Tailwind 출력은 `-scale-y-100 rotate-[-165.57deg]` (= CSS `rotate:-165.57deg; scale:1 -1`). 정확한 방향은 구버전 `mid-under`(드래곤 구워진 것, 스크래치 `assets/incoming/mid-under-OLD.png`)와 겹쳐 검증 |
| `home/slime.gif` | 496:13640 | 170.1×175.77 | 1301.44, 721 | 없음 (기존 구현 유지) |
| `home/duck.gif` | 496:13641 | 364×192 | 1076, 131 | 없음 (기존 구현: 150 캔버스 → 379 스케일, top −60) |

z-order(아래→위): mid-under(구름 프레임+구름_3+구름_2) → **드래곤** (Frame 7940 내부, 구름 그룹 위) → 카드 4장 → 제목 → 구름_1·숲(mid-over) → 슬라임 → 오리.
드래곤은 카드 아래·mid-under 위에 놓는다.

### 푸터
`footer/home-mascot.gif` 275.89×149.34 @ (1132.11, 1848.33 페이지 좌표) — 기존 구현 유지.

### 반응형
- 1440 이상: 배경은 `object-cover`로 `vw/1440` 배 확대되므로 캐릭터 레이어도 같은 배율·같은 중심으로 확대(1440×760 래퍼를 중앙 정렬 후 `scale(vw/1440)`).
- 1440 미만: 캐릭터가 **잘리면 안 된다**. 배경과 캐릭터를 한 "씬"으로 묶어 비율 축소(1440 기준 % 좌표)하거나, 잘림이 생기는 캐릭터는 안쪽으로 클램프한다. 어느 폭에서도 GIF가 섹션 밖으로 나가 `overflow:hidden` 에 잘리는 픽셀이 0이어야 한다.

### 반응형 구현 결과 (2026-09-08)
- 히어로 캐릭터 레이어는 `aspect-[1440/760]` 를 유지하는 씬 박스이고, 좌표·크기를 모두 % 로 넣어 폭에 비례해 축소된다(`components/home/hero-characters.ts`).
- 1280 이상: 섹션 높이 = `100vw × 760/1440` 이라 `object-cover` 가 배경을 자르지 않고, 씬 박스가 섹션과 정확히 겹쳐 배경·캐릭터 배율이 항상 같다. 1440 에서는 시안 좌표와 1:1.
- 1280 미만: 글자 크기(clamp 상한 64px)가 상대적으로 커져 캐릭터와 겹치므로 기존 고정 높이(760/680/560)를 유지하고, 씬 박스만 폭 비례로 줄여 아래쪽(`bottom-32px`)에 붙인다. 배경보다 캐릭터가 작아지지만 어느 폭에서도 잘리지 않는다.
- 드래곤 레이어는 `max-w-[1440px]` 안의 `aspect-[1440/1102]` 씬 박스다. 시안대로 프레임 왼쪽(-55.33) 밖으로 나가므로 1440 에서는 뷰포트 경계에 물린다(Figma export 도 동일하게 잘려 있다). 1550 이상에서는 전부 보인다.
- 섹션의 `overflow-hidden` 은 배경 이미지 두 장을 감싼 박스로 옮기고, 섹션에는 가로 스크롤만 막는 `overflow-x-clip` 을 남겼다. 드래곤은 어떤 조상에게도 세로로 잘리지 않는다.
