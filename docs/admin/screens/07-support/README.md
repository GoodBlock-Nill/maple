# 07 고객지원 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 고객지원 메뉴. 화면 하나당 파일 하나이고, 각 파일은 `_TEMPLATE.md` 의 형식(목적 · 데이터 출처 · 섹션별 필드 표 · 상태·뱃지 · 클라이언트 상호작용 · 오류·예외)을 그대로 따른다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | 문의·카테고리·템플릿·FAQ 6개 라우트(아래) |
| 권한 모듈 | `inquiries`(문의 계열), `faqs`(FAQ)(아래) |
| 주요 테이블 | `inquiries`·`inquiry_replies`·`inquiry_notes`·`inquiry_categories`(아래) |
| 클라이언트 영향 | 문의·답변·메모는 캐시 없음, 카테고리·FAQ는 태그 재검증(아래) |
| 관련 파일 | 페이지·컴포넌트·액션·유틸·마이그레이션(아래) |

**동작 상세**
- **경로** — `/inquiries?source=web` · `/inquiries?source=email` · `/inquiries/[id]` · `/inquiries/categories` · `/inquiries/reply-templates` · `/faqs`.
- **주요 테이블** — `inquiries`, `inquiry_replies`, `inquiry_notes`, `inquiry_categories`, `inquiry_reply_templates`, `faqs`, `email_inbound_events`.
- **권한 모듈** — 문의 계열 전부 `inquiries`(read/write), FAQ 만 `faqs`(read/write). `admin/lib/auth/permissions.ts` 의 라벨은 각각 '홈페이지 문의' · 'FAQ'.
- **클라이언트 영향** — 문의·답변·메모는 캐시 태그가 없다(세션마다 RLS 로 직접 조회 → 즉시). 카테고리는 `inquiry-categories`, FAQ 는 `faqs` 태그 재검증. 답변 템플릿은 관리자 전용이라 태그 없음.
- **관련 파일** — `admin/app/(admin)/{inquiries,faqs}/**` · `admin/components/{inquiries,inquiry-categories,inquiry-reply-templates,faqs}/**` · `admin/lib/{actions,data,validation}/{inquir*,faq*}.ts` · `admin/lib/utils/{inquiry-no,inquiry-reply-template}.ts` · `admin/lib/constants/inquiry-kind.ts` · `supabase/migrations/2026090840*·2026091*` · `supabase/functions/email-{inbound,outbound}`.

## 1. 화면 목록

| 파일 | 경로 | 설명 |
|---|---|---|
| [01-list-web.md](01-list-web.md) | `/inquiries?source=web` | 홈페이지 문의 목록 — 상태 탭 · 필터 폼 · 표 |
| [02-list-email.md](02-list-email.md) | `/inquiries?source=email` | 이메일 문의 목록 — 01 과의 차이만 |
| [03-detail.md](03-detail.md) | `/inquiries/[id]` | 상세 — 헤더(상태·종료) · 담당자 · 메타 · 본문·첨부 · 스레드 |
| [04-reply-form.md](04-reply-form.md) | `/inquiries/[id]` 하단 | 답변 작성 폼 — 템플릿·자리표시자·다음 상태·잠금·충돌 |
| [05-notes.md](05-notes.md) | `/inquiries/[id]` 중단 | 내부 메모(운영자 전용) |
| [06-categories.md](06-categories.md) | `/inquiries/categories` | 문의 카테고리 목록 — 종류별 섹션 · 순서 · 노출 · 삭제 |
| [07-category-form.md](07-category-form.md) | 위 화면의 다이얼로그 | 카테고리 등록·수정 · 세부 유형 편집기 · 종류 변경 확인 |
| [08-reply-templates.md](08-reply-templates.md) | `/inquiries/reply-templates` | 답변 템플릿 목록 — 공통/카테고리 묶음 |
| [09-reply-template-form.md](09-reply-template-form.md) | 위 화면의 다이얼로그 | 템플릿 등록·수정 · 자리표시자 삽입 · 미리보기 |
| [10-faq.md](10-faq.md) | `/faqs` | FAQ 목록 — 카테고리 섹션 · 순서 · 발행 |
| [11-faq-form.md](11-faq-form.md) | 위 화면의 다이얼로그 | FAQ 등록·수정 · 삭제 확인 |

## 2. 메뉴 전체 공통 규칙

### 2.1 접수 종류(kind)
`admin/lib/constants/inquiry-kind.ts` 의 `INQUIRY_KINDS` 가 값·라벨·순서를 모두 소유한다. 사용자 사이트의 같은 이름 파일(`lib/constants/inquiry-kind.ts`)과 **글자 그대로 같아야 한다**(별도 pnpm 패키지라 서로 import 하지 않는다).

