# 문의 상세 (`/inquiries/[id]`)

> 07 고객지원 › 상세. 답변 폼은 [04-reply-form.md](04-reply-form.md), 내부 메모는 [05-notes.md](05-notes.md) 로 나눴다(같은 페이지의 아래쪽 카드들이다).

**목적** 문의 1건의 내용·첨부·스레드를 확인하고, 담당자를 정하고, 상태를 옮기거나 종료한다. 웹 문의와 이메일 문의가 같은 화면을 쓰고 **문구와 메타 항목만** 갈린다.

**데이터 출처**
- 페이지: `admin/app/(admin)/inquiries/[id]/page.tsx`, `dynamic = 'force-dynamic'`, `metadata.robots = { index: false, follow: false }`(제목·내용에 개인정보가 섞인다).
- 가드: `requirePermission('inquiries','read')`, 쓰기 여부는 `hasPermission(permissions,'inquiries','write')` → `canWrite`.
- 본문: `getInquiryDetail(id)`(`admin/lib/data/inquiry-detail.ts`). `maybeSingle()` 이 null 이거나 uuid 가 아니어서 22P02 로 떨어지면 `notFound()`(404).
- 이어서 병렬로 `getInquiryReplies(id)` · `getInquiryReplyTemplateOptions(inquiry.category)` · `getInquiryNotes(id, admin.id)` · `getAdmins()`. 템플릿은 답변 폼을 그리지 않는 경우(읽기 전용·취소·종료)에도 함께 읽는다 — 조건을 나누면 "폼은 보이는데 선택지는 빈" 경로가 생긴다.
- 잠금 상태: `isLocked = isCancelledInquiry(cancelledAt)`, 출처 분기: `isEmail = source === 'email'`.
- 첨부 서명 URL 은 이 조회 안에서 발급된다(`signInquiryAttachments`, TTL 300초).

## 1. 헤더

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 제목 | 텍스트 | — | `inquiries.title` | — |
| 부제 | 텍스트 | — | 웹: `#1024 · {카테고리} · {유형}` / 이메일: `#1024 · {email_from}`(없으면 "(발신자 없음)") | 접수번호가 맨 앞이다 — 사용자가 부르는 값이라 화면을 열자마자 대조할 수 있어야 한다 |
| 상태 뱃지 | 뱃지 | — | `status` + `cancelled_at` | `data-testid="inquiry-status"` 로 감싸 검증에서 잡는다 |
| 상태 변경 | select + 버튼 | write 권한. 옵션 = `INQUIRY_STATUS_TRANSITIONS[status]` | 첫 옵션 | §1.1 |
| 종료 | 버튼(secondary) + 다이얼로그 | write 권한 **AND** 취소 아님 **AND** `status !== 'closed'` | — | §1.2 |
| 목록 | 버튼(ghost, sm) | — | — | `/inquiries` 로 이동(현재 필터는 유지되지 않는다) |
| 취소 안내 배너 | 안내문 | `cancelled_at` 이 있을 때만 | — | "사용자가 접수를 취소한 문의입니다. 답변 등록과 상태 변경이 막혀 있습니다." |

### 1.1 상태 변경 폼 (`InquiryStatusForm`)

| 필드 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| `inquiryId` | hidden | `z.uuid('문의를 찾을 수 없습니다.')` | 현재 문의 | — |
| `expectedStatus` | hidden | 문자열(모르는 값이면 비교 생략) | 화면을 연 시점의 `status` | 충돌 감지 스냅샷 |
| `expectedReplyCount` | hidden | 정수 ≥0(아니면 비교 생략) | 화면을 연 시점의 `replies.length` | 충돌 감지 스냅샷 |
| 상태 | select `status`, sr-only 라벨 "상태 변경" | `z.enum(INQUIRY_STATUS_VALUES)` + 전이표 | 갈 수 있는 첫 상태 | **갈 수 없는 값은 옵션에 없다** — 규칙을 화면에서 배우게 한다 |
| 제출 | 버튼(sm) | write 권한 | 문구 "상태 변경" / 진행 중 "변경 중…" | `updateInquiryStatusAction` → 감사 `inquiry.status` → `revalidateInquiry()` → 성공 토스트 `상태를 '{라벨}'로 바꿨습니다.`(조사 자동) |
| 오류 | `FormError` | — | — | 아래 §5 표 |

폼 자체가 **`isLocked` 이거나 갈 곳이 없으면 렌더되지 않는다**.

