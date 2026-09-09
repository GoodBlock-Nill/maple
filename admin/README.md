# 글자월드 ADMIN (`@maple/admin`)

운영 관리자 콘솔. 사용자 사이트(저장소 루트)와 **같은 Supabase 프로젝트**를 쓰지만
별도의 Next.js 앱이고 별도로 배포한다(Vercel `maple-admin`, Root Directory = `admin`).

기획은 `docs/admin/PLAN.md` 가 단일 출처다. 이 문서는 "코드가 어떻게 놓여 있는가"만 다룬다.

```bash
pnpm install                      # 저장소 루트에서 (워크스페이스)
pnpm --filter @maple/admin dev    # http://localhost:3100
pnpm --filter @maple/admin typecheck
pnpm --filter @maple/admin lint
pnpm --filter @maple/admin test
pnpm --filter @maple/admin test:e2e
```

`admin/.env.local` 은 `admin/.env.example` 을 보고 채운다. 루트 `.env.local` 의
Supabase 값 3개와 `REVALIDATE_SECRET` 을 **같은 값으로** 쓰고, 여기에
`NEXT_PUBLIC_CLIENT_SITE_URL` · `NEXT_PUBLIC_ADMIN_URL` · `CLIENT_SITE_URL`
(캐시 무효화를 보낼 사용자 사이트, 로컬은 `http://localhost:3000`)을 더한다.
로그인은 이메일+비밀번호 하나뿐이라 스위치가 없다(§4).

---

## 1. 디렉터리

```
admin/
  app/
    (auth)/        로그인 · 비밀번호 재설정 · 초대 수락      (사이드바 없음)
    (admin)/       인증된 관리 화면 전부                  (layout 이 requireAdmin())
    auth/callback/ 초대·재설정 링크 착지점(role 게이트)
  components/
    ui/            공용 프리미티브 (Button · Table · Dialog · Toast …)
    layout/        AdminShell · Sidebar · Topbar · ComingSoon
    <모듈>/        모듈 전용 컴포넌트 (admins/, dashboard/, …)
  lib/
    nav.ts         사이드바 정보 구조 — 화면을 추가하면 여기 한 줄
    revalidate.ts  사용자 사이트 캐시 무효화(revalidateClient) — 아래 §3
    supabase/      server · middleware · admin(서비스 롤) 클라이언트
    auth/          requireAdmin() · requirePermission() · permissions.ts · 30분 비활동 세션
    actions/       서버 액션 (+ FormState 계약)
    data/          읽기 전용 조회
    utils/         cn · 날짜 · 목록 URL 상태
    audit.ts       writeAuditLog()
  scripts/         bootstrap-admin.mjs (첫 슈퍼어드민)
  proxy.ts         Next 16 의 구 middleware — 세션 갱신 · 로그인 게이트 · 30분 만료
```

## 2. 새 모듈을 붙이는 순서

1. `lib/nav.ts` 에 항목 추가(또는 이미 있는 항목의 `children` 확장).
2. `app/(admin)/<경로>/page.tsx` 첫 줄에서 `requirePermission('<모듈>', 'read')`.
   레이아웃은 "관리자인가"까지만 본다 — 모듈 권한은 페이지가 직접 확인한다(§4).
   쓰기 컨트롤은 `hasPermission(permissions, '<모듈>', 'write')` 로 감춘다.
3. 조회는 `lib/data/<모듈>.ts`, 변경은 `lib/actions/<모듈>-actions.ts` 로 나눈다.
4. 쓰기 서버 액션 첫 줄은 **항상** `const actor = await requirePermission('<모듈>', 'write')` 다.
   서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다.
5. 상태를 바꾸는 액션은 `writeAuditLog(actor.id, …)` 를 남긴다.
   사용자 사이트에 보이는 변경이면 `revalidateClient([...])` 도 함께 부른다(§3).
