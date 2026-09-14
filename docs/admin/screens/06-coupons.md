# 쿠폰 — 화면·기능 설명

> 관리자 콘솔(`admin/`)의 쿠폰 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/coupons` (하위: `/coupons/[id]`) |
| 권한 모듈 | `coupons` — read / write (`admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `coupons`, `coupon_redemptions` |
| 클라이언트 영향 | 캐시 태그 없음. `coupons` 는 일반 사용자 select 정책이 없어 사용자 사이트가 목록을 직접 못 읽고, 마이페이지는 세션마다 RPC 로 직접 조회한다 |
| 관련 파일 | `admin/app/(admin)/coupons/{page,[id]/page}.tsx`, `admin/components/coupons/*`, `admin/lib/{actions,data,validation}/coupon*.ts`, 클라이언트 `lib/data/coupons.ts`, `lib/actions/coupon-actions.ts` |

## 1. 쿠폰 목록 (`/coupons`)

**목적** 쿠폰 코드를 만들고 상태를 확인해 상세로 이동한다. 실제 지급은 게임 안에서 이뤄지므로 이 화면은 코드 발급과 등록 신청 집계까지만 다룬다.

**화면 구성**
- 상태 탭(링크, 건수 표시 안 함): 전체 / 활성 / 시작 전 / 기간 만료 / 비활성.
- 검색 폼(GET): 쿠폰 코드 · 이름.
- 표 열: 코드(모노스페이스, 상세 링크), 이름, 기간(`CouponPeriod`), 사용(`used / 한도`, 한도 도달 시 강조, 무제한이면 "무제한" 표기), 상태 뱃지, 생성일. 정렬 가능 키: `created_at`, `code`, `name`, `ends_at`.
- "쿠폰 만들기" 버튼(`CouponFormDialog`, 쓰기 권한자만).

**동작(서버 액션)**

| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 쿠폰 만들기 | `createCouponAction` (`admin/lib/actions/coupons-actions.ts`) | zod `couponSchema`(code 4~32자 대문자/숫자/하이픈, name 필수 ≤60자, 기간 KST→UTC 변환, endsAt > startsAt, maxRedemptions/perUserLimit 숫자 범위) | `coupons` insert | `coupon.create` | 없음(태그 없음) |
| 쿠폰 수정 | `updateCouponAction` | 동일 스키마 + `couponId` | `coupons` update | `coupon.update` | 없음 |

**클라이언트와의 상호작용**
- `coupons` 테이블은 `coupons_admin_all` RLS 로 관리자만 조회하며 일반 사용자 select 정책이 아예 없다(코드 열거 차단, 마이그레이션 `20260910000100`). 사용자 사이트는 이 목록을 직접 읽지 않는다.
- 사용자는 마이페이지 쿠폰 탭에서 코드를 **직접 입력**해 등록한다(§상호작용은 §2 참고). 여기서 만든 `code` 값이 그 입력창과 1:1로 맞아야 한다.

**주의**
- 상태(활성/시작 전/기간 만료/비활성)는 컬럼이 아니라 파생값이다(`deriveCouponStatus`, `admin/lib/validation/coupons.ts`). 목록 필터는 화면이 아니라 질의 조건(`applyStatusFilter`)으로 같은 판정을 재현한다 — 페이지네이션이 어긋나지 않게 하려는 것.
- 코드 정규화(`normalizeCouponCode`: 공백 제거 + 대문자화)는 DB의 `code_normalized` 생성 컬럼과 완전히 같은 규칙이어야 한다. 자동 생성 코드는 `0/O/1/I` 를 제외한 32자 알파벳으로 `GLZA-XXXX-XXXX` 형태를 만든다(수동 입력은 막지 않고 경고만).
- 시작/종료 시각 입력은 `datetime-local`(타임존 없음)을 **KST(+09:00)로 못 박아** UTC로 변환한다(`kstLocalToIso`). 서버가 UTC 배포일 때 9시간 밀리는 문제를 막기 위함.

## 2. 쿠폰 상세 (`/coupons/[id]`)

**목적** 쿠폰 정보를 관리하고, 사용자가 등록 신청한 내역을 확인해 지급 처리 결과를 기록한다.

