# 고객지원 — 화면·기능 설명 (문의 목록·상세·FAQ)

> 관리자 콘솔(`admin/`)의 고객지원 메뉴. 경로 · 권한 · 화면 구성 · 동작(서버 액션) · 클라이언트(사용자 사이트)와의 상호작용을 개발 참고용으로 정리한다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 파일 경로는 저장소 루트 기준. 워딩은 "카테고리"(말머리 금지).
> 카테고리·답변 템플릿 관리 화면은 `07b-support-categories-templates.md` 로 분리했다(길이 상한). 심화 문서: `docs/admin/INQUIRY-GUIDE.md`(다이어그램 포함 HTML도 있음), 이메일은 `docs/admin/EMAIL-INQUIRY-GUIDE.html`, 템플릿 세 갈래 비교는 `docs/admin/TEMPLATES-GUIDE.md`.

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/inquiries?source=web`(홈페이지 문의, 사이드바 기본) · `/inquiries?source=email`(이메일 문의) · `/inquiries/[id]`(상세) · `/faqs`. 관련: `/inquiries/categories` · `/inquiries/reply-templates`(→ 07b) |
| 권한 모듈 | 문의: `inquiries` — read/write. FAQ: `faqs` — read/write(별도 모듈, `admin/lib/auth/permissions.ts`) |
| 주요 테이블 | `inquiries`, `inquiry_replies`, `inquiry_notes`, `faqs` |
| 클라이언트 영향 | 문의는 캐시 태그 없음(세션마다 RLS로 직접 조회, 관리자·사용자 화면이 같은 데이터를 실시간으로 본다). FAQ는 태그 `faqs` 재검증 → 사용자 사이트 FAQ 즉시 반영 |
| 관련 파일 | `admin/app/(admin)/{inquiries,faqs}/**`, `admin/components/{inquiries,faqs}/*`, `admin/lib/{actions,data,validation}/{inquir*,faq*}.ts` |

## 1. 홈페이지 문의 목록 (`/inquiries?source=web`)

**목적** 사용자 사이트 폼(1:1 문의 · 버그제보 · 불법이용제보)으로 접수된 문의를 검색·필터링해 상세로 이동한다.

**화면 구성**
- 상태 탭(건수 포함): 미처리(기본, 접수 대기+처리 중) · 접수 대기 · 처리 중 · 답변 완료 · 종료 · 접수 취소 · 전체.
- 필터 폼(GET): 담당자(전체/내 담당/미배정/특정 운영자), 종류(1:1 문의·버그제보·불법이용제보), 카테고리(고른 종류의 것만), 유형(고른 카테고리의 세부 유형만, 카테고리 미선택 시 그 종류 전체), 등록일 범위(시작~종료), 검색(제목·내용·계정 ID + 접수번호는 `#1024`/`1024` 형태로 정확 일치도 함께 매칭).
- 표 열: 접수번호, 종류 뱃지, 제목, 계정(닉네임 + 마스킹한 계정 ID), 카테고리·유형, 담당자, 상태 뱃지, 답변 수, 등록일, 업데이트(상대 표기).
- "카테고리 관리" 버튼 → `/inquiries/categories`.
- 회원 상세의 "전체 보기"로 들어오면 `?user=<id>` 필터가 걸리고 화면 상단에 대상 회원 뱃지 + "해제" 링크가 뜬다.

**동작(서버 액션)**
이 화면 자체에는 쓰기 액션이 없다(목록·검색·필터뿐). 담당자 배정·상태 변경·답변은 상세(§3)에서 이뤄진다.

**클라이언트와의 상호작용**
- 사용자가 `/support`(1:1 문의) · `/support/bug`(버그제보) · `/support/report`(불법이용제보)에서 접수한 문의가 이 목록에 즉시 나타난다(`force-dynamic`, RLS `inquiries_select_admin` 이 관리자에게만 전체 조회를 연다).
- 취소된 문의(`cancelled_at` not null)는 '접수 취소' 탭에서만 보인다. 다른 탭(종료·전체 포함)은 그 문의를 뺀다 — 사용자 목록에서 사라진 문의가 운영자의 '종료'·'전체' 탭에 남아 두 화면의 뜻이 어긋나지 않게 하려는 것(2026-09-11 오너 결정).

**주의**
- 종류/카테고리/유형 필터는 서버 질의 조건으로 옮겨 판정한다(페이지네이션 어긋남 방지). 옵션 목록에는 지금은 비활성이거나 삭제된 "데이터에만 남은 옛 라벨"도 포함된다.
- 검색어의 콤마·괄호·`%`·`_` 등은 서버에서 제거한다(PostgREST 질의 문법·LIKE 와일드카드 오염 방지).
- 담당자 필터는 uuid 모양이 아니면 무시된다(= 전체).

## 2. 이메일 문의 목록 (`/inquiries?source=email`)

**목적** 이메일로 들어온 문의를 확인·검색한다. 목록 구조는 §1과 같고 프리셋만 다르다.

**화면 구성**
- §1과 같은 상태 탭 구조이나 **'접수 취소' 탭이 없다**(이메일 문의에는 취소할 사용자가 없다).
- 필터 폼에서 종류/카테고리/유형 선택 상자는 숨긴다 — 수신 함수가 `category='email'`, `type='general'` 로 고정해 넣고(화면 표기는 각각 "이메일", "일반"), 이 라벨은 등록된 카테고리와 매칭되지 않아 `kind` 는 컬럼 기본값인 `inquiry`(1:1 문의 창구)로 남는다. 고를 것이 없어 선택 상자 자체가 뜨지 않는다.
- 표의 "계정" 칸은 발신자 이메일 주소(모노스페이스) + SPF/DKIM/DMARC 중 하나라도 실패하면 "인증 실패" 뱃지.

**동작(서버 액션)**
이 화면 자체에는 쓰기 액션이 없다. 답신 발송·재발송은 상세(§3)에서 이뤄진다.

**클라이언트와의 상호작용**
- 수신은 `supabase/functions/email-inbound`(제공자 Resend 웹훅, Svix 서명 검증, 처리 성공/무시는 200·서명 불일치 401·설정 누락 503)가 받아 `inquiries`·`inquiry_replies` 에 저장한다.
- 답신 발송은 `supabase/functions/email-outbound`(관리자 서버 액션이 운영자 JWT로 호출, 발신 API 키는 이 함수의 secret에만 있고 관리자 앱은 들고 있지 않다)가 수행한다.
- 코드·DB·함수는 배포돼 있으나(`docs/admin/INQUIRY-GUIDE.md` §1.1 기준) 이메일 제공자 계정·DNS·secret 연동은 미완료 상태다.

**주의**
- 인증 실패 뱃지는 SPF·DKIM·DMARC 중 하나라도 `fail` 일 때만 뜬다. 판정이 없는 메일(`none`)은 실패로 보지 않는다 — 뱃지가 의미를 잃지 않도록.

## 3. 문의 상세 (`/inquiries/[id]`)

**목적** 문의 1건의 내용을 확인하고 담당자 배정, 답변 등록, 상태 변경, 내부 메모 작성 등 처리를 수행한다.

**화면 구성**
- 헤더: 제목 + (웹 문의) 접수번호·카테고리·유형 또는 (이메일) 접수번호·발신자, 상태 뱃지, 상태 변경 select(현재 상태에서 갈 수 있는 곳만), "종료" 버튼(확인 다이얼로그), 목록 버튼.
- 취소된 문의는 상단에 읽기 전용 안내 배너.
- **담당자 카드**: 미배정/닉네임 뱃지(+"내가 담당"), 배정일. 담당자 지정·변경·가로채기(남의 배정을 바꿀 때만 확인 다이얼로그), 배정 해제.
- **문의 정보 카드**(`InquiryMeta`): 메타데이터.
- **문의 내용 카드**: 평문 본문(줄바꿈만 유지) + 첨부(이미지 썸네일 클릭 시 원본 미리보기, 영상은 `preload="metadata"` 인라인 재생, 그 외는 다운로드 링크 — 모두 5분 유효 서명 URL).
- **답변 스레드**(`InquiryReplyThread`): 이메일 문의는 수신(inbound)/발신(outbound) 방향과 발송 상태(queued/sent/failed)를 함께 보여준다.
- **내부 메모 카드**: 운영자 전용(사용자·메일 어디에도 노출 안 됨), 최신순, 본인이 남긴 메모만 삭제 가능.
- **답변 작성 폼**(쓰기 권한 + 종료 상태 아닐 때만 노출): 템플릿 불러오기(§07b), 답변 내용(2000자), "운영자 명의로 표시" 체크박스(해제 시 실제 닉네임), 등록 후 상태(답변 완료/처리 중), 작성 중 잠금 배너, 스레드 오래됨 배너.

**동작(서버 액션)**

| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 상태 변경 / 종료 | `updateInquiryStatusAction` (`admin/lib/actions/inquiries-actions.ts`) | zod `inquiryStatusSchema` + 상태 전이표(`INQUIRY_STATUS_TRANSITIONS`) + 스냅샷 충돌 검사 | `inquiries.status`(+`answered_at`, 최초 답변 완료 전이 시만) | `inquiry.status` | 없음(문의 상세·목록 즉시 재검증) |
| 답변 등록 | `replyToInquiryAction` (같은 파일) | zod `inquiryReplySchema`(내용 필수 ≤2000자) | RPC `add_inquiry_reply()` → `inquiry_replies` insert(한 트랜잭션에서 스레드 충돌 재검사) + 성공 시 상태 전이 | `inquiry.reply` 또는 `inquiry.email.reply` | 없음. 이메일이면 저장 뒤 `email-outbound` 로 실제 메일도 발송 |
| 이메일 답신 다시 보내기 | `resendInquiryEmailAction` (`inquiry-email-actions.ts`) | zod(`replyId`), 방향(outbound)·발송상태(대기/실패만)·출처(이메일) 재검증 | `inquiry_replies.delivery_status` 등(edge function 호출 결과) | `inquiry.email.resend` | 없음 |
| 담당자 배정 | `assignInquiryAction` (`inquiry-assignment-actions.ts`) | zod `inquiryAssignSchema`, 대상이 실제 관리자인지 재확인 | `inquiries.assigned_to`, `assigned_at`(미배정+접수대기면 상태도 처리중으로 자동 승격) | `inquiry.assign` | 없음 |
| 담당자 배정 해제 | `unassignInquiryAction` | zod `inquiryUnassignSchema` | `inquiries.assigned_to=null`, `assigned_at=null` | `inquiry.unassign` | 없음 |
| 작성 중 잠금 획득/하트비트 | `claimInquiryEditAction` (`inquiry-lock-actions.ts`, 인자 기반 액션) | `force` 플래그로 가로채기 여부 결정 | RPC `claim_inquiry_edit()` → `inquiries.editing_by`, `editing_at` | 가로채기(`taken_over`)일 때만 `inquiry.edit_lock` | 없음(20초 폴링으로 화면 배너 갱신) |
| 작성 중 잠금 해제 | `releaseInquiryEditAction` | - | RPC `release_inquiry_edit()` | 없음 | 없음 |
| 내부 메모 등록 | `createInquiryNoteAction` (`inquiry-note-actions.ts`) | zod `inquiryNoteSchema`(≤2000자) | `inquiry_notes` insert | `inquiry_note.create` | 없음 |
| 내부 메모 삭제 | `deleteInquiryNoteAction` | zod `inquiryNoteDeleteSchema`, 작성자 본인만 | `inquiry_notes` delete | `inquiry_note.delete` | 없음 |

**클라이언트와의 상호작용**
- 이 화면의 답변 스레드와 사용자 사이트 `/support/inquiries/[id]` 는 같은 `inquiry_replies` 테이블을 세션마다 직접 읽는다(별도 캐시 없음) — 운영자가 답변을 등록하면 사용자 상세에 즉시 보인다.
- 사용자는 **접수 대기** 상태에서만 스스로 문의를 수정(`app/(public)/support/inquiries/[id]/edit`, 액션 `updateInquiry`)하거나 취소(`cancelInquiry`, `lib/actions/inquiry-edit-actions.ts`)할 수 있다. 담당자 배정·답변·상태 전이로 처리가 시작되면 DB 가드(`guard_inquiry_owner_update()`)가 사용자의 수정·취소 UPDATE 를 42501 로 거절한다 — 화면·액션·DB 세 겹의 마지막 방어선이다.
- 취소된 문의는 관리자 쪽에서도 상태 변경·답변·배정·잠금이 전부 막힌다(§주의).
- **작성 중 잠금**: 다른 운영자가 답변 폼을 열어 두면(5분 TTL, 60초마다 하트비트 갱신, 이 화면은 20초마다 폴링) "OOO 관리자가 답변을 작성하고 있습니다" 배너가 뜬다. "그래도 이어서 작성"으로 가로챌 수 있고, 그 경우에만 감사 로그(`inquiry.edit_lock`)가 남는다. 잠금은 강제력이 없다 — 최종 방어선은 아래 충돌 감지다.
- **저장 충돌 감지**: `add_inquiry_reply()` RPC가 화면을 연 시점의 스냅샷(답변 수·상태)과 지금 DB를 한 트랜잭션에서 비교한다. 다르면 `conflict` 코드로 거절하고, 화면은 작성 중이던 초안은 유지한 채 스레드만 새로 고친다. 상태 변경(`updateInquiryStatusAction`)도 같은 스냅샷 비교를 액션 진입 시 한 번 더 한다.

**주의**
- 종료된 문의에는 답변할 수 없다(먼저 '처리 중'으로 되돌려야 한다). 상태 전이 가능 경로: `pending→{in_progress,answered,closed}`, `in_progress→{answered,closed}`, `answered→{closed}`, `closed→{in_progress}`(되돌리기는 이 하나뿐).
- 답변은 **INSERT를 먼저 하고 그 다음 상태를 옮긴다.** 순서를 뒤집으면 상태만 바뀌고 답변이 실패하는 경우 "답변 완료인데 답변이 없는" 문의가 생긴다.
- 이메일 문의에는 `user_id` 가 없다(발신자 위조로 회원을 사칭하는 것을 막기 위해 일부러 채우지 않는다) — 닉네임 칸에는 발신자 이름/주소를 대신 보여준다.
- 첨부 서명 URL은 5분 후 만료된다(비공개 버킷 `inquiry-attachments`, 관리자·본인만 서명 가능한 RLS).
- 자리표시자(`{{닉네임}}` `{{문의번호}}` `{{카테고리}}` `{{제목}}`)는 템플릿을 "불러오기" 하는 순간 실제 값으로 치환되고, 저장되는 답변에는 원본 토큰이 남지 않는다(공급 상세는 07b 참고).

## 4. FAQ (`/faqs`)

**목적** 사용자 사이트 "자주 묻는 질문"에 노출할 항목을 카테고리별로 관리한다.

**화면 구성**
- 카테고리 5개(공지사항/계정/결제/버그/기타) 섹션, 섹션 안에서 ▲▼ 순서 이동 후 "순서 저장"(카테고리별 독립 버튼).
- "FAQ 등록"(쓰기 권한자): 카테고리 select, 질문(≤200자), 답변(≤2000자, 평문 + 아래 미리보기), "사용자 사이트에 발행" 체크박스.
- 항목별 발행 토글, 수정, 삭제.

**동작(서버 액션)**

| 동작 | 액션 함수 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 등록 | `createFaqAction` (`admin/lib/actions/faqs-actions.ts`) | zod `faqSchema` | `faqs` insert(카테고리 맨 뒤 순번) | `faq.create` | 태그 `faqs` 재검증 |
| 수정 | `updateFaqAction` | zod `faqSchema` | `faqs` update(카테고리를 옮기면 새 카테고리 맨 뒤로 순번 재계산) | `faq.update` | 태그 `faqs` |
| 삭제 | `deleteFaqAction` | - | `faqs` delete | `faq.delete` | 태그 `faqs` |
| 발행/미발행 토글 | `toggleFaqPublishAction` | - | `faqs.is_published` | `faq.publish` | 태그 `faqs` |
| 순서 저장 | `reorderFaqsAction` | zod `faqReorderSchema`(카테고리 + id 목록) | `faqs.sort_order`(그 카테고리 안 0..n-1) | `faq.reorder` | 태그 `faqs` |

**클라이언트와의 상호작용**
- 사용자 사이트 FAQ 페이지는 이 데이터를 `unstable_cache`(300초)로 읽는다. 모든 쓰기 액션이 `revalidateClient([CLIENT_CACHE_TAGS.faqs])` 를 호출해 즉시 반영을 시도하고, 실패해도 최대 5분 뒤 자동 반영된다.
- 미발행 항목은 `faqs_select_published` RLS로 사용자 사이트에서 즉시 사라진다(관리자는 `faqs_admin_all` 로 미발행도 본다).

**주의**
- 답변은 평문이다. 사용자 사이트 아코디언이 `<p>{answer}</p>` 로 한 문단으로 그리므로 **줄바꿈도 표시되지 않는다**(관리자 폼 미리보기가 같은 규칙을 따른다).
- 카테고리의 표시 순서 자체(다섯 카테고리가 나열되는 순서)는 코드 상수(`FAQ_CATEGORIES`)가 소유한다 — DB `sort_order` 는 카테고리 **안**의 순서만 결정한다.
