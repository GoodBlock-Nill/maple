# 답변 작성 폼 (`/inquiries/[id]` 하단)

> 07 고객지원 › 상세의 마지막 카드. 헤더·메타·스레드는 [03-detail.md](03-detail.md).

**목적** 사용자(또는 메일 발신자)가 그대로 읽을 문장을 쓰고, 등록과 동시에 상태를 옮긴다. 여러 운영자가 같은 문의를 동시에 잡았을 때의 안내(잠금)와 마지막 방어선(충돌 감지)이 이 폼에 모여 있다.

**데이터 출처**
- 컴포넌트: `admin/components/inquiries/InquiryReplyForm.tsx`(클라이언트). 상세 페이지가 `canWrite && !isLocked && status !== 'closed'` 일 때만 그린다.
- 넘겨받는 값: `inquiryId` · `adminId` · `adminNickname` · `isEmail` · `templates`(`getInquiryReplyTemplateOptions(inquiry.category)`) · `inquiry`(자리표시자 치환용 `{id, inquiryNo, title, category, nickname}`) · `snapshot`(`{replyCount, status, updatedAt}` — **화면에 그려진 스레드**의 값).
- 문구: `admin/components/inquiries/inquiry-reply-copy.ts` 가 웹/이메일 두 벌을 갖는다.
- 잠금·폴링: `use-inquiry-edit-lock.ts` → `claimInquiryEditAction` / `releaseInquiryEditAction` / `readInquiryCollabAction`.

## 1. 카드 머리글

| 항목 | 웹 문의 | 이메일 문의 |
|---|---|---|
| 제목 | 답변 작성 | 답변 작성 |
| 설명 | "등록하면 사용자의 '내 문의 내역' 화면에 바로 표시됩니다." | "저장한 답신은 사용자의 메일 주소로 발송되고 이 스레드에 남습니다." |

문구를 나눈 이유: 이메일은 **되돌릴 수 없는 발송**이다. "답변 등록"으로만 적혀 있으면 운영자가 콘솔 안에만 남는 메모로 오해하고 계정 정보를 적을 수 있다.

## 2. 배너 (조건부, 폼 맨 위)

| 배너 | 조건 | 문구 · 동작 |
|---|---|---|
| 작성 중 잠금 | 다른 운영자의 **살아 있는** 잠금 (`lockedBy !== null`) | 문구·활동 표기 규칙(아래) |
| 스레드 오래됨 | 판정 조건(아래) | 문구·동작(아래) |
| 폼 오류 | `state.formError` | `FormBanner` |

**동작 상세**
- **작성 중 잠금(문구)** — `data-testid="inquiry-edit-lock"`, `role="status"`. "**{닉네임}** 관리자가 답변을 작성하고 있습니다 ({활동 표기})" + 버튼 "그래도 이어서 작성"(진행 중 "가져오는 중…"). 활동 표기는 `lockActivityLabel()`: 1분 미만 "방금 활동", 그 밖 "{n}분 전 활동", 시각이 없거나 파싱 실패면 "활동 시각 없음".
- **스레드 오래됨(조건)** — 폴링 값이 스냅샷보다 **앞서** 있을 때 (`collab.replyCount > snapshot.replyCount` 또는 `Date.parse(collab.updatedAt) > Date.parse(snapshot.updatedAt)`).
- **스레드 오래됨(문구)** — `data-testid="inquiry-thread-stale"`. "다른 운영자가 이 문의를 처리했습니다. 최신 내용을 확인한 뒤 이어서 작성해 주세요." + 버튼 "최신 내용 보기"(`router.refresh()` — 서버 컴포넌트만 다시 받아 오므로 초안은 남는다).

'앞서 있는가'로 재는 이유: 폴링 응답은 내가 방금 한 조작보다 늦게 도착할 수 있다. 단순 불일치로 두면 **내가 바꾼 값 때문에** "다른 운영자가 처리했습니다"가 뜬다(2026-09-11 실제 발생).

