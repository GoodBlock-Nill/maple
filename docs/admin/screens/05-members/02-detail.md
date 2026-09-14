# 회원 상세 (`/members/[id]`)

**목적** 한 회원의 프로필 · 생애주기 상태 · 활동을 한 화면에서 확인하고, 제재(정지)·닉네임 강제 변경·탈퇴·파기를 적용한다. 운영자가 DB 콘솔을 열지 않아도 문의를 처리할 수 있게 **컬럼을 숨기지 않고 전부 보여 주는 것**이 설계 의도다(DB 콘솔을 여는 순간 감사 로그가 남지 않는 경로가 생긴다).

**데이터 출처**
- `getMember(id)`(`admin/lib/data/members.ts`) — `profiles` 단건. `null` 이면 `notFound()`(404).
- `getMemberActivity(id)` — 게시글·댓글은 최근 `ACTIVITY_LIMIT = 20`건 + `count: 'exact'`, 문의는 `head: true` 집계(`cancelled_at is null`), 접수한 신고는 `reporter_id` 집계, 받은 신고는 `countActivity()`.
- 탭에 따라서만 추가 조회한다: `getReportsFor()`(신고 탭) · `getMemberInquiries()`(문의 탭). 게시글 탭 한 번에 쓰지도 않는 질의를 붙이지 않기 위해서다.
- `?tab=` 은 `ACTIVITY_TABS` 허용 목록 밖이면 `posts` 로 떨어진다.
- `dynamic = 'force-dynamic'`.

## 2.1 페이지 헤더

| 필드/컨트롤 | 종류 | 필수·제한 | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | 텍스트 | — | `member.nickname` 원문 | 파기 계정 제목 규칙(아래) |
| 설명 | 텍스트 | — | 권한별 문구(아래) | 권한 상태를 문장으로 알린다 |
| 목록으로 | 링크 버튼(secondary·sm) | — | — | `/members` 로 이동. **필터·정렬은 보존되지 않는다**(고정 링크) |

**동작 상세**
- **제목** — 파기된 계정은 `탈퇴한 회원#{id앞8자}` 가 그대로 제목이 된다(고정 문구로 뭉개지 않는다 — 여러 파기 계정을 구분해야 한다).
- **설명** — write 권한 → "회원 정보와 활동을 확인하고 제재를 적용합니다." / 없으면 "회원 정보와 활동을 확인합니다(읽기 전용)."

## 2.2 탈퇴 · 파기 카드 (`MemberLifecycleCard`)

생애주기가 `active` 면 **아예 렌더되지 않는다**(값이 전부 `-` 인 카드가 늘 붙어 있으면 실제 탈퇴 회원의 카드가 눈에 띄지 않는다). 프로필 카드보다 **위**에 온다.

| 필드 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 카드 제목 | 텍스트 | `memberLifecycle()` | `purged` → "개인정보 파기됨" / `withdrawn` → "탈퇴 대기" |
| 카드 설명 | 텍스트 | 위와 같음 | `purged`/`withdrawn` 문구(아래) |
| 탈퇴일 | 읽기 전용 | `profiles.deleted_at` | `formatDateTime()` |
| 파기 예정일 | 읽기 전용 | `purgeDueAt(deleted_at)` = 탈퇴일 + 90일 | 표시 형태(아래) |
| 파기일 | 읽기 전용 | `profiles.purged_at` | `formatDateTime()`. 파기 전이면 `-` |

**동작 상세**
- **카드 설명** — `purged` → "개인정보가 파기된 계정입니다. 작성 글·댓글은 남아 있습니다." / `withdrawn` → "탈퇴일로부터 90일 동안 개인정보를 보존합니다. 그 안에 본인이 다시 로그인하면 복구되고, 진행 중인 이용 제한은 그대로 적용됩니다."
- **파기 예정일** — 탈퇴 대기면 `2026-12-08 (D-45)` 형태 + **danger 톤**. 이미 파기됐으면 날짜만(남은 일수는 뜻이 없다).

**복구 이력 칸은 없다.** 복구는 `deleted_at` 을 다시 비우는 것이라 별도 기록이 남지 않는다 — 빈 칸을 두면 "복구한 적 없음"으로 읽히므로 감사 로그 `member.restore` 로 확인한다.

## 2.3 프로필 카드 헤더 (`MemberProfileCard`)

| 필드/컨트롤 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 아바타 + 닉네임 + 공급자 마크 | `MemberIdentity` | `nickname`·`provider` | 목록과 같은 컴포넌트(링크 없음) |
| 상태 뱃지 | `MemberStatusBadges` | `role`·`suspended_until`·`deleted_at`·`purged_at` | 목록과 같은 규칙([01-list.md](01-list.md) §상태·뱃지) |
| 마스킹 이메일 | 텍스트 | `maskEmail(email)` | **파기된 계정에는 그리지 않는다**. 원문은 `title` 속성 |
| 조치 버튼 영역 | `MemberActions` | write 권한자만 | §2.6 |