**화면 구성**
- `CouponSummary`: 코드, 이름, 상태 뱃지 + 지금 등록 불가 사유 안내(비활성/시작 전/기간 만료일 때), 노출 기간, 전체 한도(`used / 한도(남은 n)`, 한도 도달 시 강조), 1인 등록 횟수, 처리 대기 건수(0 초과 시 강조), 지급 내용, 생성일·최근 수정일, 설명(운영 메모).
- 헤더 액션(쓰기 권한자): "수정"(`CouponFormDialog`), 활성/비활성 토글(`CouponActiveButton`), 삭제(`CouponDeleteButton`, **등록 내역 0건일 때만 노출**).
- "등록 내역" 카드: `CopyUidsButton`(현재 목록 기준 MSW UID를 줄바꿈으로 복사, 게임팀 전달용), 상태 탭(`RedemptionTabs`, 건수 포함: 전체/처리 대기/지급 완료/거절, 쿼리 키 `rstatus`), 표(`RedemptionTable`) — 닉네임(등록 시점 스냅샷, `userId` 있으면 회원 상세 링크), MSW UID, 프로필 코드, 등록일, 상태 뱃지, 처리자·처리일, 메모, 처리 버튼(대기 상태 + 쓰기 권한자만: 지급 완료/거절).

**동작(서버 액션)**

| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 활성/비활성 전환 | `setCouponActiveAction` (`admin/lib/actions/coupon-lifecycle-actions.ts`) | zod `couponActiveSchema`. `.eq('is_active', before)` 낙관적 잠금 | `coupons.is_active` | `coupon.activate` / `coupon.deactivate` | 없음 |
| 삭제 | `deleteCouponAction` | zod `couponDeleteSchema`. 등록 내역(`coupon_redemptions`) 건수 0 아니면 거부, FK 위반도 방어 | `coupons` delete | `coupon.delete` | 없음 |
| 등록 내역 처리(지급 완료/거절) | `updateRedemptionStatusAction` (`admin/lib/actions/coupon-redemption-actions.ts`) | zod `couponRedemptionStatusSchema`(status는 delivered/rejected만, note ≤300자). 상태 전이표(`pending→delivered/rejected`만 허용, 종료 상태에서 되돌리기 불가) + `.eq('status', from)` 낙관적 잠금 | `coupon_redemptions.{status,admin_note,processed_by,processed_at}` | `coupon_redemption.status` | 없음(`revalidatePath` 로 `/coupons`, `/coupons/[id]` 만 갱신) |

**클라이언트와의 상호작용 — 쿠폰 등록 라이프사이클**
1. **클라이언트 등록**: 사용자가 계정(`app/(auth)/account/coupon` 등)에서 코드·MSW UID·프로필 코드를 입력 → `redeemCouponAction`(`lib/actions/coupon-actions.ts`)이 `public.redeem_coupon()` SECURITY DEFINER RPC 하나만 호출한다. 테이블 직접 조회·삽입 권한이 없어(코드 열거 차단) 한도 판정과 삽입 사이 경합은 RPC 내부 `for update` 로 막는다. 성공 시 `coupon_redemptions` 에 `status='pending'` 행이 생기고 화면이 `refresh()` 된다.
2. **관리자 지급 처리**: 이 화면(`/coupons/[id]`)에서 운영자가 대기 건을 "지급 완료" 또는 "거절"로 처리(위 표). **실제 지급은 게임 안에서 사람이 수행**하며, 이 액션은 "처리했다"는 사실과 근거(처리자·시각·메모)만 기록한다.
3. **클라이언트 내역 조회**: 사용자는 마이페이지에서 `getMyCouponRedemptions()`(`lib/data/coupons.ts`)가 부르는 `public.my_coupon_redemptions()` RPC로 본인 등록 이력을 본다. 코드는 DB에서 마스킹되어 나오고(`code_masked`), 거절이 아닌 건의 관리자 메모는 화면에 노출하지 않는다(`status==='rejected'` 일 때만 `adminNote` 표시).

**주의**
- 지급 완료/거절은 **되돌릴 수 없다**(`COUPON_REDEMPTION_TRANSITIONS` 상 종료 상태에서 나가는 전이가 없음). 지급을 취소하려면 게임 안에서 회수해야 하며, 콘솔에는 그 수단이 없다 — 잘못 처리했다면 메모로 정정 기록만 남긴다.
- 삭제는 등록 내역이 한 건도 없을 때만 가능(`on delete restrict` FK로 DB도 재차 막는다). 이력이 남은 쿠폰은 비활성화만 가능하다.
- 활성 토글·상태 처리 모두 동시 조작을 낙관적 잠금(`.eq()` 조건부 update)으로 막는다 — 두 운영자가 동시에 눌러도 나중 한 명은 0행을 고치고 실패 안내를 본다.
- 닉네임은 등록 시점 스냅샷(`nickname_snapshot`)이 우선이다. 회원이 탈퇴·파기돼도 이 값은 남고, `userId` 가 살아 있을 때만 회원 상세로 링크된다.
