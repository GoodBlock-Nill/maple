# 글자월드 (MapleStory Worlds)

메이플스토리 월드 게임 **글자월드**의 공식 홈페이지 + 커뮤니티. 운영 관리자 콘솔(`admin/`)은
같은 저장소 안 별도 워크스페이스로 산다.

- 사용자 사이트(이 저장소 루트) — Vercel `maple-web`, https://maple-web-sigma.vercel.app
- 관리자 콘솔(`admin/`) — Vercel `maple-admin`(Root Directory = `admin`), https://maple-admin.vercel.app
- 하나의 Supabase 프로젝트를 두 앱이 공유한다(`zafouiovmsfebfkjuyos`).
- GitHub `GoodBlock-Nill/maple` · 작업 브랜치 `develop` → `main`(운영 미러).

## 요구 도구

- Node 22+
- pnpm 10 (`packageManager: pnpm@10.28.0`)
- Docker + Supabase CLI (로컬 DB 스택용)

## 시작하기

```bash
pnpm install                  # 워크스페이스 루트(admin 포함) 일괄 설치
cp .env.example .env.local    # 사용자 사이트 값 채우기
cp admin/.env.example admin/.env.local   # 관리자 콘솔 값 채우기
pnpm dev                      # http://localhost:3000
pnpm --filter @maple/admin dev  # http://localhost:3100
```

DB 를 처음 붙이는 경우 `supabase/README.md` §1 을 먼저 본다(로컬 스택 · 마이그레이션 ·
시드).

## 스크립트

| 스크립트              | 설명                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `pnpm dev`             | 개발 서버 실행                                                |
| `pnpm build`           | 프로덕션 빌드                                                 |
| `pnpm start`           | 프로덕션 서버 실행                                            |
| `pnpm lint`            | ESLint 검사                                                   |
| `pnpm format`          | Prettier 로 코드 포맷팅                                       |
| `pnpm format:check`    | Prettier 포맷 검사                                            |
| `pnpm typecheck`       | TypeScript 타입 검사                                          |
| `pnpm test`            | 단위 테스트 실행 (Vitest)                                     |
| `pnpm test:watch`      | 단위 테스트 watch 모드                                        |
| `pnpm test:coverage`   | 단위 테스트 커버리지 리포트                                   |
| `pnpm test:e2e`        | E2E 테스트 실행 (Playwright — chromium · Pixel 7)             |
| `pnpm gen:types`       | Supabase 스키마 → `types/database.types.ts` (+ admin 쪽 복사) |

관리자 콘솔 전용 스크립트는 `pnpm --filter @maple/admin <script>` 로 부른다 — `dev`(3100
포트) · `build` · `start` · `lint` · `typecheck` · `test` · `test:e2e` ·
`bootstrap:admin`(첫 슈퍼어드민 생성, `admin/README.md` §4.5).

콘텐츠 시드 스크립트:

| 스크립트                          | 설명                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `node scripts/seed-legal.mjs`      | 코드 문안(`lib/content/{privacy,operating}-policy`) → HTML → 약관 마이그레이션 SEED 재생성 |
| `node scripts/gen-news-templates.mjs` | 뉴스 카테고리 템플릿 시드 문안 → 관리자 코드 상수 + 마이그레이션 SEED 동시 생성       |

## 환경 변수

`.env.example` 을 복사해 `.env.local` 을 만든다. **값은 커밋하지 않는다** — 이름과 용도만
적는다.

