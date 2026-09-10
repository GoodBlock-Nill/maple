-- =============================================================================
-- 20260910000900_inquiry_account_id_required
-- 글자월드 계정 ID — 웹 폼에서 **필수**가 되면서 생긴 두 가지 정리.
--
-- 제품 결정(2026-09-11): 1:1 문의 접수의 필수 항목은 카테고리 · 세부 유형 ·
-- 글자월드 계정 ID · 제목 · 내용 · 개인정보 수집 동의다(첨부만 선택).
--
-- **새 컬럼을 만들지 않는다.** `inquiries.account_id` 가 이미 그 값이다 —
-- 20260908000400 의 주석이 "MSW 계정 ID 15자리. 본인 확인용이라 서식은 강제하지
-- 않는다" 고 못 박아 두었고, 사용자·관리자 화면이 모두 이 컬럼을 계정 ID 로 읽어
-- 마스킹까지 하고 있다(`lib/utils/mask.ts` · `admin/lib/validation/inquiries.ts`).
-- 같은 뜻의 컬럼을 하나 더 두면 "어느 쪽이 진짜인가"를 화면 · 검색 · 통계마다
-- 다시 정해야 한다.
--
-- 이 마이그레이션이 하는 일
--   1) 길이 제약(≤ 40자) — 앱 검증(`lib/validation/inquiry.ts` ACCOUNT_ID_MAX)과 같은 숫자
--   2) 컬럼 주석 갱신 — "선택 입력"이 아니라 "웹 폼 필수"임을 남긴다
--
-- **NOT NULL 은 걸지 않는다.** 이메일로 들어온 문의(`inquiry_email` 수신 함수)는
-- 계정 ID 를 알 방법이 없고, 필수가 되기 전에 접수된 문의에도 빈 값이 있다.
-- 필수는 웹 폼의 규칙이므로 그 경계(서버 액션 스키마)에서 강제한다.
-- =============================================================================

alter table public.inquiries
  drop constraint if exists inquiries_account_id_length;

alter table public.inquiries
  add constraint inquiries_account_id_length
  check (account_id is null or char_length(account_id) between 1 and 40)
  not valid;

/* 기존 행은 검사하지 않고 새로 들어오는 값에만 건다(`not valid`). 15자리 숫자만
   쌓여 있어 위반이 없을 것이 거의 확실하지만, 메일로 들어온 옛 행까지 훑다가
   마이그레이션이 멈추면 배포 전체가 막힌다. 아래에서 곧바로 검증하되, 실패해도
   원인을 눈으로 확인할 수 있게 단계를 나눠 둔다. */
alter table public.inquiries
  validate constraint inquiries_account_id_length;

comment on column public.inquiries.account_id is
  '글자월드 계정 ID(본인 확인용, ≤ 40자). 웹 폼에서는 필수이고 서식은 앱이 검사한다(영문·숫자·_·-). 이메일 문의와 필수가 되기 전의 옛 문의에는 값이 없어 컬럼은 nullable 이다.';