6. 목록은 `components/ui/Table` + `Pagination` + `lib/utils/table-query.ts` 를 쓴다.
   정렬·페이지는 컴포넌트 상태가 아니라 **쿼리스트링**에 적는다.

## 3. 지켜야 할 규칙

- **서비스 롤은 Auth Admin API 에만.** 그 외 읽기·쓰기는 세션 클라이언트로 하고
  RLS(`public.is_admin()`)가 다시 검사하게 둔다. 서비스 롤을 일반 경로에 쓰면
  권한 버그가 조용히 통과한다.
- **role 은 화면 입력으로 정하지 않는다.** 관리자는 `/admins` 의 **이메일 초대**로만
  만들어지고, 승격의 근거는 `admin_invites` 의 pending 행 하나뿐이다(§4).
  회원 상세의 "관리자 권한 부여"는 2026-09-09 제품 결정으로 제거했다.
- **Tailwind 클래스는 리터럴로.** `bg-${tone}` 처럼 조립하면 유틸리티가 생성되지 않는다.
  토큰은 `app/globals.css` 의 `@theme` 한곳에 있다.
- **날짜는 `lib/utils/format-date.ts`.** `toLocaleString` 은 런타임 로캘에 따라
  서버·클라이언트 결과가 갈려 하이드레이션이 깨진다.
- **사용자 사이트에 보이는 쓰기 뒤에는 `revalidateClient()`.** 사용자 사이트의 공개
  목록은 `unstable_cache`(60초 · 300초)이고 관리자는 별도 배포라
  `revalidateTag()` 가 닿지 않는다. 태그는 `lib/revalidate.ts` 의
  `CLIENT_CACHE_TAGS` — 뉴스 `news-list`, 커뮤니티·댓글 `community-list`,
  FAQ `faqs`, 확률형 아이템 `gacha`, 랭킹 `rankings`, 설정·배너 `site`.
  관리자 전용 테이블(감사 로그 · 관리자 계정 · 신고 상태)에는 부르지 않는다.
  호출이 실패해도 쓰기는 성공한다 — 반영이 태그 수명만큼 늦어질 뿐이다.
- **문의 상태 뱃지는 사용자 사이트와 같은 색을 쓴다**(`info-blue` · `success-green`
  · `muted`). 관리자와 사용자가 같은 스레드를 보는 유일한 모듈이라 색이 갈리면
  운영자가 화면을 보며 상태를 설명할 수 없다. 관리자 전용 상태는 기존 팔레트 그대로.
- **랭킹 스냅샷은 관리자가 적재하지 않는다**(2026-09-09 제품 결정). 게임 데이터는
  개발팀 연동이 `rankings` 에 스냅샷 단위로 넣고, 관리자 화면은 **현재 표 확인과
  이전 스냅샷으로 되돌리기**만 한다. 그래서 `/rankings` 에는 적재 수단이 없고
  `lib/actions/rankings-actions.ts` 의 쓰기도 롤백 하나뿐이다.
- **`any` 금지, 파일 300줄 / 컴포넌트 200줄 상한.**

## 4. 인증 · 권한 체계

관리자 계정은 **이메일 초대로만** 만들어진다(2026-09-09 제품 결정). 사용자 사이트의
회원과는 무관하며, 회원을 승격하는 화면은 없앴다. 간편로그인(구글·카카오·네이버)
버튼도 없앴다 — 초대로 만든 계정의 로그인 수단은 비밀번호 하나다.

### 4.1 권한 체계

권한은 **역할(`admin_roles`) × 모듈**이다. 모듈마다 `none` · `read` · `write` 중
하나를 갖고, `write` 는 `read` 를 포함한다. 모듈 목록의 단일 출처는
`lib/auth/permissions.ts` 의 `ADMIN_MODULES` 13개다(대시보드 · 뉴스 · 커뮤니티 ·
신고 · 회원 · 1:1 문의 · FAQ · 가이드 · 랭킹 · 사이트 설정 · Legal · 관리자 · 감사 로그).

