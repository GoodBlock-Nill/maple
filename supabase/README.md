# Supabase 데이터 레이어

글자월드 홈페이지의 스키마 · RLS · 스토리지 정의.

```
supabase/
  config.toml                      로컬 스택 설정 (project_id = "maple")
  migrations/                      마이그레이션 10개 (아래 표)
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
| `20260908001200_social_auth_profiles.sql`  | 간편로그인 전환 — `profiles.provider`/`provider_id`/동의 시각 3종 + `handle_new_user` 개편 |
| `20260908001300_post_content_html.sql`     | 본문 에디터 도입 — `content_format` 에 `html` 보장 + 저장 형식 계약 주석                   |
| `20260908001400_post_likes.sql`            | `post_likes` (복합 PK) + `sync_post_like_count()` 집계 트리거                              |
| `20260908001500_profiles_msw.sql`          | `profiles.msw_uid`/`msw_profile_code` (메이플스토리 월드 계정 연동) + CHECK/유니크 제약    |
| `20260908001600_news_categories.sql`       | 뉴스 말머리 6종 확장 — `maintenance`/`update`/`info` 추가 + 칩 순서(`sort_order`) 재정렬   |

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

테이블·enum·함수를 추가하면 반드시 다시 뽑는다.

```bash
supabase gen types typescript --linked > types/database.types.ts
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
| `SOCIAL_LOGIN_MODE`             | `stub`(기본) 또는 `oauth`             | 서버 전용                                     |

---

## 2-1. 간편로그인 설정

로그인 수단은 **간편로그인(구글·카카오·네이버)뿐**이다. 이메일·비밀번호 가입과
비밀번호 재설정은 제거되었다(`/forgot-password` 는 `/login` 으로 302).

### 현재 상태 — 스텁

> **현재 간편로그인 버튼은 스텁이다. 누르면 실제 제공자를 거치지 않고 즉시 로그인된다.**
> 구현 위치는 `lib/actions/auth-actions.ts` 의 `stubSocialSignIn()` 과
> `lib/supabase/stub-social.ts` 다(코드에 `TODO(auth)` 로 표시해 두었다).

동작 순서는 이렇다.

1. `signInAnonymously()` — 테스터마다 독립된 계정이 생긴다. **프로젝트 설정에서
   익명 로그인이 켜져 있어야 한다.**
2. 익명 로그인이 꺼져 있으면(**운영 환경이 지금 이 상태다**) 서비스 롤로 계정을
   **매번 새로** 만들고(`stub-<provider>-<uuid>@stub.glzaworld.local`), 매직링크
   토큰을 발급해 세션으로 바꾼다(비밀번호를 쓰지 않는다).

> **프로덕션 버그(2026-09-08, 수정됨)**: 2번 폴백이 예전에는 제공자별 **고정**
> 이메일(`demo-<provider>@stub.maple.local`)을 찾아서 재사용했다. 운영 환경은
> 익명 로그인이 꺼져 있어 이 폴백이 유일한 경로였는데, 그 계정이 한 번이라도
> 온보딩(약관 동의·닉네임·메이플스토리 월드 계정 입력)을 마치면 이후 로그인은
> 전부 온보딩을 건너뛰었다 — "카카오로 계속하기"를 두 번 눌러도 첫 번째만
> 온보딩으로 가고 두 번째부터는 바로 로그인됐다. 지금은 매 로그인마다 uuid 를
> 섞은 새 계정을 만들어(`lib/supabase/stub-social.ts` 의 `freshStubEmail()`)
> **절대 재사용하지 않는다.** 트레이드오프는 계정이 계속 쌓인다는 것 — 아래
> "스텁 계정 정리"를 주기적으로 돌린다.

전환 스위치는 환경 변수 하나다. UI 는 건드리지 않는다.