| 값 | 라벨 | 사용자 폼 경로 | 제출 버튼 |
|---|---|---|---|
| `inquiry` | 1:1 문의 | `/support` | 문의하기 |
| `bug` | 버그제보 | `/support/bug` | 제보하기 |
| `report` | 불법이용제보 | `/support/report` | 제보하기 |

- `inquiries.kind` 는 **앱이 정하지 않는다.** 트리거 `set_inquiry_kind_from_category()`(마이그레이션 20260914000100)가 `inquiry_categories.label = inquiries.category` 로 다시 계산한다. 매칭되는 카테고리가 없으면 값을 건드리지 않고, DB 기본값 `'inquiry'` 로 남는다.
- `DEFAULT_INQUIRY_KIND = 'inquiry'`. 화면은 CHECK 밖의 값을 만나면 이 값으로 떨어뜨린다(빈칸을 그리지 않는다).
- `inquiry_categories.sort_order` 는 **kind 안에서의 순서**다(같은 마이그레이션). 전역 순서가 아니다.

### 2.2 상태와 전이
`admin/lib/validation/inquiries.ts`.

| 값 | 라벨 | 뱃지 톤 |
|---|---|---|
| `pending` | 접수 대기 | `neutral` |
| `in_progress` | 처리 중 | `info-blue` |
| `answered` | 답변 완료 | `success-green` |
| `closed` | 종료 | `muted` |
| (`cancelled_at` not null) | 접수 취소 | `muted` |

- 전이표 `INQUIRY_STATUS_TRANSITIONS`: `pending → {in_progress, answered, closed}` · `in_progress → {answered, closed}` · `answered → {closed}` · `closed → {in_progress}`. 되돌리기는 마지막 하나뿐이다.
- 화면(select 옵션)과 액션(`applyStatusChange`)이 **같은 표**를 본다. 직접 POST 도 같은 규칙에 걸린다.
- `answered_at` 은 처음 `answered` 로 넘어간 UPDATE 에서만 찍는다(첫 응답 시간 지표 보존).
- '접수 취소'는 enum 값이 아니다 — `status='closed'` + `cancelled_at is not null`. 판정 함수는 `isCancelledInquiry(cancelledAt)` 하나이고 사용자 사이트 `resolveInquiryStatus()` 와 같은 규칙이다.
- 취소된 문의는 관리자 쪽에서도 읽기 전용이다: 상태 변경·답변·배정이 `cancelledGuard()` 로 막히고, `add_inquiry_reply()` 도 `code='cancelled'` 로 거절한다.

### 2.3 권한
| 모듈 | read 로 보이는 것 | write 가 더 보여 주는 것 |
|---|---|---|
| `inquiries` | 목록·상세·스레드·내부 메모·카테고리·템플릿(전부 읽기) | write 로 추가되는 조작(아래) |
| `faqs` | `/faqs` 목록(미발행 포함) | FAQ 등록·수정·삭제·발행 토글·순서 저장 |

- **`inquiries` write** — 상태 변경 select, 종료 버튼, 담당자 컨트롤, 답변 폼, 메모 입력·삭제, 카테고리/템플릿의 ▲▼·순서 저장·토글·등록·수정·삭제.

모든 서버 액션이 스스로 `requirePermission(...)` 를 다시 부른다 — 화면의 버튼 유무는 인가가 아니다. 쓰기는 전부 세션 클라이언트로 하고(서비스 롤 금지) RLS(`inquiries_select_admin` · `inquiry_notes_select_admin` · `inquiry_reply_templates_admin_all` · `inquiry_categories_admin_all` · `faqs_admin_all`)가 다시 검사한다.

### 2.4 캐시·재검증
| 쓰기 | `revalidatePath` | `revalidateClient` 태그 | 사용자 사이트 반영 |
|---|---|---|---|
| 문의 상태·답변·배정·메모 | `/inquiries/[id]` + `/inquiries` (`revalidateInquiry`) | 없음 | 즉시(사용자 상세도 `force-dynamic` 성격의 직접 조회) |
| 이메일 답신 재발송 | `/inquiries/[id]` | 없음 | 메일 발송뿐 |
| 카테고리 전체 | `/inquiries/categories` + `/inquiries` | `inquiry-categories` | 즉시 시도, 실패 시 최대 300초 |
| 답변 템플릿 전체 | `/inquiries/reply-templates` | 없음(관리자 전용 테이블) | 없음 |
| FAQ 전체 | `/faqs` | `faqs` | 즉시 시도, 실패 시 최대 300초 |

