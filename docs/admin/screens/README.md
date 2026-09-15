# 관리자 콘솔 화면·기능 설명서 (메뉴별)

관리자 콘솔(`admin/`)의 메뉴별 화면 설명 · 기능(서버 액션) · 사용자 사이트(클라이언트)와의 상호작용을 개발 참고용으로 정리한 문서 모음이다.
메뉴 하나가 폴더 하나이고 그 안에 화면 하나당 파일 하나다(`_STRUCTURE.md`). 각 폴더의 `README.md` 는 같은 형식(`_TEMPLATE.md`)을 따른다:
**0. 한눈에**(경로 · 권한 모듈 · 주요 테이블 · 클라이언트 영향 · 관련 파일) → 화면별 **목적 / 화면 구성 / 동작(서버 액션 표) / 클라이언트와의 상호작용 / 주의**.

작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".
HTML 한 벌(`docs/admin/SCREENS-GUIDE.html`)은 이 파일들을 메뉴 탭으로 묶은 것이다.
배포본은 로그인 없이 <https://maple-admin.vercel.app/docs/screens> 에서 볼 수 있다(관리자 앱 빌드 때 `admin/scripts/sync-docs.mjs` 가 복사한다).

| # | 메뉴 | 문서 | 경로 | 클라이언트 상호작용 요약 |
|---|---|---|---|---|
| 01 | 대시보드 | [01-dashboard/](01-dashboard/README.md) | `/` | 없음(집계만) |
| 02 | 뉴스 | [02-news/](02-news/README.md) | `/news`, `/news/new`, `/news/[id]`, `/news/templates`, `/news/templates/[category]` | 발행·숨김·고정 → `news-list` 재검증 → `/news` 카드형·리스트형 |
| 03 | 커뮤니티 | [03-community/](03-community/README.md) | `/community/posts`, `/community/comments` | 숨김·삭제 → `community-list` → `/community` |
| 04 | 신고 | [04-reports/](04-reports/README.md) | `/reports` | 클라이언트 신고 접수 → 처리/기각 → 숨김·삭제·정지 연계 |
| 05 | 회원 | [05-members/](05-members/README.md) | `/members`, `/members/[id]` | 정지·탈퇴 처리 → 로그인/복구 화면, 활동 탭(게시글·댓글·신고·문의) |
| 07 | 고객지원 — 문의·카테고리·템플릿·FAQ | [07-support/](07-support/README.md) | `/inquiries`(홈페이지·이메일), `/inquiries/[id]`, `/inquiries/categories`, `/inquiries/reply-templates`, `/faqs` | 세 창구 접수 → 배정·답변·회원 답장(`/support/inquiries/[id]`); 카테고리·FAQ 는 캐시 태그 |
| 08 | 가이드(확률형 아이템) | [08-gacha/](08-gacha/README.md) | `/gacha`, `/gacha/new`, `/gacha/[id]` | `gacha` 재검증 → `/guide` (준비중 플래그 우선) |
| 09 | 랭킹 | [09-rankings/](09-rankings/README.md) | `/rankings` | 스냅샷 되돌리기 → `rankings` → `/ranking` (준비중 플래그 우선). 적재 화면은 없다 |
| 10 | 사이트 설정 | [10-settings/](10-settings/README.md) | `/settings` | 연락처·저작권·IP 고지·히어로 배너 → `site` → 푸터·정책 하단·메타데이터·`/about` |
| 11 | Legal | [11-legal/](11-legal/README.md) | `/legal`, `/legal/[slug]` | 버전 발행·예약 → `legal` → `/policy/[slug]` |
| 12 | 관리자 | [12-admins/](12-admins/README.md) | `/admins` | 없음(콘솔 내부, 슈퍼어드민 전용) |
| 13 | 감사 로그 | [13-audit/](13-audit/README.md) | `/audit` | 없음(모든 쓰기 액션의 기록) |
| 14 | 인증 화면 | [14-auth/](14-auth/README.md) | `/login`, `/forgot-password`, `/reset-password`, `/invite/accept`, `/auth/callback` | 없음(관리자 계정 전용) |

심화 문서: `docs/admin/INQUIRY-GUIDE.md`(문의 전체 흐름), `TEMPLATES-GUIDE.md`, `EMAIL-INQUIRY-GUIDE.html`, `ACCOUNT-WITHDRAWAL-GUIDE.md`, `DEVELOPER-GUIDE.md`, 변경 이력 `INQUIRY-CHANGELOG.md`.