### 1.2 종료 버튼 (`InquiryCloseButton`)

같은 액션(`updateInquiryStatusAction`)을 `status=closed` 로 부른다. select 로도 종료할 수 있지만 사용자 화면의 스레드가 닫히는 조작이라 확인을 한 단계 둔다.

| 요소 | 값 |
|---|---|
| 다이얼로그 제목 | "문의 종료" |
| 설명 | "사용자 화면의 상태가 '종료'로 바뀝니다. 필요하면 나중에 '처리 중'으로 되돌릴 수 있습니다." |
| 숨은 값 | `inquiryId`, `status=closed`, `expectedStatus`, `expectedReplyCount` |
| 버튼 | "취소" · "종료"(진행 중 "종료 중…") |
| 성공 | 토스트 후 다이얼로그 닫힘 |

## 2. 담당자 카드 (`InquiryAssignmentCard`)

머리글 "담당자" · 설명 "여러 운영자가 같은 문의에 답하지 않도록 맡은 사람을 먼저 정합니다.". 컨트롤은 `canWrite && !isLocked` 일 때만 그린다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 현재 담당자 | 뱃지 | — | 미배정이면 `warn` "미배정", 아니면 닉네임 뱃지(`accent`=나 / `neutral`=남) | `data-testid="inquiry-assignee"`. 내 담당이면 "내가 담당" 문구, `assigned_at` 이 있으면 "{일시} 배정" |
| 나에게 배정 | 버튼 | write. 이미 내 담당이면 렌더 안 함 | — | 미배정이면 **곧바로 폼 제출**, 남이 맡고 있으면 확인 다이얼로그("담당자 가져오기") |
| 담당자 변경 | select `assigneeId` + "변경" 버튼 | `z.uuid('담당자를 찾을 수 없습니다.')`, 액션이 `profiles.role='admin'` 재확인 | 현재 담당자 또는 나 | 선택지는 관리자 전원(내 항목에 " (나)"). 남이 맡고 있으면 확인 다이얼로그("담당자 변경") |
| 배정 해제 | 버튼(ghost) | write. 담당자가 있을 때만 | — | 내 배정이면 즉시, 남의 배정이면 확인 다이얼로그("배정 해제") |
| 오류 배너 | `FormBanner` | — | — | 배정·해제 액션의 `formError` 를 함께 보여 준다 |

**확인 다이얼로그 문구(남의 배정을 건드릴 때만)**

| 의도 | 제목 | 설명 | 실행 버튼 |
|---|---|---|---|
| 가져오기 | 담당자 가져오기 | `{닉네임} 관리자가 맡고 있는 문의입니다. 담당자를 나로 바꾸면 상대의 화면에도 그대로 보이고, 이미 쓰고 있던 답변이 사라지지는 않습니다.` | 내가 담당 |
| 변경 | 담당자 변경 | `{닉네임} 관리자가 맡고 있는 문의입니다. 담당자를 바꿔도 지금까지의 답변과 메모는 그대로 남습니다.` | 담당자 변경 |
| 해제 | 배정 해제 | `{닉네임} 관리자의 배정을 해제합니다. 문의는 '미배정'으로 돌아가고 상태와 답변은 그대로입니다.` | 배정 해제 |

**서버 동작**

| 동작 | 액션·파일 | DB | 감사 | 토스트 |
|---|---|---|---|---|
| 배정 | `assignInquiryAction` (`admin/lib/actions/inquiry-assignment-actions.ts`) | `assigned_to`, `assigned_at=now()`. **미배정 + 접수 대기**였다면 이어서 `pending→in_progress` 전이 | `inquiry.assign`(before/after + 닉네임) | `담당자를 나에게 지정했습니다.` 또는 `담당자를 {닉네임}(으)로 지정했습니다.` + 승격 시 " 상태도 '처리 중'으로 옮겼습니다." |
| 해제 | `unassignInquiryAction` | `assigned_to=null`, `assigned_at=null`(**상태는 건드리지 않는다**) | `inquiry.unassign` | `담당자 배정을 해제했습니다.` |

상태 승격이 실패해도 배정은 되돌리지 않는다 — 담당자는 이미 정해졌고 상태는 헤더 select 로 옮길 수 있다.

## 3. 문의 정보 카드 (`InquiryMeta`)

