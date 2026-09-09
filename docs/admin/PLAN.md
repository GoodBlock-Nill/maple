# 글자월드 관리자 홈페이지 기획 (v1, 2026-09-08)

사용자 결정: **별도 Next.js 앱(`admin/`, 별도 Vercel 배포)** · **이메일+비밀번호, 초대제 관리자 계정** · 1차 범위 = 콘텐츠·운영·고객지원·대시보드/감사로그 전부 · **실용적 관리자 UI**(사이드바+테이블, 글자월드 컬러 포인트).

## 1. 구조

- `admin/` — 독립 Next.js 16 앱(pnpm workspace 패키지 `@maple/admin`). 같은 Supabase 프로젝트(zafouiovmsfebfkjuyos)를 사용. Vercel 프로젝트 `maple-admin`(Root Directory = admin).
- 공유: `types/database.types.ts`는 `supabase gen types`로 루트와 `admin/types/`에 동시 생성(스크립트). Supabase 클라이언트·검증 스키마는 admin 안에 자체 구현(추후 `packages/shared`로 추출 가능).
- 권한: `profiles.role = 'admin'`만 접근(`is_admin()`). 관리자 화면의 모든 쓰기는 서버 액션 + RLS(admin 정책) + 서비스 롤은 초대/회원 제재 등 admin API가 필요한 곳만.

## 2. 인증 · 권한 (2026-09-09 재결정)

- 로그인: **이메일/비밀번호 하나뿐**(Supabase Auth). 간편로그인 버튼은 제거했다. `role !== 'admin'`이면 로그인 직후 로그아웃 + 안내.
- 관리자 만들기: **이메일 초대**. 슈퍼어드민이 `/admins`에서 이메일 + 역할을 넣으면 `admin_invites`에 pending 행을 먼저 쓰고 초대 메일을 보낸다. 받은 사람이 `/invite/accept`에서 **스스로 비밀번호를 정한다**. 회원 상세의 "관리자 권한 부여"는 제거했다. role·admin_role_id는 절대 클라이언트 입력으로 채우지 않음.
- 권한 체계: `admin_roles(key, name, permissions jsonb)` — 모듈 13개 × `none|read|write`. 기본 시스템 역할 **슈퍼어드민(`super_admin`)**은 수정·삭제 불가. 슈퍼어드민은 커스텀 역할을 만들고 고치고 지울 수 있다(멤버가 있으면 삭제 불가). `profiles.admin_role_id`가 관리자 한 명의 역할이다.
- 강제 지점: RLS는 `is_admin()`(role='admin')이라는 **거친 문**만 본다. 모듈별 read/write는 앱 계층(`requirePermission()`)이 강제하고, 사이드바는 `none`인 모듈을 감춘다. 권한을 바꾸는 경로(profiles.role · admin_role_id · admin_roles)만 DB에서 `is_super_admin()`으로 잠근다.
- 삭제 = 비활성화: role을 내리고 admin_role_id를 비운 뒤 auth 사용자를 ban한다(계정 행과 작성 이력은 남는다). 자기 자신·마지막 슈퍼어드민은 불가.
- 세션 만료 30분 비활동 시 재로그인(proxy.ts), 비밀번호 재설정 메일.
- 첫 슈퍼어드민: 시드 스크립트(`admin/scripts/bootstrap-admin.mjs`, 서비스 롤)로 1명 생성.

## 3. 정보 구조 (사이드바)

| 메뉴        | 경로                                      | 기능                                                                                                                                                                                                             |
| ----------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 대시보드    | `/`                                       | 오늘/7일/30일: 가입, 게시글, 댓글, 문의(대기), 신고(미처리), 최근 활동                                                                                                                                           |
| 뉴스        | `/news`, `/news/new`, `/news/[id]`        | 목록(카테고리·상태·검색), 작성/수정(Tiptap 에디터, 카테고리 6종, 요약, 발행/예약, 상단고정), 삭제(소프트)                                                                                                        |
| 커뮤니티    | `/community/posts`, `/community/comments` | 게시글/댓글 목록·검색, 숨김/복구/삭제, 작성자로 이동                                                                                                                                                             |
| 신고        | `/reports`                                | 큐(open/resolved/dismissed), 대상 미리보기, 처리(숨김+제재 연계), 기각, 메모                                                                                                                                     |
| 회원        | `/members`, `/members/[id]`               | 목록·검색(닉네임/이메일/공급자), 상세(활동, 신고 이력), 정지(기간·사유)/해제, 닉네임 강제 변경 (관리자 승격은 2026-09-09 결정으로 제거)                                                                          |
| 고객지원    | `/inquiries`, `/inquiries/[id]`, `/faqs`  | 문의 목록(상태·카테고리 필터), 상세·첨부, 답변 작성(inquiry_replies), 상태 변경; FAQ CRUD·정렬                                                                                                                   |
| 가이드      | `/gacha`                                  | 확률형 아이템 CRUD(탭·확률·상세표), 공개 여부                                                                                                                                                                    |
| 랭킹        | `/rankings`                               | 현재 스냅샷 확인(종합/직업/길드), 스냅샷 이력, 이전 스냅샷으로 되돌리기. 적재는 개발팀 연동(게임 데이터)이 맡고 관리자는 조회·롤백만 한다                                                                        |
| 사이트 설정 | `/settings`                               | 월드 ID, 디스코드, 유튜브, 연락 이메일, 크리에이터 이름/슬로건/소개/사진(Storage public-assets), 히어로 배너                                                                                                     |
| Legal       | `/legal`, `/legal/[slug]`                 | 개인정보처리방침·디스코드 운영정책·글자월드 운영정책 문서 관리: 에디터 편집, 버전·시행일, 발행/예약, 미리보기, 버전 이력·비교. 클라이언트 `/policy/[slug]`는 발행본을 DB에서 읽고(코드 내 문안은 초기 시드·폴백) |
| 관리자      | `/admins`                                 | (슈퍼어드민 전용) 관리자 목록·역할 변경·삭제, 이메일 초대, 수락 대기 초대 재발송/취소, 권한(역할) 추가·수정·삭제                                                                                                 |
| 감사 로그   | `/audit`                                  | 누가·언제·무엇을(테이블/행/변경 전후), 필터                                                                                                                                                                      |