## 3. 템플릿 불러오기 (`InquiryReplyTemplatePicker`)

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 템플릿 선택 | select (폼 필드 아님) | — | "템플릿 선택"(빈 값) | 선택지 구성 규칙(아래) |
| 불러오기 | 버튼(secondary, sm) | 선택 전에는 비활성 | — | 답변 칸이 **비어 있으면 곧바로** 치환해 넣고, 글이 있으면 확인 다이얼로그를 연다 |
| (선택지 0개일 때) | 안내문 | — | — | 안내 문구·링크(아래) |

**동작 상세**
- **템플릿 선택** — 선택지 = 공통 + 이 문의 카테고리의 **활성** 템플릿. 공통 항목은 `[공통] {이름}` 으로 적고 공통을 앞에 둔다.
- **(선택지 0개일 때)** — "이 카테고리에서 쓸 수 있는 답변 템플릿이 없습니다. **답변 템플릿 관리**에서 등록할 수 있습니다." — 뒷말이 `/inquiries/reply-templates` 링크다([08-reply-templates.md](08-reply-templates.md)).

**확인 다이얼로그** — 제목 "템플릿 적용" · 설명 "작성 중인 답변이 지워집니다. 템플릿을 적용할까요? 쓰던 글을 두고 이어 붙이려면 '끝에 추가'를 누르세요." · 본문에 고른 템플릿 이름 · 버튼 3개.

| 버튼 | 결과 | 토스트 |
|---|---|---|
| 취소 | 아무 일 없음 | — |
| 끝에 추가(secondary) | 기존 글 `trimEnd()` + `\n\n` + 치환된 문안 | `'{이름}' 를 답변 끝에 추가했습니다.` |
| 템플릿으로 바꾸기(danger) | 답변 칸 전체 교체 | `'{이름}' 템플릿을 불러왔습니다.` |

**자리표시자 치환** — `applyReplyTemplate(body, inquiry)` (`admin/lib/utils/inquiry-reply-template.ts`). **불러오는 순간 한 번** 치환되며 저장되는 답변에는 원본 토큰이 남지 않는다(남으면 사용자 화면에 `{{닉네임}}` 이 그대로 노출된다).

| 토큰 | 값 | 값이 비었을 때 |
|---|---|---|
| `{{닉네임}}` | 문의한 회원의 닉네임(이메일 문의는 발신자 이름) | `고객` |
| `{{문의번호}}` | `#1024`(`formatInquiryNo`) | `-` |
| `{{카테고리}}` | 문의 카테고리 이름 | `문의` |
| `{{제목}}` | 문의 제목 | `문의` |

`{{ 공백 허용 }}` 패턴을 인식하고, **모르는 토큰은 그대로 둔다** — 운영자가 손으로 채우려고 적어 둔 표시일 수 있어 조용히 지우면 빈칸인 채로 발송된다.

## 4. 입력 필드

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| `inquiryId` | hidden | `z.uuid('문의를 찾을 수 없습니다.')` | 현재 문의 | — |
| `expectedReplyCount` | hidden | 정수 ≥0 아니면 `null`(비교 생략) | 화면을 연 시점의 답변 수 | 폴링 값 미사용 이유(아래) |
| `expectedStatus` | hidden | 빈 문자열이면 `null`, `isInquiryStatus` 밖이면 비교 생략 | 화면을 연 시점의 상태 | 같은 이유 |
| 답변 내용 | Textarea `content`, rows 7 | 필수·길이(아래) | 빈칸. placeholder "사용자가 그대로 읽는 문장입니다." | 상태 관리·hint(아래) |
| '운영자' 명의로 표시 | checkbox `useOperatorName` | `z.boolean()`(체크 없으면 키 자체가 오지 않는다 → false) | **체크됨** | 체크 시 `author_name='운영자'`, 해제 시 실제 닉네임. 라벨 옆에 "(해제하면 {내 닉네임})" |
| 등록 후 상태 | select `nextStatus` | `z.enum(['in_progress','answered'])`(`INQUIRY_REPLY_NEXT_STATUSES` 순서) | **`in_progress`(처리 중)** — 2026-09-14 기본값 변경(오너 지시, 휴먼 에러 방지) | 회원 답장 개폐 스위치(아래) |
| 제출 | 버튼 | write 권한. 남이 잠금을 쥐면 `disabled` | 웹 "답변 등록"/"등록 중…" · 이메일 "이메일로 답신 보내기"/"발송 중…" | §5 |