| 이름                                          | 용도                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                    | Supabase 프로젝트 URL (클라이언트 노출)                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`               | Supabase anon 키 (클라이언트 노출, RLS 로 보호)                      |
| `SUPABASE_SERVICE_ROLE_KEY`                   | 서비스 롤 키 (서버 전용, 클라이언트 노출 금지)                       |
| `NEXT_PUBLIC_SITE_URL`                        | 사이트 기본 URL(메타데이터·리다이렉트)                               |
| `SOCIAL_LOGIN_MODE`                           | 간편로그인 동작 — `stub`(기본, 즉시 로그인) \| `oauth`(미구현, 준비중 안내) |
| `NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS`      | 메이플스토리 월드 UID·프로필 코드 입력 칸 노출 여부(기본 OFF)        |
| `NEXT_PUBLIC_FEATURE_POSTING_REQUIRES_MSW`    | 커뮤니티 글쓰기에 월드 계정 연동 요구(기본 OFF)                      |
| `NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON`       | 가이드(확률형 아이템) "준비 중" 화면 전환(기본 OFF = 실화면 노출)    |
| `NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON`     | 랭킹 "준비 중" 화면 전환(기본 OFF = 실화면 노출)                     |
| `NEXT_PUBLIC_FEATURE_ABOUT_DISABLED`          | 소개(About) 메뉴 비활성화(기본 ON — 다시 열려면 리터럴 `false`)      |
| `REVALIDATE_SECRET`                           | 관리자 콘솔이 이 사이트의 캐시를 비울 때 쓰는 공유 시크릿(`POST /api/revalidate`) |

관리자 콘솔 환경 변수는 `admin/.env.example` · `admin/README.md` 를 본다(관련 3개 Supabase
값과 `REVALIDATE_SECRET` 은 이 사이트와 **같은 값**을 써야 한다).

## 디렉토리 개요

### 화면 (`app/`)

| 영역          | 경로                                                                                      | 메모                                                       |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 홈            | `/`                                                                                        | —                                                              |
| 뉴스          | `/news`, `/news/[id]`                                                                      | 카드형/리스트형(`?view=card\|list`)                          |
| 커뮤니티      | `/community`, `/community/[id]`, `/community/[id]/edit`, `/community/write`                | —                                                              |
| 가이드        | `/guide`                                                                                   | 확률형 아이템 정보. "준비 중" 플래그 있음                     |
| 랭킹          | `/ranking`                                                                                 | "준비 중" 플래그 있음                                         |
| 고객지원      | `/support`(1:1 문의) · `/support/bug`(버그제보) · `/support/report`(불법이용제보), `/support/faq`, `/support/inquiries`(+`[id]`, `[id]/edit`) | 세 창구가 같은 폼·로직(종류별 카테고리·프리필·세부 유형, 첨부 5개·200MB, 접수번호). 내 문의 내역은 종류 라벨과 함께 표시, 상세는 답장 스레드(아래) |
| 마이페이지    | `/account`, `/account/link`                                                                | 닉네임·계정 관리, 계정 연동, 회원 탈퇴              |
| 정책 문서     | `/policy/[slug]`                                                                           | `privacy` · `operating` · `discord` · `marketing`             |
| 소개          | `/about`                                                                                   | 기본 비활성(플래그)                                            |
| 로그인/온보딩 | `/login`, `/register`, `/auth/onboarding`, `/auth/restore`, `/auth/callback`               | 간편로그인(구글·네이버) 전용, 이메일·비밀번호 가입 없음         |

고객지원 상세(`/support/inquiries/[id]`)는 **회원 답장 스레드**다 — 운영자가 답변한 **처리 중**
문의에 한해 회원이 같은 접수번호로 답장한다(운영자 답변 하나당 1건, 텍스트 + 첨부 형식 무관
5개·200MB). 답변 완료로 닫힌 대화는 다시 열리지 않고, 30초 도배 제한은 **접수에만** 걸린다.
설계는 `docs/reference/inquiry-thread-spec.md`, 화면 톤은 `docs/reference/inquiry-thread-designer-guide.html`.

### 코드

```
components/   about · account · auth · board · editor · guide · home ·
              layout · policy · ranking · support · ui
lib/          actions · auth · constants · content · data · mock ·
              sanitize · supabase · utils · validation
