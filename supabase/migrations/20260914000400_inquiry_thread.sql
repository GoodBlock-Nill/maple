-- =============================================================================
-- 20260914000400_inquiry_thread
-- 문의 대화 스레드 — **운영자가 답한 문의에 한해** 사용자가 같은 접수번호 안에서
-- 답장할 수 있게 한다(새 문의를 만들지 않는다).
--
-- 배경
--   추가 정보를 물으면 사용자는 답할 곳이 없었다. 그래서 같은 내용이 새 문의로 다시
--   들어오고, 운영자는 접수번호를 손으로 이어 붙여 읽었다. 대화를 한 행 묶음 안에
--   두면 그 왕복이 사라진다.
--
-- 오너 확정 규칙(docs/reference/inquiry-thread-spec.md §1)
--   **처리 중(in_progress) 에서만 답장할 수 있다. 답변 완료(answered)는 재개 불가.**
--   운영자 답변 폼의 "다음 상태" 선택이 곧 대화의 개폐 스위치다 — 처리 중이면 열리고
--   답변 완료면 닫힌다. `answered → in_progress` 전이는 만들지 않는다.
--
-- 이 마이그레이션이 다루는 여섯 가지
--   1) `inquiry_replies.attachments` — 답장에도 첨부(이미지·PDF 3 + 영상 2)
--   2) `inquiries.user_replied_at`   — "회원 답장 도착" 표시 + 부분 인덱스
--   3) 소유자 UPDATE 가드에 새 열 고정(사용자가 스스로 뱃지를 켜지 못하게)
--   4) `touch_inquiry_on_reply()`    — 답장 INSERT 가 문의 행을 건드린다
--   5) `add_inquiry_user_reply()`    — 사용자 답장 RPC(유일한 쓰기 경로)
--   6) 답변 템플릿 문구를 "이 문의에 답장으로" 로 되돌린다(20260914000300 되감기)
--
-- 왜 RPC 인가
--   사용자에게 `inquiry_replies` INSERT 를 열어 주면 정책 하나로 "누구의 문의에 ·
--   어떤 direction 으로 · 몇 건까지"를 전부 표현해야 한다. RLS 는 그 중 마지막
--   (직전 운영자 답변 이후 3건)을 깔끔히 쓰지 못한다. 쓰기 경로를 함수 하나로
--   좁히고 INSERT 정책은 **만들지 않는다**.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. inquiry_replies.attachments
--
-- 원소 모양은 `inquiries.attachments` 와 같다(`{ name, path, size, mimeType }` ·
-- `lib/data/inquiries.ts toAttachments`). 같은 버킷·같은 서명 URL 경로를 쓰므로
-- 화면 코드도 그대로 재사용된다.
--
-- 개수 규칙도 접수 폼과 같아야 한다 — 답장 칸만 관대하면 "접수할 때는 막히고 답장할
-- 때는 되는" 이상한 경계가 생긴다. 그래서 20260911000600 의
-- `inquiry_attachment_kind_count()` 를 **그대로 재사용**한다(이미지·PDF 3 + 영상 2,
-- 합계 5). 판정 기준이 한곳에 있어야 나중에 영상 상한을 고칠 때 한 번만 고친다.
-- -----------------------------------------------------------------------------
alter table public.inquiry_replies
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_is_array;
alter table public.inquiry_replies
  add constraint inquiry_replies_attachments_is_array
  check (jsonb_typeof(attachments) = 'array');

/* is_array 와 별개로 `jsonb_typeof <> 'array' or …` 를 한 번 더 쓰는 이유: 두 CHECK 가
   어떤 순서로 평가될지는 보장되지 않는다. 배열이 아닌 값이 들어오면
   `jsonb_array_length()` 가 먼저 터져 엉뚱한 오류 메시지를 남길 수 있다. */
alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_max_5;
alter table public.inquiry_replies
  add constraint inquiry_replies_attachments_max_5
  check (jsonb_typeof(attachments) <> 'array' or jsonb_array_length(attachments) <= 5);

alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_file_kind_max_3;
alter table public.inquiry_replies
  add constraint inquiry_replies_attachments_file_kind_max_3
  check (public.inquiry_attachment_kind_count(attachments, false) <= 3);

alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_video_kind_max_2;
alter table public.inquiry_replies
  add constraint inquiry_replies_attachments_video_kind_max_2
  check (public.inquiry_attachment_kind_count(attachments, true) <= 2);

comment on column public.inquiry_replies.attachments is
  '답변·답장의 첨부 목록(inquiries.attachments 와 같은 모양). 이미지·PDF 3개 + 영상 2개, 합계 5개까지. 기존 행은 빈 배열(백필 없음).';

-- -----------------------------------------------------------------------------
-- 2. inquiries.user_replied_at
--
-- "이 문의는 지금 **회원의 공이 넘어온 상태**인가"를 한 열로 답한다. 운영자가 다시
-- 답하면 null 로 돌아가므로(4의 트리거), 값이 있다는 것은 곧 미처리라는 뜻이다.
--
-- 답변 수를 세어 판정할 수도 있지만(마지막 행의 direction 보기), 목록 300행마다
-- 서브쿼리를 도는 대신 열 하나를 유지한다 — 목록·탭·뱃지가 전부 이 열만 읽는다.
-- 부분 인덱스로 두는 이유도 같다: 관심사는 "값이 있는 행"뿐이고, 그 쪽이 늘 소수다.
-- -----------------------------------------------------------------------------
alter table public.inquiries
  add column if not exists user_replied_at timestamptz;

comment on column public.inquiries.user_replied_at is
  '회원이 마지막으로 답장한 시각. 운영자가 다시 답하면 null 로 돌아간다 — 값이 있으면 "회원 답장 도착"(운영자 차례)이다.';

create index if not exists inquiries_user_replied_at_idx
  on public.inquiries (user_replied_at desc)
  where user_replied_at is not null;

-- -----------------------------------------------------------------------------
-- 3. 소유자 UPDATE 가드 — user_replied_at 고정
--
-- 사용자는 '접수 대기'인 자기 문의를 PATCH 할 수 있다(`inquiries_update_own`).
-- 새 열을 그대로 두면 사용자가 아무 때나 `user_replied_at` 을 실어 보내 관리자
-- 목록의 "회원 답장 도착" 뱃지를 켤 수 있다 — 답장하지 않고도 줄을 새치기한다.
-- 담당자·작성 중 잠금과 같은 처리(조용히 되돌리기)를 한다.
--
-- 본문은 20260911000400 과 같고 **마지막 한 줄만 늘었다**. SECURITY INVOKER 유지가
-- 핵심이다 — DEFINER 로 두면 current_user 가 함수 소유자로 평가되어 첫 분기가 항상
-- 참이 되고 가드가 통째로 무력화된다(20260908001000 사고).
-- -----------------------------------------------------------------------------
create or replace function public.guard_inquiry_owner_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_cancel_transition boolean;
  edits_content boolean;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.is_admin()
  then
    return new;
  end if;

  -- 접수 취소: 대기·처리 중 → 종료 + 같은 UPDATE 에서 cancelled_at 이 찍힌다.
  is_cancel_transition :=
    old.status in ('pending', 'in_progress')
    and new.status = 'closed'
    and old.cancelled_at is null
    and new.cancelled_at is not null;

  edits_content :=
    new.title       is distinct from old.title
    or new.category is distinct from old.category
    or new.type     is distinct from old.type
    or new.account_id is distinct from old.account_id
    or new.content  is distinct from old.content
    or new.attachments is distinct from old.attachments;

  if new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at
  then
    raise exception '문의의 소유자와 접수 시각은 바꿀 수 없습니다.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not is_cancel_transition then
    raise exception '문의 상태는 접수 취소(접수 대기·처리 중 → 종료)로만 바꿀 수 있습니다.'
      using errcode = '42501';
  end if;

  if new.cancelled_at is distinct from old.cancelled_at and not is_cancel_transition then
    raise exception '접수 취소는 되돌리거나 따로 지정할 수 없습니다.'
      using errcode = '42501';
  end if;

  if edits_content and (old.status <> 'pending' or old.cancelled_at is not null) then
    raise exception '접수 대기 상태의 문의만 수정할 수 있습니다.'
      using errcode = '42501';
  end if;

  -- 운영자만 채우는 값. 사용자가 실어 보내도 반영하지 않는다.
  new.answered_at := old.answered_at;
  new.contact_email := old.contact_email;
  new.privacy_consent := old.privacy_consent;
  -- 협업 열(20260911000300). 담당자·작성 중 잠금은 콘솔과 RPC 만 쓴다.
  new.assigned_to := old.assigned_to;
  new.assigned_at := old.assigned_at;
  new.editing_by := old.editing_by;
  new.editing_at := old.editing_at;
  -- 접수번호는 한 번 정해지면 끝이다(20260911000400).
  new.inquiry_no := old.inquiry_no;
  -- 답장 도착 표시는 트리거만 쓴다(20260914000400).
  new.user_replied_at := old.user_replied_at;

  return new;
