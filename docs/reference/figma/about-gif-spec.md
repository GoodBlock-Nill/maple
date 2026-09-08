# 소개 페이지 애니메이션 GIF 배치 스펙 (Figma 509:2958, 1440 기준)

시안의 캐릭터·마스코트는 모두 **애니메이션 GIF**다. 정지 PNG 합성(`hero-overlay.png`)을 쓰지 말고, 아래 GIF를 개별 `<img>`(unoptimized)로 배치한다. 좌표는 페이지 좌상단(0,0) 기준 px, 컨테이너는 1440 폭 기준으로 **뷰포트 폭에 비례해 스케일**(`width:100%; aspect-ratio 1440/1017`, 자식은 % 좌표/폭)해 어떤 폭에서도 잘리지 않게 한다.

배경(정지): `about/hero-stage.png` 1440×1017(@2x) = 나무 단상 + 풀숲만. 그 위에 GIF.

| 파일 (`public/images/about/`) | 원본 GIF | 표시 크기 | 위치 (x, y) | 변형 |
|---|---|---|---|---|
| `chars/c2-rabbits.gif` | 119×80 | 229×153.95 | (13.31, 502.03) | **좌우 반전** (Figma: scale-y -1 + rotate 180 = 수평 반전) |
| `chars/c3-balloons.gif` | 105×94 | 171.5×153.53 | (256.07, 502.03) | 없음 |
| `chars/c1-camera-cat.gif` | 70×72 | 119.31×122.72 | (394.87, 532.84) | **좌우 반전** |
| `chars/c4-propeller.gif` | 72×52 | 174.82×126.26 | (562.18, 502.03) | 없음 |
| `chars/c5-girl.gif` | 51×74 | 85.15×123.56 | (783, 532) | 없음 |
| `chars/c6-band.gif` | 193×90 | 317.67×148.14 | (838.67, 507.42) | **좌우 반전** |
| `chars/c7-mushroom.gif` | 150×131 | 297.43×259.76 | (1165.78, 394.75) | 없음 (우측 경계에서 1440 넘는 부분은 시안에서도 잘림 → 컨테이너 overflow hidden 허용, 단 뷰포트가 1440보다 좁을 때는 컨테이너 스케일로 동일 비율 유지) |
| `avatar-dot.gif` | 52×72 | 205.83×285 | (1209.58, 1484.41) | 없음. 그림자 svg 생략 가능 |
| `mascot-footer.gif` | — | 214×169.42 | 푸터 기준 (1202.28, 338.5) | **좌우 반전** |

렌더링: `image-rendering: pixelated`는 쓰지 않는다(시안은 부드럽게 확대). `<img>`는 `width/height` 속성 명시, `alt=""`, `aria-hidden`. `prefers-reduced-motion`에서는 그대로 두되 `loading="lazy"` 금지(첫 화면).

## 양피지 패널 레이어 분해 (2026-09-08 추가)

기존 `creator-panel.png`(캐릭터가 정지 이미지로 구워짐)를 쓰지 말고 아래 레이어로 조립한다. 좌표는 페이지 기준.

| 파일 | 크기 | 위치 (x, y) | 비고 |
|---|---|---|---|
| `about/panel-frame.png` | 1233×679 | (113.3, 1190.45) | 지도 프레임 + 질감 (Figma 509:2985). 그 위에 텍스트 |
| `about/panel-photo.png` | 462×406 | (152.1, 1327.05) | 크리에이터 사진 + 타원 마스크 합성 (509:2993) |
| `about/panel-vines.png` | 1256×166 | (95, 1128) | 상단 덩굴·전구 장식 (509:3012) |
| `about/chars/c8-jelly.gif` | 66×76 원본 → 276.6×318.5 | (-86.6, 1211.13) | 파란 생물 (529:5880), **좌우 반전**. 페이지 좌측 밖으로 나가는 부분은 시안처럼 잘림. 패널 프레임보다 위 z-index |

텍스트 블록: 패널 로컬 (499.2+56, 세로 중앙) → 페이지 x 614.2, 폭 663 — 기존 값 유지.

## 폰트 (2026-09-08 지시 → 2026-09-08 정정)

> **정정**: "전 화면 Maplestory OTF 통일"은 시안과 다르다(오너 피드백). 시안 텍스트 세그먼트를
> Figma Plugin API 로 전수 조사한 결과 Maplestory 는 `/소개` 두 곳뿐이다. 아래가 최종 매핑이다.

| 토큰 | 서체 체인 | 쓰는 곳 |
| --- | --- | --- |
| `--font-body` (= `--font-sans`, `--font-display`) | Switzer → Pretendard → 시스템 | 기본. 히어로 H1(600) · 칩(500/17) · 목록 제목(500) · 날짜(500/16) · 푸터 링크(400/16) · 푸터 태그라인(400/18) · 카드 제목(600/35) 등 대부분 |
| `--font-ui` (`font-ui`) | Inter → Pretendard → 시스템 | 헤더 GNB(600/16) · 헤더 인증 버튼(500/16) · "더보기"(500/16) · 확률형 아이템 카드 이름·확률(500/27) · 고객지원 큰 제목(500/30) · "문의 등록하기"(500/17) |
| `--font-intro` (`font-intro`) | Noto Sans KR → Pretendard → 시스템 | `/소개` 크리에이터 소개 문단(700/22) |
| `font-maple` (유틸) | Maplestory → Pretendard → 시스템 | `/소개` 이름 "세글자"(700/100) · 그 아래 한 줄 소개말(700/25) **딱 두 곳** |

- Switzer 는 한글 글리프가 없다. 시안에서도 한글은 Figma 기본 한글 폴백(macOS Apple SD Gothic Neo)이
  그린다. 웹에서는 그 자리를 **Pretendard** 가 받는다 — 라틴·숫자는 Switzer, 한글은 Pretendard 가
  **같은 굵기로** 나온다. 그래서 Switzer 는 400/500/600/700 실제 컷을 전부 싣는다
  (`app/fonts/Switzer-{Regular,Medium,Semibold,Bold}.otf` + 각 Italic).
- Maplestory 는 Light(300)·Bold(700) 두 벌뿐이라 그 사이 굵기는 근접 컷으로 대체된다.
- `font-synthesis: none` 은 계속 켜 둔다(가짜 볼드가 Maplestory·Noto 자리에서 폭을 늘린다).
- `font-maple` 만 `@theme` 이 아니라 `@utility` 로 만든다 — `@theme` 에 `--font-maple` 을 넣으면
  Tailwind 가 `:root` 에도 같은 이름을 정의해 next/font 가 `<html>` 에 심는 변수와 순환 참조가 된다.