| 역할                     | 성격                        | 내용                                               |
| ------------------------ | --------------------------- | -------------------------------------------------- |
| `super_admin` 슈퍼어드민 | 시스템 역할(수정·삭제 불가) | 전체 쓰기 + 관리자 초대·삭제 + 역할 관리           |
| `editor` 콘텐츠 편집자   | 예시(삭제 가능)             | 콘텐츠 쓰기, 운영 지표 읽기, 설정·랭킹·관리자 없음 |

슈퍼어드민은 `/admins` 에서 역할을 **추가·수정·삭제**할 수 있다. `key`(영문 slug)는
만든 뒤 바꿀 수 없고, 멤버가 있는 역할과 시스템 역할은 지울 수 없다.

### 4.2 RLS 는 거친 문, 앱은 세밀한 문

| 층                                | 판정                                           |
| --------------------------------- | ---------------------------------------------- |
| `proxy.ts`                        | 로그인 여부 · 30분 비활동 만료(낙관적)         |
| `app/auth/callback/route.ts`      | 세션 확립 직후 `profiles.role` 확인            |
| `app/(admin)/layout.tsx`          | `requireAdmin()` — 관리자인가                  |
| `app/(admin)/<모듈>/**/page.tsx`  | `requirePermission(모듈, 'read')`              |
| `lib/actions/*-actions.ts` (쓰기) | `requirePermission(모듈, 'write')`             |
| `/admins` · 역할 · 초대 · 삭제    | `requireSuperAdmin()`                          |
| RLS                               | `is_admin()` 하나 — **모듈을 구분하지 않는다** |

**RLS 는 모듈별 권한을 모른다.** 정책에 역할을 녹이면 정책 수가 모듈 × 역할로
폭발하고, 역할을 하나 추가할 때마다 마이그레이션이 필요해진다. 그래서 DB 는
"관리자인가"까지만 보고, 모듈별 read/write 는 앱이 강제한다.

그 대신 **권한을 바꿀 수 있는 경로는 DB 에서 잠근다.** `is_super_admin()` 이
`admin_roles` 의 쓰기 정책과 `guard_profile_role()` 트리거에 걸려 있어,
슈퍼어드민이 아닌 계정은 REST 로 직접 불러도 `profiles.role` ·
`profiles.admin_role_id` · `admin_roles` 를 바꿀 수 없다. 시스템 역할
(`super_admin`)의 수정·삭제는 `guard_admin_roles()` 트리거가 막는다.

> 따라서 **모듈 권한만으로는 데이터가 보호되지 않는다.** 읽기 전용 역할의 계정도
> anon 키 + 자기 세션으로 REST 를 직접 부르면 관리자 테이블을 쓸 수 있다. 역할은
> "운영자가 실수로 남의 영역을 건드리지 않게 하는 경계"이고, 신뢰 경계는 여전히
> `role='admin'` 이다. 신뢰할 수 없는 사람에게는 관리자 계정을 주지 않는다.

### 4.3 초대 흐름

1. 슈퍼어드민이 `/admins` → **관리자 초대**에서 이메일과 역할을 고른다.
2. `admin_invites` 에 `pending` 행이 **먼저** 들어간다(role_id, `expires_at` = 7일).
3. 그다음 `auth.admin.inviteUserByEmail()` 이 메일을 보낸다.
   메일 발송이 곧 `auth.users` insert 이고, 그 순간 `handle_new_user()` 트리거가
   초대 행을 찾아 `role='admin'` 과 `admin_role_id` 를 넣는다. **순서가 뒤집히면
   초대받은 사람이 일반 사용자로 만들어진다.**
4. 받은 사람이 링크를 열면 `/auth/callback` → `/invite/accept` 에서 **스스로**
   비밀번호를 정하고 콘솔로 들어온다.
5. 메일 발송이 실패하면 2번 행을 `revoked` 로 되돌린다 — 메일이 안 나간 초대 행을
   남기면 그 주소로 가입하는 누구나 관리자가 된다.

