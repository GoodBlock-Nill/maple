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
Supabase 값 3개를 그대로 쓰고, 여기에 `NEXT_PUBLIC_CLIENT_SITE_URL` ·
`NEXT_PUBLIC_ADMIN_URL` 을 더한다.

---

## 1. 디렉터리

```
admin/
  app/
    (auth)/        로그인 · 비밀번호 재설정 · 초대 수락   (사이드바 없음)
    (admin)/       인증된 관리 화면 전부                  (layout 이 requireAdmin())
    auth/callback/ 초대·재설정 메일 링크 착지점
  components/
    ui/            공용 프리미티브 (Button · Table · Dialog · Toast …)
    layout/        AdminShell · Sidebar · Topbar · ComingSoon
    <모듈>/        모듈 전용 컴포넌트 (admins/, dashboard/, …)
  lib/
    nav.ts         사이드바 정보 구조 — 화면을 추가하면 여기 한 줄
    supabase/      server · middleware · admin(서비스 롤) 클라이언트
    auth/          requireAdmin() · 30분 비활동 세션
    actions/       서버 액션 (+ FormState 계약)
    data/          읽기 전용 조회
    utils/         cn · 날짜 · 목록 URL 상태
    audit.ts       writeAuditLog()
  scripts/         bootstrap-admin.mjs (첫 관리자)
  proxy.ts         Next 16 의 구 middleware — 세션 갱신 · 로그인 게이트 · 30분 만료
```

## 2. 새 모듈을 붙이는 순서

1. `lib/nav.ts` 에 항목 추가(또는 이미 있는 항목의 `children` 확장).
2. `app/(admin)/<경로>/page.tsx` 에서 `ComingSoon` 을 실제 화면으로 교체.
   레이아웃이 이미 인가를 마쳤으므로 페이지에서 다시 막을 필요는 없다.
3. 조회는 `lib/data/<모듈>.ts`, 변경은 `lib/actions/<모듈>-actions.ts` 로 나눈다.
4. 서버 액션 첫 줄은 **항상** `const actor = await requireAdmin()` 이다.
   서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다.
5. 상태를 바꾸는 액션은 `writeAuditLog(actor.id, …)` 를 남긴다.
6. 목록은 `components/ui/Table` + `Pagination` + `lib/utils/table-query.ts` 를 쓴다.
   정렬·페이지는 컴포넌트 상태가 아니라 **쿼리스트링**에 적는다.

## 3. 지켜야 할 규칙

- **서비스 롤은 Auth Admin API 에만.** 그 외 읽기·쓰기는 세션 클라이언트로 하고
  RLS(`public.is_admin()`)가 다시 검사하게 둔다. 서비스 롤을 일반 경로에 쓰면
  권한 버그가 조용히 통과한다.
- **role 은 화면 입력으로 정하지 않는다.** 관리자 승격의 유일한 근거는
  `admin_invites` 의 pending 행이다(`supabase/README.md` §6.2).
- **Tailwind 클래스는 리터럴로.** `bg-${tone}` 처럼 조립하면 유틸리티가 생성되지 않는다.
  토큰은 `app/globals.css` 의 `@theme` 한곳에 있다.
- **날짜는 `lib/utils/format-date.ts`.** `toLocaleString` 은 런타임 로캘에 따라
  서버·클라이언트 결과가 갈려 하이드레이션이 깨진다.
- **`any` 금지, 파일 300줄 / 컴포넌트 200줄 상한.**

## 4. 인증 흐름

| 경로                       | 하는 일                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `proxy.ts`                 | 토큰 갱신 · 미로그인 리다이렉트 · 30분 비활동 만료(낙관적 검사) |
| `app/(admin)/layout.tsx`   | `requireAdmin()` — role 이 아니면 로그아웃 + `/login?error=not_admin` |
| RLS                        | 최종 방어선. 화면을 우회해도 데이터는 열리지 않는다            |

메일 링크는 Supabase 설정에 따라 `?code=`(PKCE) · `?token_hash=` · `#access_token=`
세 가지로 돌아온다. `app/auth/callback/` 이 셋 다 처리한다(해시는 서버로 전송되지
않으므로 `complete` 페이지가 브라우저에서 읽어 서버 액션으로 넘긴다).

## 5. 운영자가 해야 할 일

- Supabase Auth → URL Configuration 의 **Redirect URLs** 에 관리자 도메인
  (`http://localhost:3100/**`, 배포 후 `https://<admin-domain>/**`)을 추가한다.
  등록하지 않으면 초대·재설정 링크가 `redirectTo` 를 무시하고 사용자 사이트로 간다.
- Supabase 기본 메일러는 **시간당 발송 한도가 매우 낮다**. 관리자 초대를 실제로
  운영하려면 커스텀 SMTP 를 연결해야 한다.