`source` 로 두 컴포넌트가 갈린다. 두 벌이 같은 줄 컴포넌트(`MetaRow`)를 써서 **눈이 같은 자리를 찾도록** 모양을 맞춘다.

### 3.1 웹 문의

| 행 | 값 | 규칙 |
|---|---|---|
| 접수번호 | `#{inquiry_no}` | 사용자 화면과 같은 표기 |
| 작성자 | `profiles.nickname` | `user_id` 가 있으면 `/members/{user_id}` 링크, 없으면 흐린 "(탈퇴한 회원)" |
| 종류 | `INQUIRY_KIND_MAP[kind].label` | 카테고리보다 먼저 읽히게 둔다 |
| 계정 ID | `maskAccountId(account_id)` | **상세에서도 마스킹한다**(앞 4 + `****` + 뒤 3). 화면 캡처가 그대로 개인정보가 되지 않게 |
| 연락 이메일 | `contact_email ?? profiles.email ?? '-'` | 접수 시 적은 값이 우선 |
| 카테고리 · 유형 | `inquiryCategoryLabel(category) · inquiryTypeLabel(type)` | 표시용 치환만 한다 |
| 접수일 | `created_at` | `formatDateTime()` |
| 최근 업데이트 | `updated_at` | 답변·상태·답장이 들어오면 갱신. **작성 중 하트비트로는 밀리지 않는다**(`set_inquiry_updated_at`) |
| 첫 답변 | `answered_at` | 값이 있을 때만 행이 생긴다 |
| 접수 취소 | `cancelled_at` | 값이 있을 때만 |

### 3.2 이메일 문의 (`InquiryEmailMeta`)

| 행 | 값 | 규칙 |
|---|---|---|
| 접수번호 | `#{inquiry_no}` | 같음 |
| From | `{email_from_name} <{email_from}>` 또는 주소만 | 이름이 없으면 괄호를 붙이지 않는다 |
| 원본 Message-ID | `email_message_id` | 모노스페이스·한 줄 말줄임, 원문은 `title` 속성에 남긴다(제공자 문의 때 필요) |
| 카테고리 · 유형 | "이메일 · 일반" | 수신 함수가 고정한 `email`/`general` 을 한국어로 치환 |
| 수신 시각 | `created_at` | — |
| 인증 | SPF·DKIM·DMARC 칩 3개 | `pass`→success-green, `fail`→warn, 그 밖·null→neutral. 라벨은 `SPF pass` 형태, 판정이 없으면 `SPF 판정 없음` |
| 최근 업데이트 | `updated_at` | — |
| 첫 답변 | `answered_at` | 값이 있을 때만 |

**작성자 링크·계정 ID 행이 없다.** 발신자 주소로 회원을 확정하지 않기 때문이다(`user_id` 를 채우지 않는다). `email_thread_key` 는 조회는 하되 화면에 그리지 않는다.

## 4. 문의 내용 · 첨부 · 스레드

### 4.1 문의 내용 카드

| 요소 | 종류 | 규칙 |
|---|---|---|
| 본문 | 평문 문단 | `whitespace-pre-line` — 줄바꿈만 살리고 마크업은 해석하지 않는다 |
| 첨부파일 | 소제목 + `InquiryAttachments` | 비어 있으면 "첨부파일이 없습니다." |

**첨부 한 건의 표시 규칙** (`InquiryAttachments`, 비공개 버킷 `inquiry-attachments`, 서명 URL 300초)

| 조건 | 표시 |
|---|---|
| `url === null`(서명 실패) | 파선 상자 `{파일명} (링크 발급 실패)` |
| `mimeType` 이 `video/*` | 한 줄 전체를 차지하는 `<video controls preload="metadata">` + 파일명 · 크기 · "내려받기" 링크. `preload="metadata"` 라 상세를 여는 것만으로 원본을 받지 않는다 |
| `mimeType` 이 `image/*` | 96×96 썸네일 버튼 → 누르면 `Dialog` 안에서 원본(최대 70vh). **새 탭으로 열지 않는다**(서명 URL 이 주소창·히스토리에 남는다). `next/image` 도 쓰지 않는다(5분 뒤 만료되는 URL 을 최적화 캐시가 붙들면 깨진 이미지가 남는다) |
| 그 밖(PDF 등) | `{url}&download={파일명}` 링크(새 탭). Storage 의 `download` 파라미터로 Content-Disposition 을 붙여 원래 이름으로 받게 한다 |
| 크기 표기 | 1MB 미만은 `NKB`(최소 1), 이상은 `N.NMB`. 0 이하면 빈 문자열 |