| `SOCIAL_LOGIN_MODE` | 동작                                                          |
| ------------------- | ------------------------------------------------------------- |
| 비어 있음 · `stub`  | 버튼을 누르면 즉시 로그인(위 순서)                            |
| `oauth`             | 실 OAuth. 미구현이라 "아직 준비 중인 로그인 방식입니다." 안내 |

### 익명 로그인 켜기 (운영자 작업)

`supabase/config.toml` 에는 이미 반영해 두었다(`enable_anonymous_sign_ins = true`,
`site_url`, `additional_redirect_urls`). 원격 프로젝트에 반영하려면 아래 한 줄을 실행한다.

```bash
supabase config push        # diff 를 보여 주고 [Y/n] 로 확인한다
```

대시보드로 하려면 Authentication → Sign In / Providers → **Anonymous sign-ins** 를 켠다.
켜지 않아도 로그인은 매번 새 계정을 만드는 폴백으로 동작한다(대신 계정이 계속 쌓인다).

### 스텁 계정 정리

폴백 경로(익명 로그인 꺼짐)로 로그인할 때마다 `auth.users` 에 계정이 하나씩 남는다.
전부 `@stub.glzaworld.local` 도메인이라 아래 조회로 구분할 수 있다.

```sql
-- 몇 개나 쌓였는지 먼저 확인한다.
select count(*) from auth.users where email like '%@stub.glzaworld.local';
```

정리는 **Admin API**로 한다(서비스 롤 키 필요, `auth.users` 는 SQL 로 직접 지우면
`profiles` 등 관련 행이 정합성 없이 남을 수 있다 — `handle_new_user()` 의 반대 방향
정리는 트리거가 없다). Node REPL 에서:

```js
const { createClient } = require('@supabase/supabase-js')
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// listUsers 는 페이지네이션이다. 스텁만 걸러 지운다.
let page = 1
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error || data.users.length === 0) break

  for (const user of data.users) {
    if (user.email?.endsWith('@stub.glzaworld.local')) {
      await admin.auth.admin.deleteUser(user.id)
    }
  }

  page += 1
}
```

`deleteUser()` 는 `auth.users` 행을 지우고, `profiles` 는 `on delete cascade`
(`20260908000200_profiles.sql`)로 함께 지워진다.

### 실 OAuth 로 전환할 때 운영자가 준비할 것

개발팀이 실제 연동을 붙이는 시점에 아래 값이 필요하다. **키는 저장소에 커밋하지 않는다.**

| 제공자 | 발급처               | 준비물                                                                       | 넣는 곳                                                  |
| ------ | -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| 구글   | Google Cloud Console | OAuth 2.0 클라이언트 ID · 시크릿. 승인된 리디렉션 URI 에 아래 콜백 주소 등록 | Supabase 대시보드 → Authentication → Providers           |
| 카카오 | Kakao Developers     | REST API 키(=Client ID) · Client Secret, 동일한 콜백 주소                    | 동일                                                     |
| 네이버 | Naver Developers     | Client ID · Client Secret                                                    | Vercel 환경 변수(네이버는 Supabase 기본 제공자가 아니다) |

- Supabase 콜백 주소(구글·카카오 공통):
  `https://zafouiovmsfebfkjuyos.supabase.co/auth/v1/callback`
- 카카오 동의 항목: `account_email`(필수) · `profile_nickname` · `profile_image`
- 네이버 Callback URL: `http://localhost:3000/auth/naver/callback`,
  `https://maple-web-sigma.vercel.app/auth/naver/callback`
- 네이버 제공 항목: 이메일 주소 · 별명 · 프로필 사진

사이트 URL / 허용 리다이렉트는 이미 아래로 맞춰져 있다.

| 항목                      | 값                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site URL                  | `https://maple-web-sigma.vercel.app`                                                                                                                           |
| Redirect URLs(allow list) | `http://localhost:3000/auth/callback`, `http://localhost:3000/**`, `https://maple-web-sigma.vercel.app/auth/callback`, `https://maple-web-sigma.vercel.app/**` |

