-- =============================================================================
-- 20260909000300_email_inquiries
-- 이메일 문의(docs/admin/EMAIL-INQUIRY-PLAN.md §4).
--
-- 기존 inquiries · inquiry_replies 에 열을 더해 이메일로 들어온 문의를 1:1 문의와
-- 같은 화면·권한·감사 로그로 처리한다. 별도 테이블을 두지 않는 이유는 기획서 §4.
--
--   1) inquiries        — source / email_* / email_thread_key + 유니크 부분 인덱스
--   2) 동의 제약 완화    — 이메일 문의는 폼 체크박스를 거치지 않는다(§8 접수 확인 메일 고지)
--   3) inquiry_replies  — direction / email_message_id / delivery_status
--   4) email_inbound_events — 웹훅 전달(svix-id) 중복 제거용. 서비스 롤 전용
--   5) inquiry-attachments 버킷 허용 MIME 확장(zip · txt · webp)
--
-- 웹훅의 insert 는 서비스 롤이라 RLS 를 타지 않는다. 관리자 읽기·쓰기는 기존
-- inquiries_select_admin · inquiry_replies_admin_all 이 그대로 연다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. inquiries
-- -----------------------------------------------------------------------------
alter table public.inquiries
  add column if not exists source text not null default 'web',
  add column if not exists email_from text,
  add column if not exists email_from_name text,
  add column if not exists email_message_id text,
  add column if not exists email_auth jsonb,
  add column if not exists email_thread_key text;

alter table public.inquiries drop constraint if exists inquiries_source_check;
alter table public.inquiries
  add constraint inquiries_source_check check (source in ('web', 'email'));

comment on column public.inquiries.source is
  '접수 경로. web = 사용자 사이트 1:1 문의 폼, email = 수신 웹훅(Edge Function email-inbound).';
comment on column public.inquiries.email_from is
  '발신자 메일 주소(표시용 · 회신 대상). 위조 가능하므로 회원 식별에는 쓰지 않는다(user_id 는 항상 null).';
comment on column public.inquiries.email_from_name is
  '발신자 표시 이름(From 헤더의 이름 부분). 없으면 null.';
comment on column public.inquiries.email_message_id is
  '원본 메일의 Message-ID. 제공자 재시도가 같은 메일을 두 번 접수하지 않게 유니크로 잡는다.';
comment on column public.inquiries.email_auth is
  '제공자가 준 SPF/DKIM/DMARC 판정 { spf, dkim, dmarc } 그대로. 차단 근거가 아니라 콘솔의 "인증 실패" 뱃지용.';
comment on column public.inquiries.email_thread_key is
  'reply+<key>@ 회신 주소에 쓰는 무작위 토큰(24자 url-safe). 사용자의 회신을 이 문의에 붙이는 열쇠.';

create unique index if not exists inquiries_email_message_id_key
  on public.inquiries (email_message_id)
  where email_message_id is not null;

create unique index if not exists inquiries_email_thread_key_key
  on public.inquiries (email_thread_key)
  where email_thread_key is not null;

-- 발신자별 시간당 상한(§5-9) 판정과 접수 확인 메일 1일 1회 판정이 이 인덱스를 탄다.
create index if not exists inquiries_email_from_created_idx
  on public.inquiries (email_from, created_at desc)
  where email_from is not null;

-- 사이드바 프리셋(/inquiries?source=email)과 출처 필터.
create index if not exists inquiries_source_status_created_idx
  on public.inquiries (source, status, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. 개인정보 동의 제약 완화
-- 이메일 문의는 폼의 체크박스를 거치지 않는다. 동의는 접수 확인 메일의 방침 고지로 대체한다.
-- -----------------------------------------------------------------------------
alter table public.inquiries drop constraint if exists inquiries_privacy_consent_required;
alter table public.inquiries
  add constraint inquiries_privacy_consent_required
  check (privacy_consent or source = 'email');

-- -----------------------------------------------------------------------------
-- 3. inquiry_replies
-- -----------------------------------------------------------------------------
alter table public.inquiry_replies
  add column if not exists direction text not null default 'outbound',
  add column if not exists email_message_id text,
  add column if not exists delivery_status text;

alter table public.inquiry_replies drop constraint if exists inquiry_replies_direction_check;
alter table public.inquiry_replies
  add constraint inquiry_replies_direction_check check (direction in ('outbound', 'inbound'));

alter table public.inquiry_replies drop constraint if exists inquiry_replies_delivery_status_check;
alter table public.inquiry_replies
  add constraint inquiry_replies_delivery_status_check
  check (delivery_status is null or delivery_status in ('queued', 'sent', 'failed'));

comment on column public.inquiry_replies.direction is
  'outbound = 운영자 답변(웹 문의는 전부 이것), inbound = 사용자가 메일로 보낸 회신(이메일 문의만).';
comment on column public.inquiry_replies.email_message_id is
  'outbound 는 제공자가 돌려준 발송 id, inbound 는 원본 Message-ID. 배달 이벤트·스레드 판정이 이 값으로 행을 찾는다.';
comment on column public.inquiry_replies.delivery_status is
  '발신 답변의 배달 상태 queued | sent | failed. 웹 문의 답변과 inbound 는 null.';

-- 배달 이벤트(email.sent · bounced …)와 In-Reply-To 스레드 판정이 이 값으로 찾는다.
-- 같은 메일이 두 번 붙지 않도록 유니크.
create unique index if not exists inquiry_replies_email_message_id_key
  on public.inquiry_replies (email_message_id)
  where email_message_id is not null;

-- -----------------------------------------------------------------------------
-- 4. email_inbound_events
-- 웹훅 전달 단위(svix-id)의 중복 제거. 제공자는 2xx 를 받기 전까지 재시도하므로
-- 같은 전달이 두 번 처리되는 것을 여기서 막는다. 서비스 롤만 읽고 쓴다.
-- -----------------------------------------------------------------------------
create table if not exists public.email_inbound_events (
  id text primary key,
  received_at timestamptz not null default now()
);

comment on table public.email_inbound_events is
  '수신 웹훅 전달 id(svix-id 또는 제공자 이벤트 id). 멱등 처리용. Edge Function(서비스 롤)만 쓴다.';
comment on column public.email_inbound_events.id is
  'svix-id 헤더 값. 같은 전달의 재시도는 같은 id 로 온다.';

alter table public.email_inbound_events enable row level security;

revoke all on public.email_inbound_events from anon;
revoke all on public.email_inbound_events from authenticated;
grant all on public.email_inbound_events to service_role;

-- -----------------------------------------------------------------------------
-- 5. inquiry-attachments 버킷 — 이메일 첨부 허용 목록(§5-6: 이미지 · PDF · zip · txt)
-- 버킷 수준 allowed_mime_types 가 함수의 허용 목록보다 좁으면 업로드가 400 으로 막힌다.
-- -----------------------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'application/zip', 'text/plain'
]
where id = 'inquiry-attachments';
