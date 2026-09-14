# 이메일 문의 목록 (`/inquiries?source=email`)

> 07 고객지원 › 목록. **같은 라우트의 다른 프리셋**이다 — 구조·데이터 출처·표·정렬·페이지네이션은 [01-list-web.md](01-list-web.md) 와 완전히 같다. 여기에는 다른 점만 적는다.

**목적** 이메일로 들어온 문의를 확인·검색하고 상세에서 답신한다. 사이드바의 '이메일 문의'가 이 프리셋을 가리킨다(새 라우트가 아니다).

**데이터 출처** 01 과 동일. 추가로 `applyInquiryFilters` 가 `source = 'email'` 을 건다.

## 1. 헤더 문구

| 필드 | 값 |
|---|---|
| 제목 | `PRESETS.email.title` = "이메일 문의" |
| 설명 | "이메일로 들어온 문의입니다. 답신은 사용자의 메일 주소로 발송됩니다." |
| 카테고리 관리 버튼 | 01 과 동일하게 노출된다(공용 헤더) |

## 2. 상태 탭 — 한 칸이 빠진다

`isEmail` 이면 `INQUIRY_STATUS_TABS` 에서 `cancelled` 탭을 **제거한다**. 이메일 문의에는 접수를 취소할 사용자가 없어 언제나 0 인 탭이 되고, 그러면 운영자가 "취소가 안 잡히나" 하고 의심하게 된다.

| 탭 | 노출 |
|---|---|
| 미처리 · 접수 대기 · 처리 중 · 답변 완료 · 종료 · 전체 | 있음 |
| 접수 취소 | **없음** |

## 3. 필터 폼 — 세 개의 select 가 사라진다

수신 함수(`supabase/functions/email-inbound`)가 `category='email'`, `type='general'` 로 고정해 넣기 때문에 고를 것이 없다. 그 라벨은 등록된 카테고리 어느 것과도 매칭되지 않으므로 트리거가 `kind` 를 건드리지 않고 컬럼 기본값 `inquiry` 로 남는다.

| 컨트롤 | 웹 프리셋 | 이메일 프리셋 |
|---|---|---|
| 담당자 `assignee` | 있음 | 있음(같음) |
| 종류 `kind` | select | **숨김**(아래) |
| 카테고리 `category` | select | **없음**(hidden 도 없음) |
| 유형 `type` | select(옵션 있을 때) | **없음** |
| 등록일 `from`/`to` | 있음 | 있음(같음) |
| 검색 `q` | 있음 | 있음, 발신자 주소도 함께 검색(아래) |
| 초기화 | `status·source·user·kind` 유지 | 같음 |

**동작 상세**
- **종류 `kind`** — 주소에 실려 온 값은 `<input type="hidden" name="kind">` 로 나른다 — 화면에 없는 조건이 검색 한 번에 조용히 사라지지 않게.
- **검색 `q`** — placeholder 문구가 "… · 발신자 주소"를 포함하는 이유가 여기 있다 — `email_from.ilike` 조건이 같은 or 절에 들어 있다.

## 4. 표 — '계정' 칸만 다르다

`AccountCell` 이 `row.source === 'email'` 로 갈린다.

| 열 | 이메일 프리셋의 표시 |
|---|---|
| 계정 | 표시 규칙(아래) |
| 나머지 열 | 01 과 동일. 카테고리 · 유형 칸은 표시 치환으로 "이메일 · 일반"이 된다 |

**동작 상세**
- **계정** — `inquiries.email_from` 을 모노스페이스로(없으면 `-`). 그 아래 SPF·DKIM·DMARC 중 **하나라도 `fail`** 이면 `Badge tone="warn"` "인증 실패".

`hasEmailAuthFailure()`(`admin/lib/data/inquiry-email.ts`)는 판정이 없는 값(`none` · null · 모양이 깨진 jsonb)을 **실패로 보지 않는다** — 레코드를 두지 않은 정상 도메인까지 경고로 칠하면 뱃지가 의미를 잃는다.

## 5. 상태·뱃지 의미

01 의 표에 아래 한 줄이 더해지고, '접수 취소'는 나타나지 않는다(`cancelled_at` 이 채워질 경로가 없다).

| 뱃지 | 값 | 톤 | 언제 |
|---|---|---|---|
| 인증 실패 | `email_auth.{spf,dkim,dmarc}` 중 하나가 `fail` | warn | 답신을 쓰기 전에 사칭 가능성을 알리려고 목록 단계에서 세운다 |

## 6. 클라이언트와의 상호작용

- **사용자 사이트 화면이 없다.** 발신자는 자기 메일함에서 읽는다. 관리자 스레드가 유일한 기록이다.
- 수신: `supabase/functions/email-inbound` 가 제공자(Resend) 웹훅을 받는다. 서명(Svix) 검증 → `email_inbound_events(svix-id)` 로 전달 중복 제거 → `email.received` 는 `received.ts`, 배달 이벤트는 `delivery.ts`. 응답 규약: 처리/무시 200, 중복 200(`duplicate:true`), 서명 누락·불일치 401, 본문 파싱 실패 400, 시크릿 미설정 503, DB·제공자 오류 5xx(제공자가 재시도한다).
- 발신: `supabase/functions/email-outbound` 가 관리자 서버 액션의 **운영자 JWT** 로 호출된다. 제공자 API 키는 이 함수의 secret 에만 있고 관리자 앱은 들고 있지 않다. 응답: 200 `{ok, status, messageId}` · 400(`invalid_request`/`not_email_inquiry`/`not_outbound`/`no_recipient`) · 401 · 403 · 404 · 409 `already_sent` · 502 `send_failed` · 503 `not_configured`.
- 답신 메일 끝에는 고정 서명이 붙는다: "글자월드 고객지원 / 이 메일에 답장하시면 같은 문의에 이어서 접수됩니다." 회신 주소는 `reply+<email_thread_key>@` 형태다(키는 화면에 노출하지 않는다).
- `inquiries.user_id` 를 **일부러 비워 둔다** — 발신자 주소로 회원을 확정하면 위조 메일 하나로 사칭이 성립한다. 그래서 상세 메타에도 회원 링크가 없다([03-detail.md](03-detail.md) §2).
- 개인정보 동의: 폼 체크박스를 거치지 않으므로 `inquiries_privacy_consent_required` CHECK 가 이메일 출처에 한해 완화돼 있다(마이그레이션 20260909000300 §2).

## 7. 오류·예외

| 상황 | 결과 |
|---|---|
| `email_auth` 가 배열·문자열 등 예상 밖 모양 | `parseEmailAuth()` 가 null → 뱃지 없음(화면은 죽지 않는다) |
| `email_from` 이 null | 계정 칸에 `-`, 상세 헤더에 "(발신자 없음)" |
| `source` 컬럼이 CHECK 밖의 값 | `toInquirySource()` 가 `'web'` 으로 떨어뜨린다(빈 화면보다 낫다) |
| 이메일 제공자 미연동 | 계정·DNS·secret 연동 미완료(아래) |
| `?kind=` 가 주소에 남아 있음 | 화면에 select 가 없어도 hidden 으로 유지되어 계속 적용된다(대개 결과 0건) |

- **이메일 제공자 미연동** — 코드·DB·함수는 배포돼 있으나 계정·DNS·secret 연동은 미완료다(`docs/admin/INQUIRY-GUIDE.md` §1.1). 발송 시도는 `EMAIL_NOT_CONFIGURED_MESSAGE` 로 끝난다.