제공자가 아직 연결되지 않아도 버튼은 그대로 보이고, 누르면 500 대신
"아직 준비 중인 로그인 방식입니다." 안내가 뜬다.

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
| `reports`          | ✗ (권한 자체를 회수)             | 신고 접수 + 본인 신고 조회                  | 전체 조회 · 상태 변경 |
| `post_likes`       | ✗ (권한 자체를 회수)             | 본인 좋아요 조회 · 등록 · 취소              | 전체 조회             |

스토리지

| 버킷                  | 공개 | 읽기            | 쓰기                                            |
| --------------------- | ---- | --------------- | ----------------------------------------------- |
| `public-assets`       | O    | 전체            | 관리자                                          |
| `post-images`         | O    | 전체            | 로그인 사용자, `{uid}/…` 경로만                 |
| `inquiry-attachments` | X    | 작성자 · 관리자 | 로그인 사용자, `{uid}/…` 경로만 (삭제는 관리자) |

`post-images` 의 실제 경로는 `{uid}/{yyyy}/{uuid}.{ext}` 다(`lib/supabase/storage.ts` 의
`buildPostImagePath()`). 정책이 보는 것은 **첫 세그먼트뿐**이라(`(storage.foldername(name))[1]`)
연도 폴더가 끼어들어도 판정은 그대로다. 원본 파일명은 버린다 — 파일명 자체가 개인정보가
되는 경우가 있고, 같은 이름을 두 번 올리면 덮어쓰기가 난다. 업로드는 서비스 롤이 아니라
**쿠키를 아는 클라이언트**로 한다(`lib/actions/upload-actions.ts`). 서비스 롤을 쓰면 RLS 를
건너뛰어 "남의 폴더에 쓰기"를 막는 유일한 장치가 사라진다.

본문 저장 형식

`posts.content_format` 이 `html` 이면 본문은 **정제를 마친 HTML** 이다. 정제기는
`lib/sanitize/post-html.ts` 하나뿐이고, 서버 액션이 저장 직전에 반드시 통과시킨다.
DB 에는 이 계약을 강제하는 제약이 없으므로(HTML 검증은 CHECK 로 표현할 수 없다) 새로
글을 쓰는 경로를 추가한다면 그 액션에서도 같은 정제기를 불러야 한다.

- 허용 태그: `p br strong em s u h2 h3 ul ol li blockquote a img div[data-video]`
- `img` 는 `post-images` 버킷의 공개 URL 접두사로 시작하는 것만 남는다(외부 이미지 = 트래킹 픽셀).
- `a` 는 http(s) 만, `rel="noopener noreferrer nofollow" target="_blank"` 를 강제로 덮어쓴다.
- 영상은 **iframe 으로 저장하지 않는다.** `<div data-video="youtube:{id}">` 자리표시자만 남기고
  실제 iframe 은 표시 시점(`lib/utils/post-html.ts` 의 `renderPostHtml()`)에 조립한다.
  저장된 iframe 을 믿으면 정책을 바꿔도 과거 글이 옛 속성을 그대로 들고 있게 된다.
- `markdown` 은 에디터 도입 이전 글이다. 일괄 변환하지 않는다 — 수정 화면에 들어오는 글만
  `lib/sanitize/markdown.ts` 가 HTML 로 옮겨 적고, 저장되는 순간 `content_format` 이 바뀐다.

정책만으로 막을 수 없는 두 가지는 트리거가 담당한다.

- `guard_post_counters()` — 작성자가 `view_count` / `like_count` / `is_pinned` 를 직접 조작하지 못하게 되돌린다. 조회수 증가는 `increment_post_view(p_id)` RPC 로만 한다.
- `guard_profile_role()` — 사용자가 자기 `role` 을 `admin` 으로 바꾸지 못하게 되돌린다.
  간편로그인 전환 이후에는 `email` · `provider` · `provider_id`(신원)도 함께 고정한다.
  사용자가 바꿀 수 있는 값은 닉네임 · 아바타 · 동의 시각뿐이다.
