# Supabase 데이터 레이어

글자월드 홈페이지의 스키마 · RLS · 스토리지 정의.

```
supabase/
  config.toml                      로컬 스택 설정 (project_id = "maple")
  migrations/                      마이그레이션 8개 (아래 표)
  seed.sql                         개발/스테이징 시드 (db reset 시 자동 적용)
  seed-users.md                    테스트 계정 생성 절차 (auth 는 SQL 로 못 만든다)
```

| 파일                                       | 내용                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `20260908000100_init_enums.sql`            | `extensions` 스키마, `pg_trgm`, enum 8종                                                   |
| `20260908000200_profiles.sql`              | `profiles` (auth.users 1:1)                                                                |
| `20260908000300_boards_posts_comments.sql` | `board_categories` · `posts` · `comments` + 인덱스                                         |
| `20260908000400_support.sql`               | `inquiries` · `inquiry_replies` · `faqs`                                                   |
| `20260908000500_site_content.sql`          | `site_settings` · `hero_banners` · `gacha_items` · `rankings`                              |
| `20260908000600_functions_triggers.sql`    | `set_updated_at` · `is_admin` · `handle_new_user` · `increment_post_view` · 집계/권한 가드 |
| `20260908000700_rls_policies.sql`          | 전 테이블 RLS + 정책                                                                       |
| `20260908000800_storage_buckets.sql`       | 버킷 3종 + `storage.objects` 정책                                                          |

애플리케이션 쪽 진입점은 `lib/supabase/` 다.

| 파일                                 | 용도                                            |
| ------------------------------------ | ----------------------------------------------- |
| `client.ts`                          | 브라우저(클라이언트 컴포넌트)                   |
| `server.ts`                          | 서버 컴포넌트 · 라우트 핸들러 · 서버 액션       |
| `middleware.ts`                      | `updateSession()` — 루트 `proxy.ts` 가 호출     |
| `admin.ts`                           | 서비스 롤(RLS 우회). `server-only`              |
| `types.ts`                           | `Tables<'posts'>` 등 스키마 타입 별칭           |
| `roles.ts` / `storage.ts` / `env.ts` | 순수 헬퍼 (단위 테스트: `tests/unit/supabase/`) |

---

## 1. 명령어

### 프로젝트 연결

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` 는 대시보드 URL(`https://supabase.com/dashboard/project/<PROJECT_REF>`)에서 확인한다.

### 마이그레이션 적용

```bash
# 원격(연결된 프로젝트)에 반영
pnpm dlx supabase db push

# 적용 전 diff 확인
pnpm dlx supabase db push --dry-run
```

### 로컬 스택 + 시드

Docker 가 필요하다.

```bash
pnpm dlx supabase start
pnpm dlx supabase db reset      # 마이그레이션 재적용 + seed.sql 실행
pnpm dlx supabase status        # URL / anon key / service_role key 확인
```

원격에 시드를 넣을 때는(스테이징 전용):