end;
$$;

comment on function public.guard_inquiry_owner_update() is
  'SECURITY INVOKER 여야 한다. 소유자 UPDATE 를 "접수 대기 상태의 본문 수정"과 "접수 취소"로만 좁히고, 운영 컬럼(answered_at · 담당자 · 작성 중 잠금 · 접수번호 · 답장 도착 표시)은 되돌린다.';

-- -----------------------------------------------------------------------------
-- 4. set_inquiry_updated_at() — 명시적 수정 시각 존중(한 분기 추가)
--
-- 20260911000300 은 "잠금 열 말고 달라진 것이 없으면 updated_at 을 되돌린다"로
-- 하트비트가 목록 정렬을 흔드는 것을 막았다. 그 규칙이 5의 트리거와 부딪힌다:
-- 운영자가 **상태를 바꾸지 않고** 답변만 한 번 더 달면(user_replied_at 이 이미 null)
-- 문의 행에는 달라지는 값이 없어 `updated_at` 이 그대로 남는다 — 대화가 오갔는데
-- 목록의 '업데이트' 칸은 어제에 멈춘다.
--
-- 그래서 "호출자가 updated_at 을 **명시적으로** 밀었다"는 신호를 존중한다. 다만
-- 사용자가 PATCH 에 updated_at 을 실어 목록 맨 위에 자기 문의를 고정하는 길이
-- 열리면 안 되므로, 신뢰 롤(트리거·서비스 롤·마이그레이션)에서만 통과시킨다.
-- 하트비트 RPC(claim_inquiry_edit)는 updated_at 을 쓰지 않으므로 영향이 없다.
-- -----------------------------------------------------------------------------
create or replace function public.set_inquiry_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at is distinct from old.updated_at
     and current_user in ('postgres', 'supabase_admin', 'service_role')
  then
    -- 신뢰 롤이 수정 시각을 직접 지정했다(답장 트리거). 그 뜻을 그대로 둔다.
    return new;
  end if;

  if (to_jsonb(new) - 'editing_by' - 'editing_at' - 'updated_at')
     = (to_jsonb(old) - 'editing_by' - 'editing_at' - 'updated_at')
  then
    -- 잠금 하트비트만 달라졌다. 수정 시각은 그대로 둔다.
    new.updated_at := old.updated_at;

    return new;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

comment on function public.set_inquiry_updated_at() is
  'inquiries 전용 updated_at 트리거. 작성 중 잠금(editing_by · editing_at)만 바뀐 UPDATE 는 수정 시각을 밀지 않고, 신뢰 롤이 updated_at 을 명시적으로 지정한 UPDATE(답장 트리거)는 그 값을 존중한다.';