## 4. DB 추가 (마이그레이션)

- `admin_invites(email, invited_by, token/status, created_at, accepted_at)` + `role_id`, `expires_at` (2026-09-09)
- `admin_roles(key unique, name, description, permissions jsonb, is_system)` + `profiles.admin_role_id` + `is_super_admin()` + 가드 트리거 (`20260909000200_admin_roles`)
- `profiles.suspended_until timestamptz`, `profiles.suspension_reason text` + 쓰기 정책에 정지 사용자 차단(글·댓글·신고·좋아요 insert 정책에 `not is_suspended()`)
- `posts.is_hidden boolean`(운영 숨김; deleted_at과 구분), `comments.is_hidden`
- `audit_logs(id, actor_id, action, target_table, target_id, before jsonb, after jsonb, created_at)` + 관리자 서버 액션에서 기록
- `legal_documents(slug unique, title)` + `legal_document_versions(document_id, version, effective_date, content_html, is_published, published_at, created_by)` — 클라이언트는 최신 발행본 조회, 공개 읽기 정책
- `rankings` 스냅샷 컬럼 확인(snapshot_at) — 적재는 개발팀 연동(게임 데이터)이 하고 관리자는 읽기·롤백만 한다
- 기존 admin RLS 정책 점검(posts/comments/reports/inquiries/faqs/gacha/rankings/site_settings/hero_banners) — 누락 시 추가

## 5. 기술

- Next 16 App Router, React 19, Tailwind v4, zod, Vitest, Playwright. 테이블은 헤드리스 자체 구현(정렬·필터·페이지네이션 URL 동기화), 폼은 서버 액션 + useActionState.
- 디자인 토큰: 배경 #f6f7f9, 사이드바 #1f2430(글자월드 핑크 #ff5fb8 포인트), 카드 흰색 r12, 본문 Pretendard, 로고만 Maplestory.
- 배포: Vercel `maple-admin`(GoodBlock-Product), env = Supabase URL/anon/service role, NEXT_PUBLIC_SITE_URL(클라이언트 사이트 URL, 미리보기 링크용), `REVALIDATE_SECRET`·`CLIENT_SITE_URL`(아래 캐시 무효화).

### 5.1 사용자 사이트 캐시 무효화 (관리자 → 클라이언트)

- 사용자 사이트의 공개 목록은 `unstable_cache`(커뮤니티·뉴스·확률·랭킹 60초, FAQ·설정 300초)로 캐시된다. 관리자는 **별도 배포**라 `revalidateTag()` 가 닿지 않으므로, 쓰기가 끝나면 `admin/lib/revalidate.ts` 의 `revalidateClient(tags)` 가 사용자 사이트 `POST /api/revalidate`(헤더 `x-revalidate-secret`)를 부른다.
- 태그 매핑: 뉴스 발행/숨김/삭제/복구 → `news-list` · 커뮤니티/댓글 숨김·삭제·복구, 신고 처리의 숨김·삭제 → `community-list` · FAQ CRUD/발행/정렬 → `faqs` · 확률형 아이템 저장·삭제 → `gacha` · 랭킹 스냅샷 롤백 → `rankings` · 사이트 설정·히어로 배너 → `site`. 관리자 전용 테이블(감사 로그·관리자 계정·신고 상태)은 부르지 않는다. 회원 정지는 RLS 로 즉시 적용되므로 태그가 없다.
- 실패해도 관리자 쓰기는 성공한다(경고 로그 + `{ ok: false }`). 그때는 태그 수명만큼 반영이 늦어질 뿐이다.
- 반영 시점: 사용자 사이트가 `revalidateTag(tag, 'max')`(stale-while-revalidate)를 쓰므로 **무효화 직후 첫 요청은 옛 값**이고 그 요청이 갱신을 띄운다. 실측 요청 2~~4회·0.2~~0.9초(`admin/tests/e2e/client-revalidate.spec.ts`). 첫 요청부터 새 값이 필요하면 사용자 사이트 라우트가 `updateTag()` 또는 `revalidateTag(tag, { expire: 0 })` 를 써야 한다.

## 6. 단계

0. 스캐폴드·인증·레이아웃·대시보드 골격·DB 마이그레이션 (선행)
1. 병렬: (a) 뉴스 (b) 커뮤니티·신고·회원 (c) 고객지원·FAQ (d) 가이드·랭킹·설정·관리자·감사로그
2. 통합 검증(E2E: 관리자 로그인 → 각 모듈 CRUD), 배포, 첫 관리자 계정 발급
