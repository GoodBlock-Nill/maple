# 문의 대화 스레드(유저 답장) — 설계 (2026-09-14)

운영팀 요청: 1:1 문의·버그제보·불법이용제보에서 **운영자가 답변한 건에 한해** 유저가 같은 접수번호 안에서 운영자 요청에 답할 수 있어야 한다(새 문의 생성 없이). 텍스트·이미지·영상 첨부 가능.
오너 확정 규칙: **처리 중(in_progress) 상태에서만 유저 답장 가능. 답변 완료(answered)는 재개 불가.**

> 디자이너용 시각 가이드: `docs/reference/inquiry-thread-designer-guide.html` (공개 URL https://maple-admin.vercel.app/docs/inquiry-thread). 규칙이 바뀌면 함께 갱신한다.

## 1. 규칙
- 유저 답장 허용 조건(전부 만족): 본인 문의 · `cancelled_at is null` · `status = 'in_progress'` · 운영자 답변(`direction='outbound'`) 1건 이상 · 마지막 운영자 답변 이후 유저 답장 3건 미만 · 30초 쿨다운(기존 `remainingCooldown` 재사용).
- 운영자 답변 폼의 기존 "다음 상태" 선택이 곧 모드다: **처리 중** = 대화 유지(유저 답장 열림), **답변 완료** = 스레드 닫힘. `answered → in_progress` 전이는 없다(기존 `INQUIRY_STATUS_TRANSITIONS` 그대로: answered → closed 만). `closed → in_progress`(운영자 재개)는 기존대로 둔다.
- 유저 답장이 들어오면 `inquiries.user_replied_at` 이 찍히고, 운영자가 다시 답하면 null 로 돌아간다 → 관리자 목록·탭에서 "유저 답변 도착"을 바로 본다.
- 접수 대기(pending) 문의의 수정·접수 취소 규칙은 그대로. 유저 답장은 수정·삭제 불가.

## 2. 데이터 (마이그레이션 `20260914000400_inquiry_thread.sql`)
- `inquiry_replies.attachments jsonb not null default '[]'` + check(array, 길이 ≤ 5). 원소 형식은 `inquiries.attachments` 와 동일(`InquiryAttachment`: path·name·size·mimeType…, `lib/data/inquiries.ts toAttachments`).
- 유저 답장 = `inquiry_replies` 행에 `direction = 'inbound'`, `author_id = auth.uid()`, `author_name = 닉네임`, `delivery_status = null`. (이메일 인바운드도 inbound 라 `author_id` 유무로 구분: 웹 유저 답장은 author_id not null.)
- `inquiries.user_replied_at timestamptz null` + 부분 인덱스 `(user_replied_at) where user_replied_at is not null`.
- 트리거 `inquiry_replies_touch_inquiry` (after insert): inbound & author_id not null → `user_replied_at = new.created_at`; outbound → `user_replied_at = null`. 항상 `inquiries.updated_at = now()`.
- RPC `add_inquiry_user_reply(p_inquiry_id uuid, p_content text, p_attachments jsonb) returns jsonb` — SECURITY DEFINER(유저에게 inquiry_replies insert 권한을 열지 않기 위해), `set search_path = public`, `auth.uid()` 소유 검증, 위 규칙을 순서대로 검사해 `{ok:false, code:'not_owner'|'cancelled'|'not_in_progress'|'no_operator_reply'|'too_many'|'invalid'}` 또는 `{ok:true, reply_id}`. 내용 1~2000자(기존 `INQUIRY_CONTENT_MAX` 와 같은 값), 첨부 ≤ 5. grant execute to authenticated.
- RLS: `inquiry_replies_select_owner` 그대로(유저는 자기 문의의 답변을 읽는다). 유저 insert 정책은 만들지 않는다(RPC 만).
- 백필 없음(기존 행 attachments 기본값).
- `pnpm gen:types`.

## 3. 클라이언트
- 상세(`/support/inquiries/[id]`) 답변 영역 → **스레드**: 시간순으로 운영자 답변(기존 #f3f6fe 상자 + 머리줄 "글자월드 운영팀 | 일시")과 유저 답장(흰 상자 · border #cdd3db · 머리줄 "내 답변 | 일시")을 섞어 그린다. 각 메시지의 첨부는 기존 `InquiryAttachmentList` 방식(서명 URL, 이미지 썸네일·PDF·영상)으로 아래에.
- 허용 조건이 맞으면 스레드 아래 **답장 폼**(`InquiryUserReplyForm`, 클라이언트 컴포넌트): 내용 textarea(필수, ≤2000) + 첨부(기존 `InquiryAttachmentField` 재사용: 형식 무관 최대 5개 · 합계 200MB, 2026-09-14, 같은 안내 문구) + "답장 보내기" 버튼(183×54 스타일 동일). 서버 액션 `replyToInquiry(inquiryId, prev, formData)`: 로그인·쿨다운 → 파일 업로드(`uploadAttachments`)·영상 claim(`claimFormVideos`) → RPC → 실패 시 업로드 롤백(기존 패턴) → `revalidatePath` 상세 → 리다이렉트 `?replied=1`(1회성 안내 "답장을 보냈습니다").
- 허용되지 않을 때 안내 한 줄(파선 상자 톤): 답변 완료/종료 → "답변이 완료된 문의입니다. 추가 문의는 새 문의로 접수해 주세요."; 접수 대기 → "운영자 답변 후 답장할 수 있습니다."; 3건 초과 → "운영자 답변을 기다려 주세요."
- 목록 행 상태 pill 은 그대로(처리 중). 상세 메타 변화 없음.
- `InquiryReply` 타입에 `direction: 'outbound'|'inbound'`, `attachments`, `isMine` 추가. `getInquiryReplies` 가 `direction, author_id, attachments` 를 읽고 첨부 서명은 `getSignedAttachments` 재사용.

## 4. 관리자
- 상세 스레드(`InquiryReplyThread`): inbound 웹 답장을 "회원 답장" 라벨·다른 배경으로 구분(이메일 inbound 와 구분: author_id 유무). 첨부는 기존 `InquiryAttachments` 서명 방식 재사용(경로가 inquiry_replies.attachments 에서 옴).
- 답변 폼: 기존 "다음 상태" 선택에 안내 문구 추가 — "처리 중: 회원이 이 문의에 답장할 수 있습니다 / 답변 완료: 대화가 닫히며 다시 열 수 없습니다". 기본값은 현재 로직 유지.
- 목록: `user_replied_at` 을 읽어 "회원 답장 도착" 뱃지(상태 뱃지 옆) + 미처리 탭 정렬은 그대로. 필터 `?awaiting=1`(회원 답장 도착만) 체크박스 하나 추가. 회원 상세 문의 탭에도 뱃지.
- 답변 템플릿: 기존 문구 중 "새 문의로 접수해 주세요" 안내(20260914000300)는 **처리 중 대화가 열린 경우 부적절**해진다 → 마이그레이션에서 문구를 "이 문의에 답장으로 남겨 주세요(처리 중 상태에서 답장할 수 있습니다)" 로 되돌리되, 답변 완료 계열(처리 완료 안내·아이템 지급 처리 완료·데이터 복구 안내) 은 "추가 문의는 새 문의로" 유지.
- 감사 로그: 유저 답장은 감사 대상 아님(관리자 행위가 아님).

## 5. 테스트·문서
- 클라이언트 단위: RPC 결과 코드→문구 매핑, 스레드 렌더(양방향·첨부), 폼 노출 조건. e2e `support-inquiries.spec.ts`: 운영자 답변(서비스 롤로 outbound 삽입 + 상태 in_progress) → 유저 답장(텍스트+이미지) → 스레드 표시 → 답변 완료 후 폼 사라짐.
- 관리자 단위: awaiting 필터 파싱, 스레드 라벨. e2e `inquiries.spec.ts` 확장(회원 답장 뱃지).
- 문서: INQUIRY-GUIDE·CHANGELOG·screens/07-support.md 갱신.