-- -----------------------------------------------------------------------------
-- 5. touch_inquiry_on_reply() — 답장 INSERT 가 문의 행을 건드린다
--
-- 세 갈래다.
--   * inbound + author_id not null  = **웹 유저 답장** → user_replied_at 을 찍는다
--   * inbound + author_id null      = 이메일 인바운드(20260909000300) → 표시하지 않는다
--     (이메일 문의는 운영자가 메일함에서 이어 읽는 흐름이라 뱃지 대상이 아니다)
--   * outbound                      = 운영자 답변 → user_replied_at 을 지운다(공이 넘어갔다)
-- 어느 쪽이든 `updated_at` 은 now() 로 민다 — 대화가 오간 것 자체가 변화다.
--
-- AFTER INSERT 인 이유: BEFORE 에서는 `new.created_at` 이 default 로 채워지기 전일 수
-- 있고, 실패할 수 있는 CHECK 들이 아직 통과하지 않았다. 답장이 거절되면 문의 행도
-- 건드리지 않아야 한다.
--
-- SECURITY DEFINER 인 이유: 이 트리거는 관리자 INSERT · 서비스 롤 INSERT · 사용자
-- RPC 세 경로에서 모두 돈다. 사용자 경로에서 `inquiries` UPDATE 는 RLS 로 막혀 있고
-- (소유자에게는 좁은 정책뿐이다), DEFINER 로 두면 세 경로가 같은 권한으로 같은 일을
-- 한다. 함수가 보는 것은 자기 인자(new)뿐이라 우회할 여지가 없다.
-- -----------------------------------------------------------------------------
create or replace function public.touch_inquiry_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inquiries
  set
    user_replied_at = case
      when new.direction = 'inbound' and new.author_id is not null then new.created_at
      when new.direction = 'outbound' then null
      else user_replied_at
    end,
    updated_at = now()
  where id = new.inquiry_id;

  return null; -- AFTER 트리거의 반환값은 쓰이지 않는다.
end;
$$;

comment on function public.touch_inquiry_on_reply() is
  '답변·답장 INSERT 후 문의 행을 갱신한다. 웹 유저 답장(inbound + author_id)은 user_replied_at 을 찍고, 운영자 답변(outbound)은 지운다. 언제나 updated_at 을 민다.';

drop trigger if exists inquiry_replies_touch_inquiry on public.inquiry_replies;
create trigger inquiry_replies_touch_inquiry
  after insert on public.inquiry_replies
  for each row execute function public.touch_inquiry_on_reply();