**동작 상세**
- **`expectedReplyCount`/`expectedStatus`** — **폴링 값으로 덮어쓰지 않는다** — 읽지 않은 새 답변을 "봤다"고 서버에 말하면 충돌 감지가 무력해진다.
- **답변 내용(필수·제한)** — `plainTextField(2000, …)` — CRLF→LF, trim 후 1~2000자. 빈 값 "답변 내용을 입력해 주세요." / 초과 "답변은 2000자를 넘을 수 없습니다."
- **답변 내용(동작)** — 값을 React 상태로 쥔다(템플릿 삽입 때 글자수 표시가 멈추지 않게). 남이 잠금을 쥐고 있으면 `disabled`. hint — 웹: "사용자의 '내 문의 내역' 화면에 평문으로 노출됩니다. 줄바꿈은 유지되고 마크다운은 해석되지 않습니다." / 이메일: "사용자의 메일 주소로 발송됩니다. 계정 정보나 개인정보는 적지 마세요."
- **등록 후 상태** — 답변을 넣은 뒤 이 상태로 전이한다. 이 선택이 곧 **회원 답장 대화의 개폐 스위치**다(§7) — 아래 안내 문구 한 줄이 셀렉트 밑에 선다: "처리 중: 회원이 이 문의에 답장할 수 있습니다 · 답변 완료: 대화가 닫히며 다시 열 수 없습니다".

성공하면 본문 상태를 직접 비우고(`setContent('')`) `form.reset()` 으로 체크박스·다음 상태를 기본값으로 되돌린 뒤 협업 상태를 즉시 다시 읽는다. `revalidatePath` 만으로는 클라이언트 상태인 입력값이 남아 같은 답변을 두 번 등록하기 쉽다.

## 5. 저장 경로 — `replyToInquiryAction`

`admin/lib/actions/inquiries-actions.ts`. 순서가 곧 안전장치다.

1. `requirePermission('inquiries','write')`
2. `inquiryReplySchema.safeParse(...)` → 실패 시 `fieldErrors`
3. `readInquiryState()` → 없으면 "문의를 찾을 수 없습니다."
4. `cancelledGuard()` → 취소된 문의면 거절
5. `status === 'closed'` → "종료된 문의에는 답변할 수 없습니다. 먼저 처리 중으로 되돌려 주세요."
6. **RPC `add_inquiry_reply()`** — INSERT 와 충돌 감지를 한 트랜잭션에 묶는다
7. 감사 로그 `inquiry.reply`(웹) / `inquiry.email.reply`(이메일) — `after: { inquiry_id, author_name, length }`(본문은 남기지 않는다)
8. 상태 전이(`applyStatusChange`, 현재 상태와 같으면 생략) → 감사 `inquiry.status`
9. `revalidateInquiry()`
10. 이메일이면 `sendInquiryReplyEmail(replyId)`

**INSERT 를 먼저 하고 상태를 옮긴다.** 뒤집으면 상태만 '답변 완료'로 바뀌고 답변이 실패해 "답변 완료인데 답변이 없는" 문의가 남는다.

### 5.1 `add_inquiry_reply()` 결과 코드별 화면 문구

RPC 인자: `p_inquiry_id · p_content · p_author_name · p_expected_reply_count · p_expected_status · p_delivery_status`(이메일이면 `'queued'`, 아니면 null). SECURITY **INVOKER** + 첫 줄 `is_admin()` 검사, `for update` 로 문의 행을 잡는다.