```bash
pnpm dlx supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

> 시드는 **운영 DB 에 넣지 않는다.** 목업 게시글·랭킹이 그대로 노출된다.

### 타입 생성

`types/database.types.ts` 는 지금 손으로 작성한 임시본이다. 프로젝트가 준비되면 교체한다.

```bash
pnpm dlx supabase gen types typescript --linked --schema public > types/database.types.ts
pnpm typecheck
```

로컬 스택 기준으로 뽑으려면 `--local` 을 쓴다.

### 테스트 계정

`supabase/seed-users.md` 참고. `seed.sql` 은 `auth.users` 를 건드리지 않는다.

---

## 2. 환경 변수

`.env.example` 을 복사해 `.env.local` 을 만든다.

| 이름                            | 출처                                  | 노출                                          |
| ------------------------------- | ------------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `supabase status` / 대시보드 API 설정 | 클라이언트                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 동일                                  | 클라이언트 (RLS 로 보호)                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | 동일                                  | **서버 전용. 절대 커밋·클라이언트 노출 금지** |
| `NEXT_PUBLIC_SITE_URL`          | 배포 도메인                           | 클라이언트                                    |

---

## 3. RLS 요약

| 테이블             | anon                             | 로그인 사용자                               | 관리자                |
| ------------------ | -------------------------------- | ------------------------------------------- | --------------------- |
| `profiles`         | ✗                                | 본인 행 조회·수정 (`role` 은 트리거가 고정) | 전체                  |
| `board_categories` | `is_active` 조회                 | 동일                                        | 전체 CRUD             |
| `posts`            | 공개·미삭제·게시시각 도래분 조회 | + 본인 글 조회, 커뮤니티 글 작성/수정/삭제  | 전체 CRUD (뉴스 포함) |
| `comments`         | 공개 글의 미삭제 댓글 조회       | + 본인 댓글 작성/수정/삭제                  | 전체 CRUD             |
| `inquiries`        | ✗                                | 본인 문의 조회, 신규 접수                   | 전체 CRUD             |
| `inquiry_replies`  | ✗                                | 본인 문의의 답변 조회                       | 전체 CRUD             |
| `faqs`             | `is_published` 조회              | 동일                                        | 전체 CRUD             |
| `site_settings`    | 조회                             | 조회                                        | 수정                  |
| `hero_banners`     | 노출기간 내 활성 배너            | 동일                                        | 전체 CRUD             |
| `gacha_items`      | 공개분 조회                      | 동일                                        | 전체 CRUD             |
| `rankings`         | 조회                             | 조회                                        | 전체 CRUD             |

스토리지

| 버킷                  | 공개 | 읽기            | 쓰기                                            |
| --------------------- | ---- | --------------- | ----------------------------------------------- |
| `public-assets`       | O    | 전체            | 관리자                                          |
| `post-images`         | O    | 전체            | 로그인 사용자, `{uid}/…` 경로만                 |
| `inquiry-attachments` | X    | 작성자 · 관리자 | 로그인 사용자, `{uid}/…` 경로만 (삭제는 관리자) |

정책만으로 막을 수 없는 두 가지는 트리거가 담당한다.

- `guard_post_counters()` — 작성자가 `view_count` / `like_count` / `is_pinned` 를 직접 조작하지 못하게 되돌린다. 조회수 증가는 `increment_post_view(p_id)` RPC 로만 한다.
- `guard_profile_role()` — 사용자가 자기 `role` 을 `admin` 으로 바꾸지 못하게 되돌린다.

---

## 4. RLS 검증 시나리오

SQL Editor 또는 `pnpm dlx supabase db psql` 에서 실행한다. 모두 `rollback` 으로 끝나므로
데이터가 바뀌지 않는다. `<USER_UUID>` / `<ADMIN_UUID>` 는 아래로 확인한다.

```sql
select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id;
```

### 4-1. anon (비로그인)

```sql
begin;
  select set_config('request.jwt.claims', null, true);
  set local role anon;

  -- 기대: 공개된 뉴스/커뮤니티 글만 보인다 (미게시·소프트삭제 제외)
  select board, count(*) from public.posts group by board;

  -- 기대: 0건. 문의는 개인정보라 anon 에게 열지 않는다.
  select count(*) from public.inquiries;

  -- 기대: 0건. 프로필은 본인/관리자만 읽는다.
  select count(*) from public.profiles;

  -- 기대: 공개 콘텐츠는 읽힌다.
  select count(*) from public.faqs;
  select count(*) from public.gacha_items;
  select count(*) from public.rankings;
  select count(*) from public.site_settings;

  -- 기대: ERROR (new row violates row-level security policy)
  insert into public.posts (board, category_key, title, content, author_name)
  values ('community', 'chat', 'anon 작성 시도', '본문', 'anon');
