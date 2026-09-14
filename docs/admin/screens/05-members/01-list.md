# 회원 목록 (`/members`)

**목적** 전체 회원을 검색·필터링해 상세로 이동한다. 문의·신고를 받았을 때 "이 사람이 누구인지"를 닉네임이나 이메일 한 조각으로 찾아내는 것이 이 화면의 유일한 일이다. 쓰기 조치는 여기에 없다(전부 상세에서 한다).

**데이터 출처** `getMembers(params)`(`admin/lib/data/members.ts`).
- 쿼리스트링 파싱은 순수 함수 `parseMemberListParams()`(`admin/lib/validation/member-list-params.ts`) 가 맡는다 — 허용 목록 밖의 값은 **조용히 "전체"로 떨어진다**(`?status=` 조작으로 필터를 무력화할 수 없다).
- `supabase.from('profiles').select(PROFILE_COLUMNS, { count: 'exact' })` 를 세션 클라이언트로 읽는다(RLS `profiles_select_admin`).
- 페이지 크기 `DEFAULT_PAGE_SIZE = 20`, 기본 정렬 `created_at:desc`(`MEMBER_DEFAULT_SORT`).
- 활동 수치는 페이지 단위로 한 번에 센다(`countActivity()`, `admin/lib/data/member-activity.ts`).
- 조회 실패 시 `hasError=true` → 표 위에 `FormBanner`(`LIST_LOAD_ERROR`: "목록을 불러오지 못했습니다. 표가 비어 보이는 것은 데이터가 없어서가 아닙니다. 새로고침해 주세요.")를 세우고 표는 빈 상태로 남는다.

## 1.1 페이지 헤더

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 회원 | 제목 | — | 고정 | — |
| 설명 | 텍스트 | — | `총 {count}명. 닉네임을 눌러 상세로 이동합니다.` | `count` 는 필터가 적용된 `count: 'exact'` 값(`toLocaleString('ko-KR')`) |

## 1.2 필터 폼 (`MemberFilters`, `method="get"`)

GET 폼이라 결과가 그대로 주소에 남는다(새로고침·뒤로가기·링크 공유가 같은 화면을 낸다).

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 검색 | 텍스트 입력 `name="q"` | 최대 60자(`SEARCH_MAX_LENGTH`, `maxLength` + 서버 `clamp()` 재절단). 트림 후 빈 값이면 `null` | 현재 `?q=` | 닉네임·이메일 동시 검색(아래) |
| 상태 | 셀렉트 `name="status"` | `MEMBER_STATUS_FILTERS` = `normal`·`suspended`·`withdrawn`·`purged`·`admin` 만. 그 밖은 `null`(전체) | 플레이스홀더 "전체" | 라벨: 정상 / 정지 / 탈퇴 대기 / 삭제됨 / 관리자. 질의 조건은 §상태·뱃지 참고 |
| 가입 방식 | 셀렉트 `name="provider"` | `MEMBER_PROVIDERS` = `kakao`·`google`·`naver`·`email` 만 | 플레이스홀더 "전체" | 라벨·`email` 조건(아래) |
| 가입 시작일 | `type="date"` `name="from"` | 형식은 브라우저가 강제. 파싱 실패면 조건을 걸지 않는다 | 현재 `?from=` | `kstDayBoundary(from)` → `created_at >= YYYY-MM-DDT00:00:00+09:00` |
| 가입 종료일 | `type="date"` `name="to"` | 위와 같음 | 현재 `?to=` | `kstDayBoundary(to, 1)` → `created_at < 다음 날 0시(KST)`. 종료일 **당일까지 포함**된다 |
| 검색 | submit 버튼 | — | — | 폼을 `/members` 로 GET 제출. `page` 는 폼에 없으므로 1페이지로 돌아간다 |
| 초기화 | 링크 버튼 | — | — | `href={pathname}` — 검색어·상태·가입 방식·기간·정렬·`msw` 를 **전부** 버린다 |
| 정렬 유지 | hidden `name="sort"` | — | 현재 `?sort=` | 검색해도 보고 있던 정렬이 유지된다 |
| 월드 계정 좁히기 | hidden `name="msw"` | 최대 60자, 트림 후 빈 값이면 `null` | 현재 `?msw=` | 노출 조건·활성화 경로(아래) |
| 좁힘 안내 + 해제 | 문구 + 링크 | `?msw=` 가 있을 때만 렌더 | — | 안내 문구·해제 링크(아래) |

