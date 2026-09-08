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

## 폰트 (사용자 지시 2026-09-08)

전 화면 폰트를 **Maplestory OTF**로 통일한다. 파일: `app/fonts/MaplestoryOTFBold.otf`(700), `app/fonts/MaplestoryOTFLight.otf`(300). `next/font/local`로 `--font-maple` 등록 후 `--font-sans`/`--font-body`/`--font-display` 모두 Maplestory 우선, Pretendard는 폴백. Light=본문(300), Bold=제목·버튼(700). 400/500/600 요청은 각각 300/700으로 매핑(`font-weight` 유틸은 그대로 두고 `@font-face` 2개만 제공하면 브라우저가 근접 굵기로 합성하지 않도록 `font-synthesis: none`).
