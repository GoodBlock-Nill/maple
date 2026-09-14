# 대시보드 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 대시보드 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/` (하위 화면 없음) |
| 권한 모듈 | `dashboard` — read (`admin/lib/auth/permissions.ts`). `requirePermission()`이 아니라 화면 안에서 직접 `hasPermission()`으로 판정한다 |
| 주요 테이블 | `profiles`, `posts`(board='news'/'community'), `comments`, `reports`, `inquiries`, `coupon_redemptions` (전부 읽기만) |
| 클라이언트 영향 | 없음 — 이 화면에는 쓰기 동작이 없다 |
| 관련 파일 | `admin/app/(admin)/page.tsx`, `admin/components/dashboard/RecentActivity.tsx`, `admin/lib/data/dashboard.ts` |

## 1. 대시보드 (`/`)
**목적** 오늘 기준 운영 지표와 최근 활동을 한 화면에서 확인한다.

**화면 구성**
- 지표 카드 9종(`StatCard`), 카드마다 오늘 값 + "7일 · 30일" 누계:
  - 신규 가입(`profiles.created_at`), 뉴스 등록(`posts` board='news'), 커뮤니티 글(board='community'), 댓글(`comments`)
  - 미처리 신고(`reports.status='open'`, 누계 힌트 없음, 건수>0이면 danger 톤)
  - 대기 문의(`inquiries.status='pending'`, 건수>0이면 warn 톤)
  - 처리 대기 쿠폰(`coupon_redemptions.status='pending'`, 건수>0이면 warn 톤)
  - 탈퇴 대기(`profiles.deleted_at is not null and purged_at is null`)
  - 지난 7일 파기(`profiles.purged_at >= 7일 전`)
- 최근 활동 목록(`RecentActivity`): 게시글(뉴스/커뮤니티) · 댓글 · 문의 · 신고를 시간순 10건으로 합쳐 종류 뱃지 + 제목 + 작성자/구분 + 상대 시각으로 표시. 행을 누르면 해당 메뉴(`/news`, `/community/posts`, `/community/comments`, `/inquiries`, `/reports`)로 이동한다.

**동작(서버 액션)**
이 화면은 조회 전용이다. 서버 액션이 없다.

**클라이언트와의 상호작용**
- 없음. 대시보드 지표·활동은 사용자 사이트에 노출되지 않는다.
- 신고·문의처럼 사용자 사이트에서 들어오는 데이터를 "미처리 건수"로만 요약해 보여 준다.

**주의**
- 이 화면만 `requirePermission()`을 쓰지 않는다. 권한 없는 화면의 착지점이 대시보드 자신이라, 여기서 리다이렉트하면 `/?error=forbidden`이 자기 자신으로 무한히 튕긴다. 대신 `hasPermission(admin.permissions, 'dashboard', 'read')`로 직접 판정해 지표를 감추고, `?error=forbidden`으로 돌아왔으면 안내 배너만 띄운다.
- `export const dynamic = 'force-dynamic'` — 매 요청 새로 집계한다. 캐시하면 운영자가 조치 직후 확인하는 숫자가 오해를 부른다.
- 집계 실패는 `0`이 아니라 `null`로 오고 화면에는 "집계 실패"(`COUNT_FAILED`, `admin/lib/constants/messages.ts`)로 표시한다. `0`으로 그리면 "오늘 아무 일도 없었다"로 잘못 읽힌다.
- "오늘"의 경계는 한국시간(KST, UTC+9) 자정이다. UTC 자정 기준이면 오전 9시 이전 글이 전날로 밀린다.
- 최근 활동은 DB 뷰(UNION)가 아니라 4개 테이블을 각각 10건씩 읽어 애플리케이션에서 합친다 — 테이블마다 RLS가 달라, 뷰(정의자 권한)로 만들면 권한 판단이 우회될 수 있어서다.