이미 계정이 있는 이메일은 **조용히 승격하지 않고 거절한다**. 승격은 "초대를
수락했다"는 사실이 없는 권한 부여라, 나중에 그 사람이 어떻게 관리자가 됐는지
설명할 수 없다.

재발송은 같은 API 를 다시 부르고(Supabase 가 미확인 초대 사용자에게 새 링크를
보낸다) 허용 목록의 수명도 함께 연장한다. 취소는 `status='revoked'` 다.

### 4.4 삭제 = 비활성화

`/admins` 의 **삭제**는 계정 행을 지우지 않는다. 지우면 그 사람이 쓴 뉴스·답변의
작성자 참조가 통째로 끊긴다. 실제로 일어나는 일은 셋이다.

1. `profiles.role='user'`, `admin_role_id=null`
2. 그 이메일의 초대를 `revoked` 로 — 같은 주소로 재가입해도 다시 관리자가 되지 않는다
3. 서비스 롤로 `auth.admin.updateUserById(id, { ban_duration: '876600h' })`

3번이 없으면 role 만 내려간 계정이 이메일·비밀번호로 **로그인은 계속 성공하고**
화면에서만 튕긴다. 세 가지를 함께 해야 문이 잠긴다.

자기 자신은 삭제·역할 변경할 수 없고, **마지막 슈퍼어드민**도 내리거나 지울 수 없다.
0 이 되는 순간 권한 체계를 되돌릴 사람이 사라지고 복구에 서비스 롤 스크립트가 필요해진다.

### 4.5 첫 슈퍼어드민

초대할 사람이 없는 첫 계정은 서비스 롤 스크립트로 만든다.

```bash
ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=... pnpm --filter @maple/admin bootstrap:admin
```

스크립트가 `super_admin` 역할 id 를 읽어 초대 행에 싣고, 트리거가 권한을 주지 않으면
직접 보정한다. 로컬 개발에서는 `ADMIN_LOGIN_PREFILL_EMAIL` ·
`ADMIN_LOGIN_PREFILL_PASSWORD` 로 로그인 칸을 미리 채울 수 있다
(**운영에는 설정 금지** — 공개 로그인 HTML 에 비밀번호가 그대로 실린다).

### 4.6 메일 링크

Supabase 설정에 따라 `?code=`(PKCE) · `?token_hash=` · `#access_token=` 세 가지로
돌아온다. `app/auth/callback/` 이 셋 다 처리한다(해시는 서버로 전송되지 않으므로
`complete` 페이지가 브라우저에서 읽어 서버 액션으로 넘긴다). 어느 경로든 세션이
생기면 곧바로 `profiles.role` 을 확인하고, 관리자가 아니면 세션을 남기지 않는다.

## 5. 운영자가 해야 할 일

- Supabase Auth → URL Configuration 의 **Redirect URLs** 에 관리자 콜백
  `https://maple-admin.vercel.app/auth/callback` 과 로컬 개발용
  `http://localhost:3100/**` 을 추가한다(배포 도메인이 다르면 그 도메인으로).
  등록하지 않으면 초대·비밀번호 재설정 링크가 `redirectTo` 를 무시하고 사용자
  사이트로 간다 — 그러면 초대 수락 자체가 불가능하다.
- 배포 환경 변수 `NEXT_PUBLIC_ADMIN_URL` 을 실제 관리자 도메인으로 맞춘다.
  초대 메일의 링크가 이 값에서 만들어진다.
- **커스텀 SMTP 를 연결한다.** Supabase 기본 메일러는 시간당 발송 한도가 매우 낮아
  (프로젝트 기본값 기준 몇 통 수준) 관리자 몇 명을 연달아 초대하면 조용히 막힌다.
  초대와 비밀번호 재설정이 모두 메일에 의존하므로, 운영에서는 SMTP 연결이 선택이 아니다.
- 첫 슈퍼어드민은 §4.5 의 스크립트로 만든다. 그 뒤로는 화면에서 초대한다.