접수 시 상한은 사용자 사이트 상수(`lib/supabase/storage.ts`)가 소유한다: 이미지·PDF 5MB/개 · 최대 3개 · 합계 12MB, 영상 100MB/개 · 최대 2개. DB 도 같은 규칙을 건다 — `inquiries_attachments_max_5`(합계 5) · `inquiries_attachments_file_kind_max_3` · `inquiries_attachments_video_kind_max_2`(모두 `inquiry_attachment_kind_count()` 로 판정, 마이그레이션 20260911000600). 버킷 `inquiry-attachments` 의 `allowed_mime_types` 는 이미지 · PDF · zip · txt · 영상 4종을 연다.

### 4.2 답변 스레드 — 웹 (`InquiryReplyThread`)

| 요소 | 값 |
|---|---|
| 카드 제목 | `답변 {N}건` |
| 설명 | "사용자 화면에 그대로 보이는 내용입니다." |
| 빈 상태 | 파선 상자 "아직 등록된 답변이 없습니다." |
| 한 건 | `data-testid="inquiry-reply"`. `author_name`(굵게) · `created_at`(`formatDateTime`) · 본문(`whitespace-pre-line`) |
| 정렬 | `created_at` 오름차순(오래된 순) — 사용자 화면과 같은 순서 |

**웹 스레드는 `direction` 을 보지 않는다.** 회원 답장(inbound) 행이 생기면 운영자 답변과 **구분 없이** 같은 모양으로 그려진다(구분은 `author_name` 뿐). README §2.7 참고.

### 4.3 답변 스레드 — 이메일 (`InquiryEmailThreadItem`)

| 요소 | 값 |
|---|---|
| 카드 제목 | `스레드 {N}건` |
| 설명 | "받은 메일과 보낸 답신입니다. 보낸 답신은 사용자의 메일 주소로 발송됩니다." |
| 빈 상태 | "아직 주고받은 메일이 없습니다." |
| 방향 | inbound = 왼쪽 정렬 + `Badge neutral` "받은 메일" / outbound = 오른쪽 정렬 + `Badge accent` "보낸 답신". **정렬과 문구를 함께** 쓴다(색만으로 판단하지 않게) |
| 발송 상태 | `delivery_status` → `queued` "대기"(neutral) · `sent` "발송됨"(success-green) · `failed` "실패"(danger). null 이면 뱃지 없음(= 발송 대상이 아님) |
| 다시 보내기 | `canWrite && delivery_status === 'failed'` 일 때만 버튼. '대기'에는 세우지 않는다 — 결과를 기다리는 중에 누르면 같은 메일이 두 통 간다 |

**다시 보내기 동작** — `resendInquiryEmailAction`(`admin/lib/actions/inquiry-email-actions.ts`). 확인 다이얼로그 없음(되돌리기 어려운 조작이 아니다). 버튼 문구 "다시 보내기" / "보내는 중…".

| 검사 | 실패 문구 |
|---|---|
| `z.uuid('답신을 찾을 수 없습니다.')` | 필드 오류 문구 그대로 |
| 행 없음 | "답신을 찾을 수 없습니다." |
| `direction !== 'outbound'` | "받은 메일은 다시 보낼 수 없습니다." |
| `delivery_status` 가 `null·queued·failed` 밖 | "이미 발송된 답신입니다." |
| 문의의 `source !== 'email'` | "이메일 문의가 아닙니다. 답신을 메일로 보낼 수 없습니다." |
| 함수 503 | `EMAIL_NOT_CONFIGURED_MESSAGE` |
| 그 밖 | "메일을 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요." |

성공 토스트 "답신 메일을 다시 보냈습니다.", 감사 `inquiry.email.resend`(after 에 결과 문자열), `revalidatePath('/inquiries/[id]')`.

## 5. 상태·뱃지 의미

| 뱃지 | 언제 | 톤 |
|---|---|---|
| 상태 4종 / 접수 취소 | README §2.2 | neutral · info-blue · success-green · muted |
| 미배정 | `assigned_to is null` | warn |
| 내 담당 닉네임 | `assignee.id === admin.id` | accent(+ "내가 담당" 문구) |
| 남의 담당 닉네임 | 그 밖 | neutral |
| 받은 메일 / 보낸 답신 | `inquiry_replies.direction` | neutral / accent |
| 대기 / 발송됨 / 실패 | `delivery_status` | neutral / success-green / danger |
| SPF·DKIM·DMARC | `email_auth` | success-green(pass) / warn(fail) / neutral |