| `code` | 원인 | 화면 문구 | 후처리 |
|---|---|---|---|
| (ok) | 저장됨 | 성공 문구(아래) | 토스트 · 폼 비움 · 잠금 해제(RPC 가 내 `editing_by` 를 함께 지운다) |
| `conflict` | 화면을 연 시점의 답변 수·상태가 지금 DB 와 다르다 | `INQUIRY_CONFLICT_MESSAGE`(아래) | 후처리 규칙(아래) |
| `cancelled` | `cancelled_at` 이 찍혀 있다 | "사용자가 접수를 취소한 문의입니다. 상태 변경과 답변 등록을 할 수 없습니다." | — |
| `not_found` | 행이 사라졌다 | "문의를 찾을 수 없습니다." | — |
| 그 밖·모양 불명 | — | "답변을 등록하지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 저장해 주세요." | 개발자 로그에 `code=…` 를 남긴다 |
| RPC 자체 오류 | 네트워크·권한 | 위와 같은 문구 | `actionFailure('inquiries', …)` |

**동작 상세**
- **(ok) 화면 문구** — 웹 `답변을 등록하고 상태를 '{라벨}'로 바꿨습니다.` / 이메일 `답신을 이메일로 보내고 상태를 '{라벨}'로 바꿨습니다.`
- **`conflict` 화면 문구** — `INQUIRY_CONFLICT_MESSAGE` = "다른 운영자가 먼저 처리했습니다. 최신 내용을 확인해 주세요." + `code:'conflict'`.
- **`conflict` 후처리** — **초안은 그대로 두고** `router.refresh()` + 협업 상태 재조회. 분기는 문구가 아니라 코드로 한다.

기대값(`p_expected_*`)이 null 이면 RPC 는 비교를 **건너뛴다** — 충돌 감지는 보안 경계가 아니라 협업 장치라, 모르는 호출자(옛 탭·직접 POST)를 막는 것보다 저장을 잇는 편이 낫다.

### 5.2 부분 실패

| 상황 | 문구 |
|---|---|
| 답변은 저장됐지만 상태 전이 실패 | 문구(아래) |
| 이메일 발송 설정 없음(503) | `EMAIL_NOT_CONFIGURED_MESSAGE`(아래) |
| 이메일 발송 실패(그 밖) | 저장은 유지, 다시 보내기 가능(아래) |

- **답변은 저장됐지만 상태 전이 실패** — `답변은 등록했지만 상태를 바꾸지 못했습니다. 상태를 직접 {라벨}로 바꿔 주세요.`(답변을 되돌리지 않는다).
- **이메일 발송 설정 없음(503)** — `EMAIL_NOT_CONFIGURED_MESSAGE` = "이메일 발송 설정이 아직 없습니다. 답신은 저장되었고, 설정 후 '다시 보내기'로 발송할 수 있습니다."
- **이메일 발송 실패(그 밖)** — "답신은 저장했지만 메일을 보내지 못했습니다. 스레드에서 다시 보내기를 눌러 주세요." — 저장된 행은 `queued` 로 남아 스레드에서 다시 보낼 수 있다.

## 6. 작성 중 잠금(소프트 락)

`useInquiryEditLock({ inquiryId, adminId, enabled: true })`. **강제력이 없다** — 행을 진짜로 잠그면 브라우저를 닫고 간 운영자 때문에 문의가 영영 열리지 않는다.

| 타이밍 | 값 | 하는 일 |
|---|---|---|
| 마운트 | `setTimeout(0)` | `claim(false)` + 협업 상태 1회 조회 |
| 하트비트 | `INQUIRY_LOCK_HEARTBEAT_MS` = 60초 | `claim(false)` — 가로채지 않는다 |
| 폴링 | `INQUIRY_COLLAB_POLL_MS` = 20초 | `readInquiryCollabAction` → 상태·답변 수·담당자·잠금 갱신 |
| 만료 | `INQUIRY_LOCK_TTL_MS` = 5분 (DB `claim_inquiry_edit` 의 `interval '5 minutes'` 와 같은 값) | 하트비트가 끊기면 만료로 본다 |
| 이탈 | 언마운트 · `pagehide` | 조건·보장 한계(아래) |

- **이탈** — 내가 쥐고 있을 때만 `release`. **보장되지 않는다**(브라우저가 요청을 끊을 수 있다) — 진짜 안전망은 만료다.