- `guard_comment_columns()` — 댓글 작성자가 `post_id` / `author_id` / `author_name` 을 바꿔 사칭하거나 글을 옮기지 못하게 되돌린다. 수정 가능한 컬럼은 `content` 와 `deleted_at` 뿐이다.
- `mark_post_edited()` — 제목·본문·요약·말머리가 **실제로** 바뀐 UPDATE 에서만 `posts.edited_at` 을 채운다. `updated_at` 은 `increment_post_view()` 의 조회수 UPDATE 로도 밀리므로 "수정됨" 표시에 쓸 수 없다.
- `sync_post_like_count()` — `post_likes` 의 insert/delete 를 `posts.like_count` 에 +1/-1 로 반영한다(0 미만으로 내려가지 않는다). 가드가 `like_count` 를 잠가 두었으므로 `sync_post_comment_count()` 와 같이 **SECURITY DEFINER + `app.counter_bypass`** 로 통과한다.

신고(`reports`)의 존재·자격 검사는 `can_report_target(target_type, target_id)` 가 맡는다.
`posts` / `comments` 에 FK 를 걸 수 없는 다형 참조라 INSERT 정책 안에서 확인하며, **SECURITY
INVOKER** 여야 한다(DEFINER 로 두면 비공개·삭제된 행의 존재가 신고 성공 여부로 드러난다).
자기 글 신고도 이 함수가 거른다.

좋아요(`post_likes`)는 행 하나가 곧 "이 사람이 이 글을 좋아한다"는 사실이다.
`(post_id, user_id)` 복합 PK 가 중복 좋아요를, INSERT 정책이 "공개·미삭제 글"을 강제한다.
SELECT 를 본인 행으로 좁힌 것은 프라이버시 결정이다 — "누가 눌렀는지" 목록은 화면 어디에도
없고, 열어 두면 특정 사용자의 활동 이력이 그대로 수집된다. 화면이 필요로 하는 값은
"내가 눌렀는가"(본인 행)와 "몇 명인가"(`posts.like_count`)뿐이다.

집계 트리거를 SECURITY DEFINER 로 둔 이유도 적어 둔다. "SECURITY INVOKER 트리거 +
EXECUTE 를 회수한 DEFINER 헬퍼"는 성립하지 않는다. 함수 EXECUTE 권한은 **호출 시점의
`current_user`** 로 검사하는데, INVOKER 트리거 안에서 그 값은 `authenticated` 라 회수하는
순간 트리거가 `permission denied` 로 죽는다. 반대로 헬퍼를 `authenticated` 에 열면 REST 로
직접 호출 가능한 집계 조작 창구가 생긴다. 트리거 함수 자체를 DEFINER 로 두면 호출 가능한
표면이 아예 없다(반환형이 `trigger` 라 직접 호출도, PostgREST 노출도 되지 않는다).

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

### 4-4. 신고

```sql
begin;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<USER_UUID>', 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  -- 기대: 성공 (남의 글)
  insert into public.reports (target_type, target_id, reporter_id, reason)
  values ('post', '22222222-0000-4000-8000-000000000001', '<USER_UUID>', 'spam');

  -- 기대: ERROR — 같은 대상을 두 번 신고할 수 없다 (reports_unique_reporter)
  insert into public.reports (target_type, target_id, reporter_id, reason)
  values ('post', '22222222-0000-4000-8000-000000000001', '<USER_UUID>', 'abuse');

  -- 기대: ERROR — 자기 글은 신고할 수 없다 (can_report_target)
  insert into public.reports (target_type, target_id, reporter_id, reason)
  select 'post', p.id, '<USER_UUID>', 'spam'
    from public.posts p where p.author_id = '<USER_UUID>' limit 1;

  -- 기대: ERROR — 남의 이름으로는 신고할 수 없다
  insert into public.reports (target_type, target_id, reporter_id, reason)
  values ('post', '22222222-0000-4000-8000-000000000002', '<ADMIN_UUID>', 'spam');

  -- 기대: 본인이 넣은 건만 보인다
  select count(*) from public.reports;

  -- 기대: 0건 갱신 — 상태 변경은 관리자 전용이다
  update public.reports set status = 'dismissed';
rollback;
```

