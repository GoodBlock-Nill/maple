# 내부 메모 (`/inquiries/[id]` 중단)

> 07 고객지원 › 상세의 카드 하나. 스레드 바로 아래, 답변 폼 바로 위에 있다([03-detail.md](03-detail.md) 참고).

**목적** 확인한 사실·보류 사유처럼 **다음 사람이 알아야 할 것**을 문의에 붙여 둔다. 사용자에게는 어떤 경로로도 보이지 않는다.

**데이터 출처**
- 컴포넌트: `admin/components/inquiries/InquiryNotes.tsx` + `InquiryNoteDeleteButton.tsx`.
- 조회: `getInquiryNotes(inquiryId, viewerId)` (`admin/lib/data/inquiry-assignment.ts`) — `inquiry_notes` 를 **세션 클라이언트**로 `created_at desc`(최신이 위). `viewerId` 로 행마다 `isMine` 을 계산한다.
- 테이블: `inquiry_notes`(마이그레이션 20260911000300 §4). `inquiries` 에 열로 두지 않은 이유는 그 테이블이 소유자에게 열려 있어 select 한 줄로 새어 나가기 때문이다.
- RLS: `inquiry_notes_select_admin`(is_admin) · `inquiry_notes_insert_admin`(is_admin **AND** `author_id = auth.uid()`) · `inquiry_notes_delete_own`(is_admin **AND** 본인). **UPDATE 정책은 아예 없다** — 메모는 고치지 않고 지우고 다시 쓴다. `anon` 은 `revoke all`.

## 1. 카드 머리글

| 요소 | 값 |
|---|---|
| 제목 | 내부 메모 |
| 설명 | "확인한 사실·보류 사유처럼 다음 사람이 알아야 할 것을 남깁니다." |
| 우측 뱃지 | `Badge tone="warn"` — `INQUIRY_NOTE_VISIBILITY_NOTICE` = "운영자 전용 · 고객에게 보이지 않습니다" |

같은 경고를 **카드 머리와 입력칸 hint 양쪽에** 적는다. 답변 폼과 생김새가 비슷해서 한 곳에만 두면 스크롤 위치에 따라 안내를 놓치고 사용자에게 보낼 말을 여기에 쓰게 된다(그 반대도 마찬가지).

## 2. 메모 작성 폼 (write 권한일 때만)

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| `inquiryId` | hidden | `z.uuid('문의를 찾을 수 없습니다.')` | 현재 문의 | — |
| 메모 내용 | Textarea `body`, rows 3, required | `plainTextField(2000, …)` 규칙(아래) | 빈칸. placeholder "예: 결제 로그 확인함. 환불 기준 확인 후 답변 예정." | hint·상태 관리(아래) |
| 오류 배너 | `FormBanner` | — | — | `state.formError` |
| 메모 남기기 | 버튼(sm, 우측 정렬) | write 권한 | "메모 남기기" / "남기는 중…" | `createInquiryNoteAction` 실행(아래) |

**동작 상세**
- **메모 내용(필수·제한)** — `plainTextField(2000, …)` — CRLF→LF, trim 후 1~2000자. DB `inquiry_notes_body_length check (char_length(body) between 1 and 2000)` 와 같은 숫자.
- **메모 내용(동작)** — hint = "운영자 전용 · 고객에게 보이지 않습니다. 사용자 화면과 답신 메일 어디에도 나가지 않습니다." 값을 React 상태로 쥐고 성공 시 직접 비운다.
- **메모 남기기** — `createInquiryNoteAction` → `inquiry_notes` insert → 감사 `inquiry_note.create` → `revalidateInquiry()` → 토스트 "내부 메모를 남겼습니다."

빈 값·초과 문구: "메모 내용을 입력해 주세요." / "메모는 2000자를 넘을 수 없습니다."

`author_nickname_snapshot` 에 **작성 시점의 닉네임**을 함께 박는다. `author_id` 는 `on delete set null` 이라 계정이 사라져도 "누구의 판단인지"는 남아야 한다.

