> **폐기된 시안(2026-09-10 오후).** 이메일 로그인·인증번호 회원가입·비밀번호 찾기는
> 간편로그인(구글·네이버) 한 화면으로 전면 교체되었다 — 현행 사양은 `auth-v2-spec.md` 다.
> 이 문서와 `auth/*.png` 는 결정 이력으로만 남긴다(구현 코드는 없다).

# 로그인 · 회원가입 시안 스펙 (Figma 2041-2289 / 2041-2365 / 2041-2473)

기준 파일 `3DWCpzRZFWOMhvlcTpbFlj`, 페이지 `Designs`. 데스크톱 1440 기준만 존재. 스크린샷은
`docs/reference/figma/auth/{login,signup-1,signup-2}.png` (긴 변 1440 축소본).

| 프레임      | 노드      | 크기      | 비고                                                  |
| ----------- | --------- | --------- | ----------------------------------------------------- |
| 로그인      | 2041:2289 | 1440×1862 | 카드 860×981 @ (290,223), 푸터 @ y=1301               |
| 회원가입\_1 | 2041:2365 | 1440×2006 | 입력 전 상태(버튼 비활성). 카드 860×1128, 푸터 y=1445 |
| 회원가입\_2 | 2041:2473 | 1440×2006 | 입력 후 상태(버튼 활성, 비밀번호 지우기 아이콘)       |

## 1. 배경 레이어와 내보낸 파일 (`public/images/auth/`)

시안 레이어를 Figma Plugin API 로 재합성해 2x PNG 로 뽑았다(헤더·카드·GIF·푸터 글래스 패널 제외).

| 파일                | 1x 크기  | 내용                                                                      | 배치                                                                 |
| ------------------- | -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `login-sky.png`     | 1440×1400 | 우주 배경(image 573) + 상단 성운(image 586, Vector×2) + 지평선 광채(fad840c) | 페이지 상단 고정, 폭 100%, 높이 자동. 로그인·비밀번호 찾기·재설정 공용 |
| `signup-sky.png`    | 1440×1380 | 같은 구성, 광채가 144px 아래(카드가 더 길어서)                             | 회원가입 페이지 상단 고정                                             |
| `footer-bg.png`     | 1440×668 | 달 표면(Group 210) + 우주정거장 + 푸터 배경(image 579) + 그 위 하늘 107px  | 푸터 섹션 배경. **푸터 글래스 패널 상단은 이 이미지 top+107**         |
| `chars/ufo.gif`     | 190×113  | 애니메이션 GIF. 좌상단 UFO                                                 | 페이지 좌표 (141,156) 에 255×151 로 업스케일(pixel-art)              |
| `mascot-footer.gif` | 105×151  | 애니메이션 GIF. 외계인 UFO                                                 | 푸터 인스턴스 좌표 (1244,196) 165×237 → `footer-bg` 기준 (1244,303)  |
| `icons/*.svg`       | —        | google 24, kakao 28, naver 28, eye 24, cancel 24, log-in 20, divider 2×14 | 시안 원본 SVG                                                        |

- 시안 안의 GIF 는 위 2개뿐이다(`download_assets` 로 포맷 확인). 행성·별은 정지 PNG 이며 `*-sky.png` 에 포함.
- 로그인 프레임: 푸터 인스턴스 y=1301, 달 상단 1270, 정거장 1194. `footer-bg.png` 는 y∈[1194,1862] 크롭이므로
  **푸터 섹션 높이 668, 패널 top 107** 로 두면 시안과 일치한다. 회원가입은 전부 +144 이동(푸터 1445, 크롭 시작 1338) —
  같은 `footer-bg.png` 를 쓴다.