## 6. 클라이언트와의 상호작용

- 스레드 공유: 이 화면의 답변과 사용자 사이트 `/support/inquiries/[id]`(`components/support/InquiryReplyThread`)는 **같은 `inquiry_replies` 행**을 각자 세션으로 읽는다. 캐시가 없어 답변을 등록하면 사용자 상세에 즉시 보인다.
- 사용자가 보는 것과 다른 점: 사용자 화면은 `author_name` · 본문 · 날짜만 그린다. 담당자·잠금·내부 메모·발송 상태·인증 판정은 전부 관리자 전용이다.
- 답변이 없을 때 사용자에게 나가는 안내는 상태별로 갈린다(`resolveNoReplyNotice`): 접수 취소 → "접수가 취소된 문의입니다." / 종료 → "운영자 검토 후 종료된 문의입니다. 추가 문의는 새 1:1 문의로 남겨 주세요." / 처리 중 → "운영자가 처리 중입니다. 답변이 등록되면 이곳에 표시됩니다." / 그 밖 → "운영자가 확인 중입니다. …".
- 사용자의 수정·취소 권한: **접수 대기** 상태에서만 `/support/inquiries/[id]/edit`(`updateInquiry`) 와 접수 취소(`cancelInquiry`)가 열린다. 담당자 배정으로 상태가 '처리 중'이 되는 순간 수정은 닫힌다(취소는 처리 중까지 가능).
- 마지막 방어선은 DB다: `guard_inquiry_owner_update()`(SECURITY **INVOKER**)가 소유자 UPDATE 를 "접수 대기 본문 수정"과 "접수 취소(대기·처리 중 → 종료)"로만 좁히고, `answered_at · contact_email · privacy_consent · assigned_* · editing_* · inquiry_no · user_replied_at` 을 조용히 옛 값으로 되돌린다.
- 상태 변경은 사용자 목록의 뱃지 색과 문구를 그대로 바꾼다(두 앱의 라벨이 같은 문자열이다).

## 7. 오류·예외

| 상황 | 결과 |
|---|---|
| 존재하지 않는 id / uuid 아님 | `notFound()` → 404 |
| 상태 변경: 스냅샷 불일치 | `{ formError: INQUIRY_CONFLICT_MESSAGE, code: 'conflict' }` — "다른 운영자가 먼저 처리했습니다. 최신 내용을 확인해 주세요." |
| 상태 변경: 같은 상태 | "이미 같은 상태입니다. 상태는 바뀌지 않았습니다." |
| 상태 변경: 전이표 위반(직접 POST) | `{from} 상태에서는 {to}로 바꿀 수 없습니다.` |
| 상태 변경: UPDATE 실패 | "상태를 바꾸지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." |
| 취소된 문의에 조작 | "사용자가 접수를 취소한 문의입니다. 상태 변경과 답변 등록을 할 수 없습니다." (액션·RPC 양쪽에서) |
| 배정: 같은 담당자 | "이미 이 운영자가 담당하고 있습니다." |
| 배정: 대상이 관리자가 아님(직접 POST) | "관리자만 담당자로 지정할 수 있습니다." |
| 해제: 이미 미배정 | "이미 담당자가 없습니다." |
| 첨부 서명 실패 | 그 항목만 "(링크 발급 실패)" — 나머지는 정상 |
| 첨부 jsonb 원소가 깨짐 | `toAttachments()` 가 그 원소를 버린다(`path` 가 없으면 제외) |
| 답변 조회 실패 | `console.error('[inquiries] 답변 조회 실패')` + 빈 목록(본문은 그대로 보인다) |
| 메모 조회 실패 | 빈 목록 |
| `direction`·`delivery_status` 가 제약 밖의 값 | 각각 `outbound` · 상태 없음으로 떨어뜨린다 |
| 종료 상태 | 답변 폼 대신 안내: "종료된 문의입니다. 답변을 이어가려면 상태를 '처리 중'으로 되돌려 주세요." |
| 읽기 전용 관리자 | 상태 select·종료·담당자 컨트롤·답변 폼·메모 입력·메모 삭제가 전부 렌더되지 않는다(스레드·메모 열람은 가능) |