## 2.4 프로필 카드 본문 — 필드 15칸

2~3열 그리드(`sm:grid-cols-2 lg:grid-cols-3`). **파기된 계정(`purged_at` not null)은 개인정보 칸을 아예 그리지 않는다** — 빈 칸을 남기면 "조회에 실패했나"로 읽히고, 값이 남아 있다면 파기의 취지에 어긋난다.

| 필드 | 종류 | 값의 출처 · 제한(DB) | 파기 시 | 동작 / 상호작용 |
|---|---|---|---|---|
| 회원 ID | 읽기 전용(모노스페이스) | `profiles.id`(uuid, `auth.users.id` 와 같은 값이지만 FK 는 없다 — `20260909000400` §3) | 남는다 | 문의·감사 로그 대조의 기준 키 |
| 이름 | 읽기 전용 | `profiles.name`(선택, DB `profiles_name_length` ≤ 20자) | **숨김** | 본인이 마이페이지에서 적는 실명. 콘솔에서 바꿀 수 없다. 값이 없으면 `-` |
| 가입일 | 읽기 전용 | `profiles.created_at` | 남는다 | `formatDateTime()` |
| 최근 수정 | 읽기 전용 | `profiles.updated_at` | 남는다 | `set_updated_at()` 트리거가 갱신 |
| 가입 방식 | 읽기 전용 | `profiles.provider`(null 이면 문자열 `email` 로 표시) | 남는다 | 라벨이 아니라 **원시 값**을 그대로 적는다(헤더의 공급자 마크는 라벨을 쓴다) |
| 공급자 ID | 읽기 전용(모노스페이스) | `profiles.provider_id` | **숨김** | 간편로그인 식별자. 없으면 `-` |
| 권한 | 읽기 전용 | `profiles.role` | 남는다 | `admin` → "관리자", 그 외 → "일반 사용자". **여기서 바꿀 수 없다** |
| MSW UID | 읽기 전용(모노스페이스) + 링크 | `profiles.msw_uid`. DB `profiles_msw_uid_check` = `^[0-9]{10,20}$`, 부분 유니크 인덱스 `profiles_msw_uid_key` | **숨김** | 값이 있으면 옆에 "중복 검색" 링크 → `/members?msw={값}`. 없으면 `-` |
| MSW 프로필 코드 | 읽기 전용(모노스페이스) + 링크 | `profiles.msw_profile_code`(아래) | **숨김** | 같은 "중복 검색" 링크(아래) |
| 마케팅 수신거부 | 읽기 전용 | `profiles.marketing_sms_opt_out` · `marketing_email_opt_out`(둘 다 `not null default false`) | **숨김** | 표시 규칙(아래) |
| 이용약관 동의 | 읽기 전용 | `profiles.terms_agreed_at` | 남는다 | `formatDateTime()`. 온보딩이 채운다 |
| 개인정보 동의 | 읽기 전용 | `profiles.privacy_agreed_at` | 남는다 | 위와 같음 |
| 만 14세 확인 | 읽기 전용 | `profiles.age_confirmed_at` | 남는다 | 위와 같음 |
| 정지 종료 | 읽기 전용 | `profiles.suspended_until` | 남는다(파기 시 값 자체가 `null` 로 지워짐) | 표시 규칙(아래) |
| 정지 사유 | 읽기 전용(2열 차지) | `profiles.suspension_reason` | 남는다(파기 시 `null`) | 표시 규칙·노출 대상(아래) |

**동작 상세**
- **MSW 프로필 코드(값의 출처)** — DB `profiles_msw_profile_code_check` = `^#[a-z0-9]{4,10}$`, `profiles_msw_profile_code_key`(`lower()`).
- **MSW 프로필 코드(동작)** — 같은 "중복 검색" 링크. 유니크 인덱스가 붙기 전(2026-09-09)에 들어온 과거 중복을 확인하는 용도.
- **마케팅 수신거부** — 둘 다 `false` → "없음 (SMS · 이메일 모두 수신)", 아니면 `SMS · 이메일` 중 켜진 것만. `-` 를 쓰지 않는 이유: "설정한 적 없음"과 "수신 동의"가 같은 모양이 되면 분쟁이 난다. 바꾸는 주체는 본인뿐.
- **정지 종료** — `null` → `-`, 영구(`>= 9999년`) → "영구", 그 외 `formatDateTime()`. 정지 중이면 **danger 톤**.
- **정지 사유** — 없으면 `-`. 정지 중이면 danger 톤. **사용자에게 그대로 노출되는 문구다**(마이그레이션 `20260908001700` 컬럼 주석).