- `*-sky.png` 는 하단에 시안 프레임 채움색(#fafafa)이 섞이기 전에 잘랐다. 카드가 오류 메시지로 길어지면
  하늘과 푸터 사이에 여백이 생길 수 있으므로 섹션 배경색은 `#0b1642`(달 하단색) 로 둔다.

## 2. 헤더 (menu 인스턴스 2041:2294)

기존 `SiteHeader` 와 동일한 글래스 바. 로그아웃 상태 버튼 2개(`div.ml-auto`, gap 12, drop-shadow 0 2 2 rgba(0,0,0,.25)):

- 로그인: h40, p12, rounded 50, bg white, border 1 #cdd3db, inset shadow 0 0 9 #ddd, drop-shadow 0 6 5 rgba(0,0,0,.15), Inter Medium 16 #31373d tracking -0.2
- 회원가입: h40, p12, rounded 50, bg #2a2a2a, border 1 black, inset shadow 0 0 14 rgba(255,255,255,.5), 같은 drop-shadow, Inter Medium 16 white

## 3. 카드 (Frame 8149)

- 외곽 글래스: 860 폭, border 1 white, rounded 20, padding 32, bg rgba(255,255,255,.3) + backdrop-blur 7.5, inset shadow 0 0 33 rgba(255,255,255,.4), shadow 0 .326 .733 rgba(0,0,0,.12), 0 1.541 2.867 rgba(0,0,0,.07)
- 내부 카드: 794 폭, bg white, border 1 #cdd3db, rounded 20, py 70, 세로 flex gap 40, 가운데 정렬, drop-shadow 0 .326 .367 rgba(0,0,0,.12), 0 1.541 1.433 rgba(0,0,0,.07)
- 제목: Switzer Semibold 40 #333 (로그인 / 회원가입)
- 폼 폭 580, 섹션 gap 32 (필드 묶음 ↔ 구분선 ↔ 소셜)

### 필드 공통

- 라벨: Switzer Medium 17 #2a2a2a, 라벨↔입력 gap 10
- 입력: h56, bg #fafafa, border 1 #d5d9df, rounded 12, 좌측 padding 24(테두리 포함), 텍스트 Switzer Regular 17,
  placeholder rgba(102,102,102,.6), 입력값 #2a2a2a(비밀번호 점은 Medium)
- 비밀번호 눈 아이콘 24 @ 우측 24px(입력 x=533). 값이 있을 때 첫 비밀번호 필드에는 지우기(cancel) 아이콘이 눈 왼쪽에 gap 10 으로 추가(2041:2535)
- 오류 메시지 슬롯: 입력 아래 3px, 높이 21, 14px #ee1d52 (시안은 Poppins Regular — 본문 폰트로 대체)
- 필드 묶음 세로 gap 24

### 로그인 (2041:2301)

1. 이메일 (placeholder "이메일 주소를 입력해주세요")
2. 비밀번호 (placeholder "비밀번호") + 우측 정렬 "비밀번호를 잊으셨나요" Switzer Regular 16 #111 underline, 입력과 gap 8
3. 버튼 "로그인": 580×64, bg #111, rounded 32, Switzer Semibold 18 white. **비활성(둘 중 하나 비어 있음) = opacity 25%**
4. 링크 행(gap 20): "회원가입" | "비밀번호 찾기" — Switzer Medium 17 #666, 사이 2×14 세로선(divider.svg)
5. 구분선: 2px rgba(102,102,102,.25) 양쪽, 가운데 "또는" Switzer Regular 20 #666, gap 23
6. 소셜 3개(세로 gap 16): 580×64 bg #2a2a2a rounded 50, 아이콘+텍스트 가운데 gap 16, Switzer Semibold 18 white.
   Google 아이콘 24, Kakao 28, Naver 28. 문구 "Google로 계속하기" / "Kakao로 계속하기" / "Naver로 계속하기"

### 회원가입 (2041:2489)

1. 이메일: 입력 435 + 버튼 135 (gap 10). 버튼 h56 rounded 12 bg #2a2a2a, Switzer Semibold 16 white "인증번호 전송"
2. 이메일 인증번호: 입력 435 (placeholder "인증번호 6자리") + 버튼 "인증하기" 135. **비활성 = bg #111 opacity 25%**, 활성 = bg #111
3. 비밀번호 라벨 아래 입력 2개(gap 8): "비밀번호", "비밀번호 재입력"
4. 버튼 "가입하기" 580×64 (비활성 opacity 25%, 활성 #2a2a2a)
5. 링크 행(gap 10): "계정이 이미 있으신가요?" #666 Medium 17 + [log-in 아이콘 20 + "로그인" #0067ff Medium 17] (gap 2)
6. 구분선 "또는" (#111) + 소셜 3개 — 로그인과 동일

## 4. 푸터 (로그인/회원가입_푸터 2041:2364, 1440×561)

기존 `SiteFooter` 글래스 패널 구조와 동일(패널 1300×353 @ (70,138)): 로고 109×40, 태그라인, contact 알약 274×54,
Menu / Legal 컬럼, 구분선, Copyright + SNS. 마스코트 = `mascot-footer.gif`. SNS 는 제품 결정대로 유튜브·디스코드 2개.