anon 경계는 스크립트로도 확인할 수 있다(권한 회수 · RLS · check 제약 7항목).

```bash
node --env-file=.env.local tests/manual/reports-rls-check.mjs
```

### 4-5. 작성자 수정/삭제

```sql
begin;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<USER_UUID>', 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  -- 기대: 제목만 바뀌고 author_name · is_published · view_count 는 그대로,
  --       edited_at 이 채워진다 (guard_post_counters + mark_post_edited)
  update public.posts
     set title = '고친 제목', author_name = '사칭', is_published = false, view_count = 999999
   where author_id = '<USER_UUID>';
  select title, author_name, is_published, view_count, edited_at is not null as edited
    from public.posts where author_id = '<USER_UUID>';

  -- 기대: 소프트 삭제는 통과한다
  update public.posts set deleted_at = now() where author_id = '<USER_UUID>';

  -- 기대: 0건 갱신 — 삭제한 글은 다시 살릴 수 없다 (posts_update_own 의 USING)
  update public.posts set deleted_at = null where author_id = '<USER_UUID>';

  -- 기대: 0건 갱신 — 삭제한 댓글도 되살릴 수 없다 (comments_update_own 의 USING)
  update public.comments set deleted_at = now() where author_id = '<USER_UUID>';
  update public.comments set deleted_at = null where author_id = '<USER_UUID>';
rollback;
```

### 4-6. 조회수 RPC

```sql
begin;
  set local role anon;
  -- 기대: 증가된 view_count 를 반환한다 (anon 도 호출 가능)
  select public.increment_post_view('11111111-0000-4000-8000-000000000001');
rollback;
```

### 4-7. 댓글 수 동기화

```sql
begin;
  insert into public.comments (post_id, author_name, content)
  values ('22222222-0000-4000-8000-000000000001', '테스터', '댓글');

  -- 기대: comment_count 가 1 늘어 있다
  select comment_count from public.posts
   where id = '22222222-0000-4000-8000-000000000001';
rollback;
```

### 4-8. 좋아요

```sql
begin;
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', '<USER_UUID>', 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  -- 기대: 성공. like_count 가 1 늘어 있다 (sync_post_like_count)
  insert into public.post_likes (post_id, user_id)
  values ('22222222-0000-4000-8000-000000000001', '<USER_UUID>');
  select like_count from public.posts
   where id = '22222222-0000-4000-8000-000000000001';

  -- 기대: ERROR — 복합 PK 가 중복을 막는다 (23505)
  insert into public.post_likes (post_id, user_id)
  values ('22222222-0000-4000-8000-000000000001', '<USER_UUID>');

  -- 기대: ERROR — 남의 이름으로는 누를 수 없다
  insert into public.post_likes (post_id, user_id)
  values ('22222222-0000-4000-8000-000000000002', '<ADMIN_UUID>');

  -- 기대: 본인이 누른 것만 보인다
  select count(*) from public.post_likes;

  -- 기대: 취소하면 like_count 가 원래대로 돌아온다
  delete from public.post_likes
   where post_id = '22222222-0000-4000-8000-000000000001' and user_id = '<USER_UUID>';
  select like_count from public.posts
   where id = '22222222-0000-4000-8000-000000000001';
rollback;
```

권한 경계와 집계 트리거는 스크립트로도 확인할 수 있다(8항목).

```bash
node --env-file=.env.local tests/manual/post-likes-rls-check.mjs
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
