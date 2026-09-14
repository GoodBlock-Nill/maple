# 대시보드 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 대시보드 메뉴. 화면 하나뿐이며, 조회 전용이다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에
| 항목 | 값 |
|---|---|
| 경로 | `/` (하위 화면 없음) |
| 권한 모듈 | `dashboard` — read (아래) |
| 주요 테이블 | `profiles`, `posts`, `comments`, `reports`, `inquiries`, `coupon_redemptions`(아래) |
| 클라이언트 영향 | 없음. 서버 액션이 없고 캐시 태그를 태우지 않는다 |
| 관련 파일 | 페이지·컴포넌트·데이터·문구·권한(아래) |

**동작 상세**
- **권한 모듈** — `dashboard` — read (`admin/lib/auth/permissions.ts`). read 면 지표 9장 + 최근 활동 10건을 본다. write 등급은 이 메뉴에서 쓰이지 않는다(쓰기 동작이 없다).
- **주요 테이블** — `profiles`, `posts`(board='news'/'community'), `comments`, `reports`, `inquiries`, `coupon_redemptions` — 전부 `count: 'exact', head: true` 읽기만.
- **관련 파일** — 페이지 `admin/app/(admin)/page.tsx` · 컴포넌트 `admin/components/dashboard/RecentActivity.tsx`, `admin/components/ui/StatCard.tsx` · 데이터 `admin/lib/data/dashboard.ts` · 문구 `admin/lib/constants/messages.ts` · 권한 `admin/lib/auth/{permissions,require-admin}.ts`.

## 화면 목록
| 파일 | 경로 | 설명 |
|---|---|---|
| [01-main.md](01-main.md) | `/` | 지표 카드 9장 + 최근 활동 10건 |

## 메뉴 전체 규칙
- **이 메뉴만 `requirePermission()` 을 쓰지 않는다.** 권한 없는 화면의 착지점이 대시보드 자신(`FORBIDDEN_REDIRECT = '/?error=forbidden'`, `admin/lib/auth/require-admin.ts`)이라, 여기서 다시 리다이렉트하면 자기 자신으로 무한히 튕긴다. `requireAdmin()` 으로 관리자 여부만 확인하고 `hasPermission(admin.permissions, 'dashboard', 'read')` 로 직접 판정한다.
- `export const dynamic = 'force-dynamic'` — 매 요청 새로 집계한다. 캐시된 숫자를 보여 주면 운영자가 조치 직후 확인하는 값이 오해를 부른다.
- **"오늘"의 경계는 한국시간(KST, UTC+9) 자정**이다(`kstStartOfDay()`). 7일·30일은 `now - 7일` / `now - 30일` 롤링 구간이라 자정 경계가 아니다.
- **집계 실패는 `0` 이 아니라 `null`** 로 오고 화면에는 `COUNT_FAILED`(= "집계 실패")로 찍힌다. `0` 으로 그리면 "오늘 아무 일도 없었다"로 잘못 읽힌다. 실패 원인은 `console.error('[dashboard] … 집계 실패', …)` 로만 남는다.
- 최근 활동은 DB 뷰(UNION)가 아니라 **4개 테이블을 각각 10건씩 읽어 애플리케이션에서 합친다** — 테이블마다 RLS 가 달라, 뷰(정의자 권한)로 만들면 권한 판단이 우회될 수 있다.