## 2.5 지표 카드 5개 (`StatCard`)

`countActivity()` 가 아니라 `count: 'exact'` 로 다시 센 정확한 값이다.

| 카드 | 값의 출처 | 톤 |
|---|---|---|
| 게시글 | `posts` `board='community'` · `author_id` 의 `count` | default |
| 댓글 | `comments.author_id` 의 `count` | default |
| 접수한 신고 | `reports.reporter_id` 의 `count`(`head: true`) | default |
| 받은 신고 | `countActivity().reported` — 게시글·댓글 id 를 신고 대상으로 역추적 | **0 초과면 danger** |
| 홈페이지 문의 | `inquiries.user_id` and `cancelled_at is null` 의 `count` | default |

- **취소된 문의(`cancelled_at` not null)는 지표·탭·목록 어디에서도 제외**된다(사용자·관리자 문의 목록과 같은 규칙).
- 지표 카드는 `members:read` 만으로 보인다 — 홈페이지 문의 **건수**는 나오지만 목록은 `inquiries:read` 가 있어야 한다.

## 2.6 조치 버튼 모음 (`MemberActions`, write 권한자만)

`lifecycle === 'purged'` 면 컴포넌트 자체가 `null` 을 반환한다(걸 조치가 없다 — 로그인 계정이 사라졌고 제재도 이미 비워져 있다).

| 버튼 | 노출 조건 | 라벨 | 여는 화면 |
|---|---|---|---|
| 정지 / 정지 기간 변경 | 항상(파기 제외) | 정지 중이면 "정지 기간 변경", 아니면 "정지" | `MemberSuspendDialog` → [03-suspend-dialog.md](03-suspend-dialog.md) |
| 정지 해제 | `isSuspended(suspendedUntil)` 일 때만 | "정지 해제" / 진행 중 "해제 중…" | 다이얼로그 없이 즉시 폼 제출(`unsuspendMemberAction`) |
| 닉네임 변경 | 항상(파기 제외) | "닉네임 변경" | `MemberNicknameDialog` → [06-nickname-dialog.md](06-nickname-dialog.md) |
| 강제 탈퇴 | `lifecycle === 'active'` **and** 본인이 아닐 때 | "강제 탈퇴" | `MemberForceWithdrawDialog` → [04-withdrawal.md](04-withdrawal.md) |
| 개인정보 즉시 파기 | `lifecycle === 'withdrawn'` **and** `actor.isSuperAdmin` **and** 본인이 아닐 때 | "개인정보 즉시 파기" | `MemberPurgeDialog` → [04-withdrawal.md](04-withdrawal.md) |

탈퇴 대기 중에도 제재를 걸고 풀 수 있다 — 복구되면 그 제재가 다시 적용되므로, 여기서 감추면 "탈퇴하면 제재를 못 건다"는 빈틈이 생긴다.

## 2.7 활동 패널

탭 내비게이션과 각 탭의 표는 [05-activity-tabs.md](05-activity-tabs.md) 참고.

## 클라이언트와의 상호작용

- 이 화면의 값은 대부분 사용자 사이트가 **쓴 것**이다: 닉네임·이메일(`/account` 계정 관리 카드), 마케팅 수신거부(`/account` 마케팅 수신 설정), MSW UID·프로필 코드(`/account/link`), 동의 시각 3칸(`/auth/onboarding`).
- 반대로 이 화면이 바꾼 값은 사용자 세션이 **다음 요청 때** 읽는다(`getCurrentUser()` 가 `profiles` 를 세션마다 직접 조회한다). 캐시 태그가 없으므로 별도 재검증이 필요 없다.
- 홈페이지 문의 탭 ↔ `/inquiries`: 같은 문의를 관리자 문의 상세(`/inquiries/[id]`)에서도 연다.

## 오류·예외

- 존재하지 않는 id, uuid 가 아닌 id → `getMember()` 가 `null` → `notFound()`(404).
- `getMemberActivity()` 는 실패해도 배너가 없다 — 집계가 깨지면 0 으로 보인다(목록과 달리 `hasError` 를 두지 않는다).
- 홈페이지 문의 목록만 `hasError` 를 갖고 배너(`LIST_LOAD_ERROR`)를 띄운다.
- `inquiries:read` 가 없으면 문의 목록 **조회 자체를 건너뛴다**. RLS 를 믿고 그냥 읽으면 빈 표(0건)와 "권한 없음"을 구분할 수 없어, 권한 없는 운영자에게 "문의가 없다"로 잘못 보인다.