rollback;
```

### 4-2. 일반 사용자

```sql
begin;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<USER_UUID>', 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  -- 기대: true 가 아니라 false
  select public.is_admin();

  -- 기대: 성공
  insert into public.posts (board, category_key, title, content, author_id, author_name)
  values ('community', 'chat', '내 글', '본문', '<USER_UUID>', '테스터')
  returning id;

  -- 기대: ERROR — 뉴스는 관리자만 쓴다
  insert into public.posts (board, category_key, title, content, author_id, author_name)
  values ('news', 'notice', '가짜 공지', '본문', '<USER_UUID>', '테스터');

  -- 기대: ERROR — 남의 이름으로는 쓸 수 없다
  insert into public.posts (board, category_key, title, content, author_id, author_name)
  values ('community', 'chat', '사칭', '본문', '<ADMIN_UUID>', '관리자');

  -- 기대: 0건 갱신 (남의 글은 update 정책을 통과하지 못한다)
  update public.posts set title = '탈취' where author_id is distinct from '<USER_UUID>';

  -- 기대: 조회수는 그대로 (guard_post_counters 가 되돌린다)
  update public.posts set view_count = 999999 where author_id = '<USER_UUID>';
  select title, view_count from public.posts where author_id = '<USER_UUID>';

  -- 기대: role 이 'user' 그대로 (guard_profile_role 이 되돌린다)
  update public.profiles set role = 'admin' where id = '<USER_UUID>';
  select role from public.profiles where id = '<USER_UUID>';

  -- 기대: 본인 문의만 보인다
  select count(*) from public.inquiries;

  -- 기대: ERROR — 관리자만 FAQ 를 쓴다
  insert into public.faqs (category, question, answer) values ('etc', 'q', 'a');
rollback;
```

### 4-3. 관리자

```sql
begin;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<ADMIN_UUID>', 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  -- 기대: true
  select public.is_admin();

  -- 기대: 성공 (뉴스 작성)
  insert into public.posts (board, category_key, title, content, author_name)
  values ('news', 'notice', '관리자 공지', '본문', '운영자') returning id;

  -- 기대: 미게시 글까지 전부 보인다
  select count(*) filter (where is_published) as published,
         count(*) filter (where not is_published) as draft
  from public.posts;

  -- 기대: 전체 문의가 보인다
  select status, count(*) from public.inquiries group by status;

  -- 기대: 성공 (관리자는 집계 컬럼도 조정할 수 있다)
  update public.posts set is_pinned = true where board = 'news';
rollback;
```

### 4-4. 조회수 RPC

```sql
begin;
  set local role anon;
  -- 기대: 증가된 view_count 를 반환한다 (anon 도 호출 가능)
  select public.increment_post_view('11111111-0000-4000-8000-000000000001');
rollback;
```

### 4-5. 댓글 수 동기화

```sql
begin;
  insert into public.comments (post_id, author_name, content)
  values ('22222222-0000-4000-8000-000000000001', '테스터', '댓글');

  -- 기대: comment_count 가 1 늘어 있다
  select comment_count from public.posts
   where id = '22222222-0000-4000-8000-000000000001';
rollback;
```

---

## 5. 시드 데이터

`lib/mock/*` 를 그대로 옮긴 것이라 목업 UI 와 화면이 동일하게 나온다.

| 테이블              | 건수 | 원본                                        |
| ------------------- | ---- | ------------------------------------------- |
| `site_settings`     | 1    | `lib/constants/site.ts`, `lib/mock/site.ts` |
| `board_categories`  | 6    | `lib/constants/board.ts`                    |
| `posts` (news)      | 22   | `lib/mock/news.ts`                          |
| `posts` (community) | 30   | `lib/mock/community.ts` (앞 30건)           |
| `comments`          | 331  | 동일                                        |
| `faqs`              | 18   | `lib/mock/faqs.ts`                          |
| `gacha_items`       | 105  | `lib/mock/gacha.ts`                         |
| `rankings`          | 100  | `lib/mock/rankings.ts`                      |

id 는 전부 결정론적이다(`11111111-…` 뉴스, `22222222-…` 커뮤니티, `33333333-…` 댓글,
`44444444-…` FAQ, `55555555-…` 가챠, `66666666-…` 랭킹, `77777777-…` 카테고리).
E2E 테스트에서 특정 행을 지목할 때 이 값을 쓴다.

시드를 다시 만들려면 `lib/mock/*` 을 고친 뒤 생성 스크립트를 다시 돌린다. 스크립트는
저장소에 두지 않았으므로, 손으로 고치는 편이 빠르면 `seed.sql` 을 직접 수정해도 된다.
