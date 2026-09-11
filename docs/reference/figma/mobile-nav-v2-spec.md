# 모바일 햄버거 메뉴(드로어) v2 시안 스펙 (Figma 2UmKcpmy55IqMZ7Sg6vTeW, 2026-09-11)

| 프레임 | 노드 | 내용 | 스크린샷 |
|---|---|---|---|
| 메인홈 | 16:3433 | 비로그인 — 상단 "로그인" 알약 | `docs/reference/figma/mobile-nav-v2/drawer-guest.png` |
| 메인홈 | 16:3531 | 로그인 — 계정 줄(접힘) | `drawer-user-closed.png` |
| 메인홈 | 13:2883 | 로그인 — 계정 줄 펼침(내 정보 / 로그아웃) | `drawer-user-open.png` |

아이콘은 시안 SVG 내보내기가 부분 경로만 나와 인라인 SVG 로 그린다(외부 링크 ↗ 24: 대각선 + 우상단 꺾쇠, stroke 1.5 currentColor / 닫기 X 24 stroke 1.5).

## 드로어 골격
- 우측에서 슬라이드, **폭 290**(375 기준, x=85~375) · 흰 배경 · 좌측 배경은 어둡게 덮음(Rectangle 62, 기존 overlay 유지).
- 상단 바 56: padding-x 16, 로고 66×24(기존 `Logo` 89×32 → **66×24**), 우측 닫기 24(`close-24.svg` 모양, stroke 1.5 #2a2a2a). 하단 1px #cdd3db.
- 상단 바 아래 gap 12.
- 이하 전부 **행 48 · padding-x 20 · Inter Medium 16/22 tracking −0.4**. 좌우 여백·라운드 카드·회색 배경 카드 없음(현행 `rounded-card px-3 py-3 17px semibold` 폐기).
- 하단 블록(y=671, 뷰포트 하단 근처): 1px #cdd3db 선 → gap 12 → 행 2개: "메이플 월드 바로가기", "디스코드 바로가기" — 텍스트 **#727272** + 우측 `arrow-external-24`(↗, 24). 현행 검정/파랑 버튼 2개 폐기. 하단 고정(`mt-auto`), 바닥 여백 32.

## 비로그인 (16:3433)
- 상단 바 아래: 행 48 안에 **"로그인" 알약 250×40**(white · border #cdd3db · radius 50 · Inter Medium 16 #31373d · inset 0 0 9 #ddd + drop 0 6 5 rgba(0,0,0,.15) — 헤더 `AUTH_PILL_LIGHT_CLASS` 와 동일) → 아래 padding 16 → 1px #cdd3db → gap 16 → GNB 5행.
- 헤더의 모바일 상단 바 "로그인" 알약은 그대로(시안 상단 바에도 있음).

## 로그인 (16:3531 / 13:2883)
- 상단 바 아래: 계정 행 **44**(padding 20/14): 제공자 아이콘 24 + gap 4 + 닉네임 16/22 #2a2a2a + gap 8 + 삼각형 12×6(접힘 ▼ / 펼침 ▲). 아바타 이미지·굵은 닉네임 카드 없음 — 헤더 `AccountMenu` 트리거와 같은 모양.
- 접힘: 계정 행 바로 아래 padding 12 → 1px #cdd3db → gap 16 → GNB.
- 펼침(누르면 토글): 계정 행 아래 하위 행 2개 **40** 높이, **padding-left 44**(아이콘 폭만큼 들여쓰기), Inter Medium **14/20** #2a2a2a: "내 정보"(→ `/account`), "로그아웃"(POST 폼) → 아래 padding 12 → 1px 선 → gap 16 → GNB. 탈퇴 대기 계정은 "내 정보" 대신 "계정 복구"(기존 동작).
- 하단 "로그인" 버튼 없음(현행 하단의 로그인 버튼 제거).

## GNB 5행
- 뉴스 · 커뮤니티 · 가이드 · 랭킹 · 고객지원 (소개는 플래그로 숨김 — 기존 `isNavItemHidden`). 행 48, padding 20/14.
- 준비중(가이드·랭킹): 텍스트 #727272 — 기존 코밍순 판정(`isNavItemComingSoon`) 그대로, 링크는 유지.
- **활성(현재 페이지)**: 행 배경 **#f6f7fa** + 텍스트 **#e8308a**(16:3486 "뉴스"). 비활성 #2a2a2a.
