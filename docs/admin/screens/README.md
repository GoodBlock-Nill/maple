# 관리자 콘솔 화면·기능 설명서 (메뉴별)

관리자 콘솔(`admin/`)의 메뉴별 화면 설명 · 기능(서버 액션) · 사용자 사이트(클라이언트)와의 상호작용을 개발 참고용으로 정리한 문서 모음이다.
메뉴 하나가 파일 하나이고, 모든 파일이 같은 형식(`_TEMPLATE.md`)을 따른다:
**0. 한눈에**(경로 · 권한 모듈 · 주요 테이블 · 클라이언트 영향 · 관련 파일) → 화면별 **목적 / 화면 구성 / 동작(서버 액션 표) / 클라이언트와의 상호작용 / 주의**.

작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".
HTML 한 벌(`docs/admin/SCREENS-GUIDE.html`)은 이 파일들을 메뉴 탭으로 묶은 것이다.

| # | 메뉴 | 문서 | 경로 | 클라이언트 상호작용 요약 |
|---|---|---|---|---|
| 01 | 대시보드 | [01-dashboard.md](01-dashboard.md) | `/` | 없음(집계만) |
| 02 | 뉴스 | [02-news.md](02-news.md) | `/news`, `/news/new`, `/news/[id]`, `/news/templates` | 발행·숨김·고정 → `news-list` 재검증 → `/news` 카드형·리스트형 |
| 03 | 커뮤니티 | [03-community.md](03-community.md) | `/community/posts`, `/community/comments` | 숨김·삭제 → `community-list` → `/community` |
| 04 | 신고 | [04-reports.md](04-reports.md) | `/reports` | 클라이언트 신고 접수 → 처리/기각 → 숨김·삭제·정지 연계 |
| 05 | 회원 | [05-members.md](05-members.md) | `/members`, `/members/[id]` | 정지·탈퇴 처리 → 로그인/복구 화면, 활동 탭(게시글·댓글·신고·문의) |
| 07 | 고객지원 — 문의·FAQ | [07-support.md](07-support.md) | `/inquiries`(홈페이지·이메일), `/inquiries/[id]`, `/faqs` | 1:1 문의·버그제보·불법이용제보 접수 → 배정·잠금·답변 → `/support/inquiries/[id]`; FAQ → `faqs` |
| 07b | 고객지원 — 카테고리·답변 템플릿 | [07b-support-categories-templates.md](07b-support-categories-templates.md) | `/inquiries/categories`, `/inquiries/reply-templates` | 카테고리·프리필·세부 유형 → `inquiry-categories` → 접수 폼 |
| 08 | 가이드(확률형 아이템) | [08-gacha.md](08-gacha.md) | `/gacha`, `/gacha/new`, `/gacha/[id]` | `gacha` 재검증 → `/guide` (준비중 플래그 우선) |
| 09 | 랭킹 | [09-rankings.md](09-rankings.md) | `/rankings` | 스냅샷 교체 → `rankings` → `/ranking` (준비중 플래그 우선) |
| 10 | 사이트 설정 | [10-settings.md](10-settings.md) | `/settings` | 연락처·저작권·IP 고지·히어로 → `site` → 푸터·정책 하단·홈 |
| 11 | Legal | [11-legal.md](11-legal.md) | `/legal`, `/legal/[slug]` | 버전 발행·예약 → `legal` → `/policy/[slug]` |
| 12 | 관리자 | [12-admins.md](12-admins.md) | `/admins` | 없음(콘솔 내부) |
| 13 | 감사 로그 | [13-audit.md](13-audit.md) | `/audit` | 없음(모든 쓰기 액션의 기록) |
| 14 | 인증 화면 | [14-auth.md](14-auth.md) | `/login`, `/forgot-password`, `/reset-password`, `/invite/accept`, `/auth/callback` | 없음(관리자 계정 전용) |

심화 문서: `docs/admin/INQUIRY-GUIDE.md`(문의 전체 흐름), `TEMPLATES-GUIDE.md`, `EMAIL-INQUIRY-GUIDE.html`, `ACCOUNT-WITHDRAWAL-GUIDE.md`, `DEVELOPER-GUIDE.md`, 변경 이력 `INQUIRY-CHANGELOG.md`.