감사 로그의 `after` 는 `{ inquiry_id, length }` 뿐이다 — **본문을 남기지 않는다.** 메모를 지워도 감사 로그에 사본이 남으면 지운 뜻이 사라진다.

## 3. 메모 목록

비어 있으면 `EmptyState` — 제목 "아직 남긴 메모가 없습니다." · 설명 "답변 전에 확인한 사실을 적어 두면 다음 사람이 같은 확인을 반복하지 않습니다."

| 열/요소 | 값의 출처 | 표시 규칙 |
|---|---|---|
| 목록 컨테이너 | — | `data-testid="inquiry-notes"`, 최신순 |
| 작성자 | `author_nickname_snapshot` | 굵게. 계정이 사라져도 그대로 |
| 작성 시각 | `created_at` | `formatDateTime()` |
| 삭제 | 버튼(ghost, sm) | **`canWrite && note.isMine` 일 때만** 그린다 |
| 본문 | `body` | 평문 + `whitespace-pre-line`(줄바꿈만) |

### 3.1 삭제 확인 다이얼로그

| 요소 | 값 |
|---|---|
| 제목 | 내부 메모 삭제 |
| 설명 | "이 메모를 지웁니다. 문의 내용과 답변은 그대로이고, 지운 메모는 되살릴 수 없습니다." |
| 숨은 값 | `noteId`(`z.uuid('메모를 찾을 수 없습니다.')`), `inquiryId` |
| 버튼 | "취소" · "삭제"(danger, 진행 중 "삭제 중…") |
| 성공 | 토스트 "내부 메모를 지웠습니다." + 다이얼로그 닫힘 |

`deleteInquiryNoteAction` 은 삭제 전에 `author_id` 를 **다시 읽는다.** RLS 가 막으면 "0건 삭제"가 조용한 성공으로 보이기 때문이다 — 운영자에게는 지워지지 않은 이유를 말해 줘야 한다. 감사 `inquiry_note.delete`(`before: { inquiry_id }`).

## 4. 상태·뱃지 의미

| 뱃지 | 언제 | 톤 |
|---|---|---|
| 운영자 전용 · 고객에게 보이지 않습니다 | 항상(카드 머리) | warn |

메모 자체에는 상태가 없다. 수정 기능도 없다.

## 5. 클라이언트와의 상호작용

- **없다.** 사용자 사이트는 `inquiry_notes` 를 읽는 코드가 없고, RLS 에 소유자·anon 정책 자체가 없다. 답신 메일에도 들어가지 않는다.
- 메모를 남기거나 지우면 `revalidateInquiry()` 가 `/inquiries/[id]` 와 `/inquiries` 를 되살리지만 `revalidateClient()` 는 부르지 않는다(사용자 사이트가 읽지 않는 데이터까지 태우면 남의 캐시를 이유 없이 비운다).

## 6. 오류·예외

| 상황 | 결과 |
|---|---|
| 조회 실패 | `console.error('[inquiries] 내부 메모 조회 실패')` + 빈 목록(문의 본문은 그대로 보인다) |
| 빈 본문 / 2000자 초과 | 필드 오류 문구(§2) |
| insert 실패 | "메모를 남기지 못했습니다…"(아래) |
| 지우려는 메모가 없음 / `noteId` 가 uuid 아님 | "메모를 찾을 수 없습니다. 목록을 새로고침해 주세요." |
| 남의 메모 삭제 시도(직접 POST) | "내가 남긴 메모만 지울 수 있습니다." (액션 · RLS 두 겹) |
| delete 실패 | "메모를 지우지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 작성자 계정 삭제됨 | `author_id = null` → 그 메모는 **아무도 지울 수 없다**(닉네임 스냅샷만 남아 열람은 가능) |
| 읽기 전용 관리자 | 입력 폼과 삭제 버튼이 없고 목록만 보인다 |

- **insert 실패** — 전체 문구는 "메모를 남기지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 저장해 주세요." 입력값은 남는다.