supabase/     migrations · functions · config.toml · seed.sql
scripts/      seed-legal.mjs · gen-news-templates.mjs
tests/        unit · e2e · manual(운영 DB 대고 돌리는 RLS 검증 스크립트)
docs/         admin(개발자 가이드·화면 설명서) · reference(Figma 시안 스펙 · 기능 설계)
admin/        관리자 콘솔 — 별도 Next.js 앱, admin/README.md 참고
```

## 핵심 개념

- **서버 액션 + Zod 검증** — 모든 쓰기는 서버 액션이고, 스키마 검증은 UI 잠금과 별개로
  액션 첫 줄에서 다시 한다(직접 POST 방어).
- **RLS + `is_admin()`** — DB 정책은 "관리자인가"까지만 보고, 모듈별 세부 권한은 관리자
  콘솔 앱 계층이 강제한다(`admin/README.md` §4).
- **캐시 태그 + `POST /api/revalidate`** — 공개 목록(`unstable_cache`)은 태그로 묶이고,
  관리자 콘솔이 쓰기 뒤 이 라우트를 `x-revalidate-secret` 헤더로 호출해 태그를 비운다
  (`lib/data/cache.ts` `CACHE_TAGS`, `app/api/revalidate/route.ts`).
- **정책 문서(Legal)** — 시행 중 문안은 DB(`legal_documents` + `legal_document_versions`)
  가 소유하고, 조회 실패 시 코드 문안(`lib/content/*-policy`)으로 폴백한다. 코드 문안을
  고치면 `node scripts/seed-legal.mjs` 로 HTML·마이그레이션 SEED 를 다시 뽑는다.
- **기능 플래그(`NEXT_PUBLIC_FEATURE_*`)** — 빌드 타임 치환이라 값을 바꾸면 재배포가
  필요하다. 의미는 위 환경 변수 표 참고.

## Figma 시안 레퍼런스

`docs/reference/figma/README.md` 가 색인이다. 화면별 실측 스펙은 `docs/reference/figma/*-spec.md`.

## 테스트

- 단위: Vitest(`vitest.config.ts` · `vitest.setup.ts`), jsdom.
- E2E: Playwright(`playwright.config.ts`) — `chromium` · `Pixel 7` 두 프로젝트, 로컬
  개발 서버(`pnpm dev`)를 띄워 돈다. 간편로그인은 `SOCIAL_LOGIN_MODE=stub` 으로 실제
  제공자 없이 즉시 로그인해 시나리오를 만든다.
- `tests/manual/*.mjs` — 원격 Supabase 에 직접 대고 RLS·권한 경계를 확인하는 1회성
  스크립트(`node --env-file=.env.local tests/manual/<script>.mjs`).

## 배포

| 앱            | Vercel 프로젝트 | Root Directory | URL                                    |
| ------------- | --------------- | --------------- | --------------------------------------- |
| 사용자 사이트 | `maple-web`     | (루트)          | https://maple-web-sigma.vercel.app      |
| 관리자 콘솔   | `maple-admin`   | `admin`         | https://maple-admin.vercel.app          |

- 작업은 `develop` 브랜치, `main` 은 운영 미러다.
- DB 변경은 `supabase db push`(원격 반영) + `pnpm gen:types`(타입 재생성) 순서 —
  `supabase/README.md` §1.
- Edge Function 배포: `supabase functions deploy <name> --use-api` — 함수 목록·용도는
  `supabase/README.md`.
- Auth 리다이렉트 URL 등 프로젝트 설정 변경은 `supabase config push` 로 원격에 반영한다.

## 더 읽기

- `admin/README.md` — 관리자 콘솔 코드 배치·권한 체계
- `supabase/README.md` — 스키마·RLS·마이그레이션·Edge Function
- `docs/admin/DEVELOPER-GUIDE.md` — 사용자 사이트 ↔ 관리자 콘솔 연동 실무 지도(인증·권한·캐시 무효화)
- `docs/admin/INQUIRY-GUIDE.md` · `TEMPLATES-GUIDE.md` — 1:1 문의·템플릿 시스템 상세
- `docs/admin/ACCOUNT-WITHDRAWAL-GUIDE.md` — 회원 탈퇴·파기 라이프사이클
- `docs/reference/inquiry-kinds-spec.md` — 고객지원 접수 종류(1:1 문의·버그제보·불법이용제보) 설계
- `docs/reference/inquiry-thread-spec.md` — 회원 답장 스레드 설계(규칙·데이터·RPC)
- `docs/reference/inquiry-thread-designer-guide.html` — 답장 스레드 디자이너 가이드(공개 URL `https://maple-admin.vercel.app/docs/inquiry-thread`)
