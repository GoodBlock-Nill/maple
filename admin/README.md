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
로그인 방식 스위치 두 개(`SOCIAL_LOGIN_MODE` · `ADMIN_PASSWORD_LOGIN`)는 §4 에 있다.

---

## 1. 디렉터리

```
admin/
  app/
    (auth)/        로그인 · 비밀번호 재설정                 (사이드바 없음)
    (admin)/       인증된 관리 화면 전부                  (layout 이 requireAdmin())
    auth/callback/ 간편로그인·재설정 링크 착지점(role 게이트)
  components/
    ui/            공용 프리미티브 (Button · Table · Dialog · Toast …)
    layout/        AdminShell · Sidebar · Topbar · ComingSoon
    <모듈>/        모듈 전용 컴포넌트 (admins/, dashboard/, …)
  lib/
    nav.ts         사이드바 정보 구조 — 화면을 추가하면 여기 한 줄
    revalidate.ts  사용자 사이트 캐시 무효화(revalidateClient) — 아래 §3
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
   사용자 사이트에 보이는 변경이면 `revalidateClient([...])` 도 함께 부른다(§3).
6. 목록은 `components/ui/Table` + `Pagination` + `lib/utils/table-query.ts` 를 쓴다.
   정렬·페이지는 컴포넌트 상태가 아니라 **쿼리스트링**에 적는다.

## 3. 지켜야 할 규칙

- **서비스 롤은 Auth Admin API 에만.** 그 외 읽기·쓰기는 세션 클라이언트로 하고
  RLS(`public.is_admin()`)가 다시 검사하게 둔다. 서비스 롤을 일반 경로에 쓰면
  권한 버그가 조용히 통과한다.
- **role 은 화면 입력으로 정하지 않는다.** 관리자 승격은 회원 상세의
  `changeMemberRoleAction` 한 곳에서만 하고, `admin_invites` 에 accepted 행을 근거로 남긴다.
  이메일 초대 흐름은 2026-09-09 제품 결정으로 제거했다(테이블·트리거는 유지).
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

## 4. 인증 흐름

관리자 계정은 **이메일 초대로 만들지 않는다**(2026-09-09 제품 결정). 사용자
사이트에 간편로그인(구글·카카오·네이버)으로 가입한 회원을 회원 상세의
`changeMemberRoleAction` 으로 승격시킨 것이 관리자다. 그래서 관리자 로그인도
같은 간편로그인이고, 문턱은 "로그인에 성공했는가"가 아니라 **`profiles.role`
이 `admin` 인가**다.

| 경로                         | 하는 일                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `proxy.ts`                   | 토큰 갱신 · 미로그인 리다이렉트 · 30분 비활동 만료(낙관적 검사)       |
| `app/auth/callback/route.ts` | 세션 확립 직후 role 확인 — 아니면 로그아웃 + `/login?error=not_admin` |
| `app/(admin)/layout.tsx`     | `requireAdmin()` — role 이 아니면 로그아웃 + `/login?error=not_admin` |
| RLS                          | 최종 방어선. 화면을 우회해도 데이터는 열리지 않는다                   |

로그인 화면의 수단은 환경 변수 두 개로 바뀐다.

| 변수                                                         | 값                        | 뜻                                                                                                                                |
| ------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SOCIAL_LOGIN_MODE`                                          | `stub`(기본) · `oauth`    | `stub` 은 간편로그인 버튼이 안내만 돌려준다. `oauth` 는 실제 연동                                                                 |
| `ADMIN_PASSWORD_LOGIN`                                       | 미설정(기본) · `disabled` | `disabled` 면 "운영 계정 로그인(이메일)" 섹션을 그리지 않는다                                                                     |
| `ADMIN_LOGIN_PREFILL_EMAIL` · `ADMIN_LOGIN_PREFILL_PASSWORD` | 미설정(기본)              | 로컬 개발 편의. 값이 있으면 이메일 섹션을 펼치고 칸을 미리 채운다. **운영에는 설정 금지** — 공개 로그인 HTML 에 비밀번호가 실린다 |

**관리자 앱에는 스텁 로그인이 없다.** 사용자 사이트의 스텁은 없는 계정을 즉시
만들어 주는데, 같은 것을 관리자에 두면 아무나 관리자 후보 계정을 찍어낼 수 있다.
그래서 `stub` 동안 실제로 들어오는 문은 접혀 있는 이메일 로그인 하나뿐이고,
부트스트랩 관리자(`scripts/bootstrap-admin.mjs`)가 그 문을 쓴다. 실 OAuth 로
전환이 끝나면 `SOCIAL_LOGIN_MODE=oauth` 로 열고 `ADMIN_PASSWORD_LOGIN=disabled`
로 닫는다.

네이버는 Supabase 의 기본 제공자 목록에 없어 `oauth` 모드에서도 버튼을 누르면
안내만 나온다(§5). 흉내 낸 스텁을 붙이지 않은 이유는, 실 연동 시점에 "이미
동작하는 것처럼 보이는 코드"가 어디까지 가짜인지 되짚기 어렵기 때문이다.

메일 링크는 Supabase 설정에 따라 `?code=`(PKCE) · `?token_hash=` · `#access_token=`
세 가지로 돌아온다. `app/auth/callback/` 이 셋 다 처리한다(해시는 서버로 전송되지
않으므로 `complete` 페이지가 브라우저에서 읽어 서버 액션으로 넘긴다). OAuth 도
`?code=` 로 같은 착지점에 돌아온다.

## 5. 운영자가 해야 할 일

- Supabase Auth → **Providers** 에서 Google · Kakao 를 켜고 각 콘솔에서 받은
  Client ID / Client Secret 을 넣는다. 각 제공자 콘솔의 승인 리다이렉트 URI 에는
  Supabase 가 보여 주는 콜백(`https://<project-ref>.supabase.co/auth/v1/callback`)을
  등록한다.
- Supabase Auth → URL Configuration 의 **Redirect URLs** 에 관리자 콜백
  `https://maple-admin.vercel.app/auth/callback` 과 로컬 개발용
  `http://localhost:3100/**` 을 추가한다(배포 도메인이 다르면 그 도메인으로).
  등록하지 않으면 간편로그인·비밀번호 재설정 링크가 `redirectTo` 를 무시하고
  사용자 사이트로 간다.
- 위 두 가지가 끝나면 관리자 배포 환경 변수에 `SOCIAL_LOGIN_MODE=oauth` 를 넣는다.
  넣기 전까지 간편로그인 버튼은 안내만 돌려준다(§4).
- **네이버는 개발팀 작업 대기 중이다.** Supabase 기본 제공자에 없어서 별도 연동
  (커스텀 OAuth 또는 프록시)이 필요하다. 연동 전까지 네이버 버튼은 눌러도
  "개발팀 OAuth 연동 후 사용할 수 있습니다" 안내만 나온다.
- Supabase 기본 메일러는 **시간당 발송 한도가 매우 낮다**. 비밀번호 재설정 메일을
  실제로 운영하려면 커스텀 SMTP 를 연결해야 한다.
