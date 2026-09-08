# 글자월드 관리자 홈페이지 기획 (v1, 2026-09-08)

사용자 결정: **별도 Next.js 앱(`admin/`, 별도 Vercel 배포)** · **이메일+비밀번호, 초대제 관리자 계정** · 1차 범위 = 콘텐츠·운영·고객지원·대시보드/감사로그 전부 · **실용적 관리자 UI**(사이드바+테이블, 글자월드 컬러 포인트).

## 1. 구조
- `admin/` — 독립 Next.js 16 앱(pnpm workspace 패키지 `@maple/admin`). 같은 Supabase 프로젝트(zafouiovmsfebfkjuyos)를 사용. Vercel 프로젝트 `maple-admin`(Root Directory = admin).
- 공유: `types/database.types.ts`는 `supabase gen types`로 루트와 `admin/types/`에 동시 생성(스크립트). Supabase 클라이언트·검증 스키마는 admin 안에 자체 구현(추후 `packages/shared`로 추출 가능).
- 권한: `profiles.role = 'admin'`만 접근(`is_admin()`). 관리자 화면의 모든 쓰기는 서버 액션 + RLS(admin 정책) + 서비스 롤은 초대/회원 제재 등 admin API가 필요한 곳만.

## 2. 인증
- 로그인: 이메일/비밀번호(Supabase Auth). `role !== 'admin'`이면 로그인 직후 로그아웃 + 안내.
- 초대: 관리자 → "관리자 초대"(이메일 입력) → `auth.admin.inviteUserByEmail` → 초대 링크로 비밀번호 설정 → profiles.role=admin (초대 시 `admin_invites` 테이블에 기록, 콜백에서 대조 후 role 부여; role은 절대 클라이언트 입력으로 채우지 않음).
- 세션 만료 30분 비활동 시 재로그인(proxy.ts), 비밀번호 재설정 메일.
- 첫 관리자: 시드 스크립트(`admin/scripts/bootstrap-admin.mjs`, 서비스 롤)로 1명 생성.

## 3. 정보 구조 (사이드바)
| 메뉴 | 경로 | 기능 |
|---|---|---|
| 대시보드 | `/` | 오늘/7일/30일: 가입, 게시글, 댓글, 문의(대기), 신고(미처리), 최근 활동 |
| 뉴스 | `/news`, `/news/new`, `/news/[id]` | 목록(카테고리·상태·검색), 작성/수정(Tiptap 에디터, 카테고리 6종, 요약, 발행/예약, 상단고정), 삭제(소프트) |
| 커뮤니티 | `/community/posts`, `/community/comments` | 게시글/댓글 목록·검색, 숨김/복구/삭제, 작성자로 이동 |
| 신고 | `/reports` | 큐(open/resolved/dismissed), 대상 미리보기, 처리(숨김+제재 연계), 기각, 메모 |
| 회원 | `/members`, `/members/[id]` | 목록·검색(닉네임/이메일/공급자), 상세(활동, 신고 이력), 정지(기간·사유)/해제, 관리자 권한 부여/회수, 닉네임 강제 변경 |
| 고객지원 | `/inquiries`, `/inquiries/[id]`, `/faqs` | 문의 목록(상태·카테고리 필터), 상세·첨부, 답변 작성(inquiry_replies), 상태 변경; FAQ CRUD·정렬 |
| 가이드 | `/gacha` | 확률형 아이템 CRUD(탭·확률·상세표), CSV 가져오기/내보내기, 공개 여부 |
| 랭킹 | `/rankings` | CSV 업로드(종합/직업/길드), 스냅샷 이력, 미리보기 |
| 사이트 설정 | `/settings` | 월드 ID, 디스코드, 유튜브, 연락 이메일, 크리에이터 이름/슬로건/소개/사진(Storage public-assets), 히어로 배너 |
| Legal | `/legal`, `/legal/[slug]` | 개인정보처리방침·디스코드 운영정책·글자월드 운영정책 문서 관리: 에디터 편집, 버전·시행일, 발행/예약, 미리보기, 버전 이력·비교. 클라이언트 `/policy/[slug]`는 발행본을 DB에서 읽고(코드 내 문안은 초기 시드·폴백) |
| 관리자 | `/admins` | 관리자 목록, 초대, 권한 회수 |
| 감사 로그 | `/audit` | 누가·언제·무엇을(테이블/행/변경 전후), 필터 |

## 4. DB 추가 (마이그레이션)
- `admin_invites(email, invited_by, token/status, created_at, accepted_at)`
- `profiles.suspended_until timestamptz`, `profiles.suspension_reason text` + 쓰기 정책에 정지 사용자 차단(글·댓글·신고·좋아요 insert 정책에 `not is_suspended()`)
- `posts.is_hidden boolean`(운영 숨김; deleted_at과 구분), `comments.is_hidden`
- `audit_logs(id, actor_id, action, target_table, target_id, before jsonb, after jsonb, created_at)` + 관리자 서버 액션에서 기록
- `legal_documents(slug unique, title)` + `legal_document_versions(document_id, version, effective_date, content_html, is_published, published_at, created_by)` — 클라이언트는 최신 발행본 조회, 공개 읽기 정책
- `rankings` 스냅샷 컬럼 확인(snapshot_at) / CSV 업로드용 `ranking_snapshots`
- 기존 admin RLS 정책 점검(posts/comments/reports/inquiries/faqs/gacha/rankings/site_settings/hero_banners) — 누락 시 추가

## 5. 기술
- Next 16 App Router, React 19, Tailwind v4, zod, Vitest, Playwright. 테이블은 헤드리스 자체 구현(정렬·필터·페이지네이션 URL 동기화), 폼은 서버 액션 + useActionState.
- 디자인 토큰: 배경 #f6f7f9, 사이드바 #1f2430(글자월드 핑크 #ff5fb8 포인트), 카드 흰색 r12, 본문 Pretendard, 로고만 Maplestory.
- 배포: Vercel `maple-admin`(GoodBlock-Product), env = Supabase URL/anon/service role, NEXT_PUBLIC_SITE_URL(클라이언트 사이트 URL, 미리보기 링크용).

## 6. 단계
0. 스캐폴드·인증·레이아웃·대시보드 골격·DB 마이그레이션 (선행)
1. 병렬: (a) 뉴스 (b) 커뮤니티·신고·회원 (c) 고객지원·FAQ (d) 가이드·랭킹·설정·관리자·감사로그
2. 통합 검증(E2E: 관리자 로그인 → 각 모듈 CRUD), 배포, 첫 관리자 계정 발급