`revalidateClient()` 는 사용자 사이트 `POST /api/revalidate` 를 두드린다(별도 배포라 `revalidateTag()` 가 닿지 않는다). **절대 throw 하지 않는다** — 실패해도 저장은 이미 끝났고 경고 로그만 남는다(`admin/lib/revalidate.ts`).

### 2.5 감사 로그 액션 이름
`admin/components/audit/audit-labels.ts` 가 라벨을 갖는다(`inquiry` 홈페이지 문의 · `inquiry_note` 문의 내부 메모 · `inquiry_category` 문의 카테고리 · `inquiry_reply_template` 답변 템플릿 · `faq` FAQ).

| 액션 | 남기는 곳 |
|---|---|
| `inquiry.status` | `applyStatusChange()` (상태 변경·종료·답변 뒤 전이) |
| `inquiry.reply` / `inquiry.email.reply` | `replyToInquiryAction()` |
| `inquiry.email.resend` | `resendInquiryEmailAction()` |
| `inquiry.assign` / `inquiry.unassign` | 배정 액션 |
| `inquiry.edit_lock` | `claimInquiryEditAction()` — **가로채기(`taken_over`)일 때만** |
| `inquiry_note.create` / `inquiry_note.delete` | 메모 액션(본문은 남기지 않는다) |
| `inquiry_category.create` / `.update` / `.delete` / `.reorder` | 카테고리 액션(토글도 `.update`) |
| `inquiry_reply_template.create` / `.update` / `.delete` / `.reorder` | 템플릿 액션(토글도 `.update`) |
| `faq.create` / `.update` / `.delete` / `.publish` / `.reorder` | FAQ 액션 |

### 2.6 심화 문서
- `docs/admin/INQUIRY-GUIDE.md` — 문의 전체 흐름(다이어그램 포함 HTML 동반)
- `docs/admin/EMAIL-INQUIRY-GUIDE.html` — 이메일 문의 수·발신 설계
- `docs/admin/TEMPLATES-GUIDE.md` — 세 갈래 템플릿(문의 카테고리 프리필 · 뉴스 카테고리 템플릿 · 답변 템플릿) 비교
- `docs/reference/inquiry-thread-spec.md` — 회원 답장(스레드) 규칙

### 2.7 회원 답장(대화 스레드, 2026-09-14 배포)
마이그레이션 `20260914000400_inquiry_thread.sql` 이 연 회원 답장은 **관리자·사용자 양쪽에 UI 가 있다**(커밋 `df57060` 관리자, `6edbcf9` 사용자). 처리 중인 문의에 한해 사용자가 같은 접수번호로 이어 쓴다 — 새 문의를 만들지 않는다.

| DB 요소 | 규칙 | 지금 화면에서 |
|---|---|---|
| `inquiry_replies.attachments` | 형식 무관 최대 5개 · 합계 200MB(2026-09-14) | 관리자 스레드가 서명 URL 로 그림(일괄 서명). 사용자 스레드도 같은 첨부 표시 |
| `inquiries.user_replied_at` | 회원 답장 도착 시각. 운영자 답변(outbound)이 들어오면 트리거가 null 로 되돌린다 | 목록·회원 상세에 "회원 답장" 뱃지, `?awaiting=1` 필터가 이 값을 읽는다 |
| `add_inquiry_user_reply(uuid, text, jsonb)` | 조건 체인·오류 코드(아래) | 사용자 답장 폼(`InquiryUserReplyForm` → `replyToInquiry`)의 유일한 호출부 |
| `touch_inquiry_on_reply()` | 답변·답장 INSERT 마다 `inquiries.updated_at = now()` | 목록 '업데이트' 칸이 이미 이 값을 본다 |

- **`add_inquiry_user_reply` 규칙** — 본인 → 취소 아님 → **처리 중에서만** → 운영자 답변 있음 → 마지막 운영자 답변 이후 1건 미만(운영자 답변 하나당 답장 1건, 2026-09-15) → 내용 1~2000자·첨부 상한. 코드: `not_owner` · `cancelled` · `not_in_progress` · `no_operator_reply` · `too_many` · `invalid`.

관리자 상세의 웹 스레드는 회원 답장(`direction='inbound'` + `author_id` not null)을 "회원 답장" 뱃지 + 왼쪽 굵은 선으로 구분해 그린다(03-detail §4 참고). 답변 폼 "등록 후 상태" 기본값은 **처리 중**(오너 지시, 휴먼 에러 방지) — 04-reply-form 참고.