| RPC | 규칙 |
|---|---|
| `claim_inquiry_edit(p_inquiry_id, p_force)` | 성공 조건·실패 형태(아래) |
| `release_inquiry_edit(p_inquiry_id)` | `editing_by = auth.uid()` 인 행만 푼다(아래) |

- **`claim_inquiry_edit`** — 성공 조건: 아무도 안 잡음 / 내가 이미 잡음 / 5분 만료 / `p_force`. 실패 시 `{ok:false, code:'locked', editing_by, editing_nickname, editing_at}`. `taken_over=true` 일 때만 감사 `inquiry.edit_lock`(before/after + `forced:true`).
- **`release_inquiry_edit`** — 남의 잠금을 풀 수 있으면 가로채기가 감사 로그 없이 두 단계로 우회된다.

액션이 RPC 오류를 만나면 **폼을 막지 않는다**(`{ ok:true, editingBy: actor.id }` 로 이어 간다) — 잠금은 편의 장치이고 마지막 방어선은 충돌 감지다.

## 7. 클라이언트와의 상호작용

- 등록한 답변은 사용자 사이트 `/support/inquiries/[id]` 의 답변 스레드에 **즉시** 나타난다(같은 테이블 직접 조회, 캐시 없음). 사용자는 `author_name` · 본문 · 날짜만 본다.
- 사용자 화면은 답변을 평문으로 그린다(`whitespace-pre-line`). 마크다운은 해석되지 않으므로 `**강조**` 는 기호째 노출된다 — 그래서 이 폼에도 편집기를 붙이지 않는다.
- '등록 후 상태'로 **처리 중**을 고르면 사용자 화면의 뱃지가 '처리 중'으로 남고, 운영자 답변이 1건 이상이므로 **회원이 같은 접수번호로 답장할 수 있다**(`InquiryUserReplyForm`이 뜬다). **답변 완료**를 고르면 뱃지가 '답변 완료'로 바뀌고 대화가 닫힌다 — `add_inquiry_user_reply` 가 `not_in_progress` 로 거절하고, `answered → in_progress` 전이가 없어 되돌릴 수 없다(README §2.7).
- 회원이 답장을 보내면 `inquiries.user_replied_at` 이 찍혀 관리자 목록·회원 상세에 "회원 답장" 뱃지가 붙고 `?awaiting=1` 필터에 걸린다. 운영자가 다시 답하면 트리거가 그 값을 null 로 되돌린다.
- 이메일 문의는 사용자 화면이 없다. 저장된 답신이 `email-outbound` 를 통해 실제 메일로 나가고, 제공자 웹훅이 `delivery_status` 를 갱신한다.
- 잠금·충돌·초안은 전부 관리자 쪽 개념이다. 사용자에게는 아무것도 보이지 않는다.

## 8. 오류·예외

| 상황 | 결과 |
|---|---|
| 내용 공백만 | 필드 오류 "답변 내용을 입력해 주세요." |
| 2000자 초과(직접 POST) | 필드 오류 "답변은 2000자를 넘을 수 없습니다." (브라우저는 `maxLength` 로 먼저 막는다) |
| 남이 잠금을 쥔 상태 | disabled·가로채기 규칙(아래) |
| 잠금 RPC 실패 | 콘솔 경고 후 폼은 정상 사용 |
| 폴링 실패 | 마지막으로 받은 값을 그대로 둔다(빈 배너로 깜빡이지 않게) |
| 저장 충돌 | 초안 유지 + 스레드만 갱신(§5.1) |
| 종료된 문의 | 폼 자체가 없고 안내문만(아래) |
| 취소된 문의 | 폼 자체가 없고 상단 취소 배너 |
| 읽기 전용 관리자 | 폼 자체가 없다 |
| 템플릿 0개 | 선택 상자 대신 등록 화면 링크 안내 |

- **남이 잠금을 쥔 상태** — 텍스트 영역과 제출 버튼이 `disabled`. "그래도 이어서 작성"으로 가로채면 풀린다(감사 로그가 남는다).
- **종료된 문의** — "종료된 문의입니다. 답변을 이어가려면 상태를 '처리 중'으로 되돌려 주세요."