-- -----------------------------------------------------------------------------
-- 6. add_inquiry_user_reply(...) -> jsonb — 사용자 답장의 유일한 쓰기 경로
--
-- 검사 순서가 곧 화면 문구의 우선순위다. 위에서 걸리면 아래는 보지 않는다.
--   not_owner         내 문의가 아니다(없는 문의도 같은 코드로 답한다 — 아래 참고)
--   cancelled         접수 취소된 문의
--   not_in_progress   처리 중이 아니다(접수 대기 · 답변 완료 · 종료)
--   no_operator_reply 운영자 답변이 아직 없다
--   too_many          마지막 운영자 답변 이후 내 답장이 이미 3건이다
--   invalid           내용 1~2000자 · 첨부 5개(이미지·PDF 3 + 영상 2) 위반
--
-- **없는 문의를 not_found 로 구분하지 않는 이유**: 구분하면 이 함수가 "그 uuid 의
-- 문의가 존재하는가"를 알려 주는 조회기가 된다. 남의 문의든 없는 문의든 사용자에게
-- 돌아갈 대답은 하나여야 한다.
--
-- `for update` 로 문의 행을 잡는다. 잡지 않으면 같은 사용자가 탭 두 개에서 동시에
-- 보낼 때 3건 검사가 둘 다 통과해 4건이 들어간다.
--
-- 첨부 개수는 테이블 CHECK 가 이미 막지만 여기서 **먼저** 본다. 제약에 걸리면
-- 23514 예외가 나가 화면이 코드 대신 영문 오류를 받는다.
--
-- 30초 쿨다운은 여기서 보지 않는다 — 접수 폼과 같은 기존 장치
-- (`remainingCooldown`)가 서버 액션 단계에서 막는다.
-- -----------------------------------------------------------------------------
create or replace function public.add_inquiry_user_reply(
  p_inquiry_id uuid,
  p_content text,
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  owner_id uuid;
  current_status public.inquiry_status;
  current_cancelled timestamptz;
  last_outbound_at timestamptz;
  recent_reply_count integer;
  trimmed_content text := btrim(coalesce(p_content, ''));
  payload_attachments jsonb := coalesce(p_attachments, '[]'::jsonb);
  author_nickname text;
  new_reply_id uuid;
begin
  -- 로그인하지 않은 호출(anon 세션 · 서비스 롤 직접 호출)은 소유자일 수 없다.
  if actor is null then
    return jsonb_build_object('ok', false, 'code', 'not_owner');
  end if;

  select user_id, status, cancelled_at
  into owner_id, current_status, current_cancelled
  from public.inquiries
  where id = p_inquiry_id
  for update;

  if not found or owner_id is distinct from actor then
    return jsonb_build_object('ok', false, 'code', 'not_owner');
  end if;

  if current_cancelled is not null then
    return jsonb_build_object('ok', false, 'code', 'cancelled');
  end if;

  if current_status <> 'in_progress' then
    return jsonb_build_object('ok', false, 'code', 'not_in_progress');
  end if;

  select max(created_at) into last_outbound_at
  from public.inquiry_replies
  where inquiry_id = p_inquiry_id
    and direction = 'outbound';

  if last_outbound_at is null then
    return jsonb_build_object('ok', false, 'code', 'no_operator_reply');
  end if;

  /* 마지막 운영자 답변 **이후**의 내 답장만 센다. 운영자가 다시 답하면 창이 새로
     열린다 — 대화는 이어지고, 한 번에 쏟아내는 것만 막는다. */
  select count(*) into recent_reply_count
  from public.inquiry_replies
  where inquiry_id = p_inquiry_id
    and direction = 'inbound'
    and author_id = actor
    and created_at > last_outbound_at;

  if recent_reply_count >= 3 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;

  if char_length(trimmed_content) < 1
     or char_length(trimmed_content) > 2000
     or jsonb_typeof(payload_attachments) <> 'array'
     or jsonb_array_length(payload_attachments) > 5
     or public.inquiry_attachment_kind_count(payload_attachments, false) > 3
     or public.inquiry_attachment_kind_count(payload_attachments, true) > 2
  then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  /* 닉네임은 **저장 시점의 스냅샷**이다(inquiry_notes 의 author_nickname_snapshot 과
     같은 판단). 나중에 닉네임을 바꿔도 지난 대화의 화자 표기는 흔들리지 않는다.
     프로필이 없을 리는 없지만, 있으면 없는 대로 대화는 이어져야 한다. */
  select nickname into author_nickname
  from public.profiles
  where id = actor;

  insert into public.inquiry_replies (
    inquiry_id, author_id, author_name, content, direction, attachments
  )
  values (
    p_inquiry_id,
    actor,
    coalesce(nullif(btrim(author_nickname), ''), '회원'),
    trimmed_content,
    'inbound',
    payload_attachments
  )
  returning id into new_reply_id;

  -- user_replied_at · updated_at 은 5의 트리거가 찍는다(경로가 하나여야 한다).

  return jsonb_build_object('ok', true, 'reply_id', new_reply_id);
end;
$$;

comment on function public.add_inquiry_user_reply(uuid, text, jsonb) is
  '회원이 자기 문의에 답장한다. 본인 · 취소 아님 · 처리 중 · 운영자 답변 있음 · 마지막 답변 이후 3건 미만 · 내용 1~2000자와 첨부 상한을 순서대로 보고, 어긋나면 코드로 돌려준다. inquiry_replies 에 사용자 INSERT 정책이 없으므로 SECURITY DEFINER.';

-- -----------------------------------------------------------------------------
-- 7. 실행 권한 · RLS
--
-- public · anon 에서는 회수하고 로그인 세션과 서비스 롤에만 연다(20260911000300 과 같은
-- 모양). 이 함수는 DEFINER 라 회수하지 않으면 RLS 밖에서 도는 쓰기 구멍이 된다.
-- 서비스 롤에는 auth.uid() 가 없어 언제나 not_owner 로 끝난다 — 권한이 있어도 남의
-- 문의에 답장을 심을 수 없다(인가는 함수 안의 소유자 검사 한 곳에 모여 있다).
--
-- SELECT 정책은 새로 만들 것이 없다. `inquiry_replies_select_owner`(20260908000700)가
-- **행 단위**로 열려 있고 열 단위 GRANT 를 쓰지 않으므로, 새 `attachments` 열은
-- 소유자 조회에 자동으로 따라온다. 사용자 INSERT 정책은 만들지 않는다(6의 RPC 만).
-- -----------------------------------------------------------------------------
revoke all on function public.add_inquiry_user_reply(uuid, text, jsonb) from public, anon;
grant execute on function public.add_inquiry_user_reply(uuid, text, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. 답변 템플릿 — "새 문의로 접수해 주세요" → "이 문의에 답장으로 남겨 주세요"
--
-- 20260914000300 은 "사용자가 답글을 달 수 없다"는 전제로 문구를 새 문의 안내로
-- 바꿨다. 이 마이그레이션이 그 전제를 뒤집으므로 추가 정보를 요구하는 계열만
-- 되돌린다 — 대화가 열려 있는데 새 문의로 보내면 접수번호가 또 쪼개진다.
--
-- **완료 계열은 그대로 둔다**(처리 완료 안내 · 아이템 지급 처리 완료 · 데이터 복구
-- 안내). 그 답변은 상태를 '답변 완료'로 닫으면서 나가므로 답장 창이 없다.
--
-- 문장 단위 replace() + like 가드라 재실행해도 안전하고, 운영자가 손댄 템플릿이라도
-- 같은 문장이 남아 있으면 함께 고쳐진다. 이름으로도 좁힌다 — 같은 문장을 쓰는
-- 새 템플릿이 나중에 생겨도 이 되감기의 사정권에 들어오지 않는다.
-- -----------------------------------------------------------------------------

/* 추가 정보 요청 · 제보 증거 자료 요청 — 같은 문장을 공유한다. */
update public.inquiry_reply_templates
set body = replace(
  body,
  '위 내용을 담아 새 문의로 접수해 주세요. 제목에 접수번호 {{문의번호}}를 적어 주시면 이어서 확인하겠습니다.',
  '이 문의에 답장으로 남겨 주세요. 문의가 처리 중 상태인 동안 답장할 수 있습니다.'
)
where name in ('추가 정보 요청', '제보 증거 자료 요청')
  and body like '%위 내용을 담아 새 문의로 접수해 주세요. 제목에 접수번호 {{문의번호}}를 적어 주시면 이어서 확인하겠습니다.%';

/* 오류 재현 정보 요청 — 꼬리 문구가 "같은 조건으로 재현해" 로 다르다. */
update public.inquiry_reply_templates
set body = replace(
  body,
  '위 내용을 담아 새 문의로 접수해 주세요. 제목에 접수번호 {{문의번호}}를 적어 주시면 같은 조건으로 재현해 확인하겠습니다.',
  '이 문의에 답장으로 남겨 주세요. 문의가 처리 중 상태인 동안 답장할 수 있습니다.'
)
where name = '오류 재현 정보 요청'
  and body like '%위 내용을 담아 새 문의로 접수해 주세요. 제목에 접수번호 {{문의번호}}를 적어 주시면 같은 조건으로 재현해 확인하겠습니다.%';

/* 서버 점검 안내 — 앞머리("접속 시각과 화면을")를 살리고 뒤만 바꾼다. */
update public.inquiry_reply_templates
set body = replace(
  body,
  '담아 새 문의로 접수해 주세요. 제목에 접수번호 {{문의번호}}를 적어 주시면 이어서 확인하겠습니다.',
  '이 문의에 답장으로 남겨 주세요. 문의가 처리 중 상태인 동안 답장할 수 있습니다.'
)
where name = '서버 점검 안내'
  and body like '%담아 새 문의로 접수해 주세요. 제목에 접수번호 {{문의번호}}를 적어 주시면 이어서 확인하겠습니다.%';