**동작 상세**
- **검색** — `nickname.ilike` 와 `email.ilike` 를 **동시에** 훑는다. `%`·`_`·`\` 는 `containsPattern()` 이 이스케이프하고, 값은 따옴표로 감싸 콤마가 `or()` 문법을 깨지 않게 한다. 라벨에 `현재/최대` 글자 수 표시.
- **가입 방식** — 라벨: 카카오 / 구글 / 네이버 / 이메일. `email` 만 `or('provider.is.null,provider.eq.email')` — 트리거가 `provider` 를 채우지 못한 옛 계정까지 포함한다.
- **월드 계정 좁히기** — 폼에 노출되지 않는다. 상세의 "중복 검색" 링크(`/members?msw=…`)로만 켜진다. hidden 이 없으면 검색 한 번에 조건이 조용히 넓어진다.
- **좁힘 안내 + 해제** — `월드 계정 {값}(으)로 좁혔습니다. 값이 정확히 같은 회원만 보입니다.` + "해제" 링크(`buildHref(…, { msw: null, page: null })`).

`msw` 조건은 **정확 일치**다: `msw_uid.eq."값"` 또는 `msw_profile_code.ilike."값"`(대소문자 무시). UID 는 10~20자리 숫자라 부분 일치로 훑으면 무관한 계정이 딸려 와 중복 점검의 답이 흐려진다.

## 1.3 표 (`Table`, 서버 컴포넌트)

정렬은 헤더의 `<Link>` 가 `?sort=<key>:asc|desc` 를 다시 쓴다. 같은 키를 누르면 방향이 뒤집히고(`desc → asc`), 다른 키면 `desc` 로 시작하며 **항상 1페이지로 돌아간다**(`sortHref()`).

| 열 | 값의 출처 | 정렬 | 동작 / 상호작용 |
|---|---|---|---|
| 닉네임 | `profiles.nickname` + `provider` | `nickname` | `MemberIdentity` 구성(아래) |
| 이메일 | `profiles.email` | 없음 | `MaskedEmail` 마스킹 규칙(아래) |
| 가입일 | `profiles.created_at` | `created_at` (기본) | `formatDate()` — `2026-09-08` |
| 글 | `posts` 중 `board='community'` · `author_id` | 없음 | 우측 정렬. `countActivity()` 의 페이지 단위 집계 |
| 댓글 | `comments.author_id` | 없음 | 우측 정렬 |
| 신고당함 | `reports.target_id` → 작성자 역추적 | 없음 | 우측 정렬. **0 초과면 빨간 굵은 글씨**(`text-danger font-bold`) |
| 상태 | `role` · `suspended_until` · `deleted_at` · `purged_at` | 없음 | `MemberStatusBadges` + 탈퇴 대기 행에만 둘째 줄로 `파기 예정 {날짜}`(`purgeDueAt()`) |

- 빈 목록 문구: "조건에 맞는 회원이 없습니다."
- 표 caption(스크린 리더): "회원 목록".

**동작 상세**
- **닉네임** — `MemberIdentity` — 첫 글자 아바타(원격 이미지를 요청하지 않는다. 소셜 CDN 이 `next.config.ts` remotePatterns 에 없어 400 이 난다) + 상세 링크 + 공급자 마크(`providerLabel()`; 카카오 warn·네이버 success·그 외 중립).
- **이메일** — `MaskedEmail` — `maskEmail()` 로 로컬 파트 앞 2글자만 남긴다(`ab****@example.com`). 도메인은 남긴다(공급자 구분이 운영 판단에 쓰인다). 원문은 `title` 속성에만 있다. 값이 없으면(파기된 계정) `-`.

## 1.4 페이지네이션

| 컨트롤 | 종류 | 동작 |
|---|---|---|
| 페이지 이동 | `Pagination` 링크 | `totalPages(count, 20)` 만큼(아래) |
| `?page=` | URL 파라미터 | `parsePage()` 로 1 이상의 정수로 좁힌다. 숫자가 아니거나 0 이하면 1 |

**동작 상세**
- **페이지 이동** — `totalPages(count, 20)` 만큼. `buildHref('/members', searchParams, { page })` — 현재 필터·정렬을 그대로 들고 간다.

## 상태·뱃지 의미

| 값 | 라벨 | 색(`BadgeTone`) | 언제 붙는지 |
|---|---|---|---|
| `purged` | 삭제됨 | muted | `purged_at` 이 있다. 다른 뱃지를 겹치지 않는다(아래) |
| `withdrawn` | 탈퇴 대기 D-nn | warn | `deleted_at` 이 있고 `purged_at` 은 없다(아래) |
| `admin` | 관리자 | accent | `role='admin'`. 정지보다 **먼저** 본다(아래) |
| `suspended` | 정지 ~YYYY-MM-DD / 정지 영구 | danger | `suspended_until > now()`. `isPermanentSuspension()`(UTC 연도 ≥ 9999)이면 "영구" |
| `normal` | 정상 | success | 위 어디에도 해당하지 않을 때 |

- **`purged`** — **다른 뱃지를 겹치지 않는다** — 제재는 이미 비워졌고 로그인 계정도 없어, 남은 제재처럼 보이면 운영자가 해제할 수 있다고 오해한다.
- **`withdrawn`** — `daysUntilPurge()` 는 올림·최소 0. 정지 중이면 **둘째 뱃지**로 정지가 덧붙는다(탈퇴해도 제재는 유지된다는 사실이 목록에서 보여야 한다).
- **`admin`** — 관리자는 `is_suspended()` 검사를 받는 쓰기 경로가 없어 정지가 실효를 갖지 않는다.

필터의 상태 값과 뱃지는 **같은 것이 아니다**. 뱃지는 한 회원을 하나로 좁히지만, 필터는 서로 배타적이지 않다.

| 필터 | 질의 조건 |
|---|---|
| 정상 | `role='user'` and `deleted_at is null` and (`suspended_until is null` or `suspended_until <= now`) |
| 정지 | `suspended_until > now` (탈퇴 대기·파기 여부를 묻지 않는다) |
| 탈퇴 대기 | `deleted_at is not null` and `purged_at is null` |
| 삭제됨 | `purged_at is not null` |
| 관리자 | `role='admin'` |

"탈퇴 대기이면서 정지"인 회원은 두 필터 양쪽에서 모두 나온다. **정상만은** 탈퇴·파기·관리자를 반드시 제외한다 — 그 칸이 넓어지면 이미 나간 회원이 정상 명단에 섞인다.

## 클라이언트와의 상호작용

- 사용자 사이트에 이 목록에 대응하는 화면은 없다(관리자 전용). `profiles` 는 일반 사용자에게 `profiles_select_self`(본인 행)만 열려 있다.
- 여기서 보이는 값은 사용자 사이트의 마이페이지(`/account`)·온보딩이 채운 것이다: 닉네임(`updateNicknameAction`), 월드 계정(`/account/link` → `updateMswLinkAction`), 마케팅 동의(`updateMarketingConsentAction`), 동의 시각 3칸(온보딩).
- 이 화면은 사용자 사이트 캐시를 태우지 않는다(읽기 전용).

## 오류·예외

- 조회 실패: `console.error('[members] 목록 조회 실패', …)` 후 `rows: []`·`hasError: true`. 화면은 배너로 "빈 표 = 데이터 없음"이라는 오독을 막는다.
- 활동 수치(글·댓글·신고당함)는 페이지 단위 집계라 PostgREST 응답 상한(1000행)을 넘으면 **잘릴 수 있다**. 정확한 값은 상세가 `count: 'exact'` 로 다시 센다 — 목록과 상세 숫자가 다르면 이것이 원인이다.
- 신고 집계는 게시글·댓글 id 를 200개씩(`IN_CHUNK`) 끊어 보낸다(URL 길이 제한).
- 이메일이 `@` 를 갖지 않으면 `maskEmail()` 이 통째로 `*` 로 덮는다(형식을 신뢰하고 자르면 원문이 남는다).
