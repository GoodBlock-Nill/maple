-- =============================================================================
-- 20260911000300_inquiry_assignment
-- 1:1 문의 협업 — 담당자 배정 · 작성 중 소프트 락 · 충돌 감지 · 내부 메모.
--
-- 배경
--   운영자가 여러 명이면 같은 문의에 두 사람이 동시에 답을 쓴다. 사용자 화면에는
--   비슷한 답변이 두 번 붙고, 둘 중 나중 것이 앞의 판단을 뒤집기도 한다. 이 파일은
--   그 혼선을 **데이터 쪽에서** 막을 수 있는 만큼 막는다.
--
-- 이 마이그레이션이 다루는 다섯 가지
--   1) `inquiries.assigned_to · assigned_at`  — 담당자(누가 이 문의를 맡았나)
--   2) `inquiries.editing_by · editing_at`    — 작성 중 소프트 락(하트비트 시각)
--   3) `public.inquiry_notes`                 — 운영자 전용 내부 메모(사용자에게 보이지 않는다)
--   4) RPC 셋 — `claim_inquiry_edit` · `release_inquiry_edit` · `add_inquiry_reply`
--   5) 두 가드 보강 — 소유자 UPDATE 가드에 새 열을 못 쓰게 막고,
--      `updated_at` 트리거가 **하트비트에는 반응하지 않도록** 바꾼다.
--
-- 왜 소프트 락인가
--   행을 진짜로 잠그면(=DB 락) 브라우저를 닫은 운영자 때문에 문의가 영영 열리지
--   않는다. 여기서 만드는 것은 "지금 누가 쓰고 있다"는 **표시**일 뿐이고, 5분 동안
--   하트비트가 없으면 만료로 본다. 마지막 방어선은 락이 아니라 4)의 충돌 감지다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 담당자 · 작성 중 잠금 열
--
-- 둘 다 `on delete set null` 이다. 담당자가 퇴사(계정 삭제)해도 문의와 답변 이력은
-- 남아야 하고, 남는 것은 "담당자가 사라졌다"는 사실뿐이어야 한다.
--
-- 제약 이름을 직접 적는 이유: PostgREST 임베드(`assignee:profiles!inquiries_assigned_to_fkey`)가
-- 제약 이름을 그대로 쓴다. 자동 생성 이름에 기대면 이름이 달라지는 순간 목록 질의가
-- 통째로 깨진다.
-- -----------------------------------------------------------------------------
alter table public.inquiries
  add column if not exists assigned_to uuid,
  add column if not exists assigned_at timestamptz,
  add column if not exists editing_by uuid,
  add column if not exists editing_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inquiries'::regclass and conname = 'inquiries_assigned_to_fkey'
  ) then
    alter table public.inquiries
      add constraint inquiries_assigned_to_fkey
      foreign key (assigned_to) references public.profiles (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inquiries'::regclass and conname = 'inquiries_editing_by_fkey'
  ) then
    alter table public.inquiries
      add constraint inquiries_editing_by_fkey
      foreign key (editing_by) references public.profiles (id) on delete set null;
  end if;
end $$;

comment on column public.inquiries.assigned_to is
  '이 문의를 맡은 운영자(profiles.id). null 이면 미배정. 퇴사해도 이력은 남아야 하므로 on delete set null.';
comment on column public.inquiries.assigned_at is
  '담당자가 정해진 시각. 담당이 바뀌면 새 시각으로 덮어쓴다(이력은 audit_logs 가 갖는다).';
comment on column public.inquiries.editing_by is
  '지금 답변을 작성 중인 운영자. 소프트 락이라 강제력이 없다 — 화면의 "작성 중" 표시와 경고 배너용.';
comment on column public.inquiries.editing_at is
  '작성 중 하트비트 시각(60초마다 갱신). 5분(claim_inquiry_edit 의 만료 기준)보다 오래되면 만료로 본다.';

-- 목록 필터 "내 담당"(assigned_to = me).
create index if not exists inquiries_assigned_to_idx
  on public.inquiries (assigned_to, status, created_at desc)
  where assigned_to is not null;

/* "미배정" 필터는 위 부분 인덱스가 덮지 못한다(인덱스에 null 행이 없다). 미처리
   큐에서 가장 자주 누르는 필터라 반대쪽도 부분 인덱스로 따로 둔다. */
create index if not exists inquiries_unassigned_idx
  on public.inquiries (status, created_at desc)
  where assigned_to is null;

-- -----------------------------------------------------------------------------
-- 2. set_inquiry_updated_at()
--
-- 하트비트(60초마다 editing_at 갱신)가 `updated_at` 을 밀어 올리면 두 가지가 깨진다.
--   * 목록의 '업데이트' 칸과 `sort=updated_at` 정렬이 "누가 보고 있는 중"이라는
--     이유만으로 흔들린다 — 실제로는 아무것도 바뀌지 않았다.
--   * 운영 지표("마지막으로 손댄 시각")가 의미를 잃는다.
-- 그래서 inquiries 에 한해 공용 `set_updated_at()` 대신 이 함수를 쓴다. 판정은
-- "잠금 열 말고 달라진 것이 있는가" 하나다(to_jsonb 비교라 열이 늘어도 따라온다).
-- -----------------------------------------------------------------------------
create or replace function public.set_inquiry_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
  'inquiries 전용 updated_at 트리거. 작성 중 잠금(editing_by · editing_at)만 바뀐 UPDATE 는 수정 시각을 밀지 않는다.';

-- 트리거는 이름 순으로 실행된다: guard_inquiry_owner_update → set_updated_at.
-- 같은 이름을 유지해야 그 순서가 보존된다(가드가 먼저 값을 고정한 뒤 시각을 찍는다).
drop trigger if exists set_updated_at on public.inquiries;
create trigger set_updated_at
  before update on public.inquiries
  for each row execute function public.set_inquiry_updated_at();

-- -----------------------------------------------------------------------------
-- 3. 소유자 UPDATE 가드 보강 (20260908001900 의 함수를 통째로 다시 쓴다)
--
-- 사용자는 '접수 대기'인 자기 문의를 수정할 수 있다(`inquiries_update_own`).
-- 새로 생긴 네 열은 운영 컬럼이므로, 사용자가 실어 보내면 조용히 되돌린다
-- (answered_at · contact_email 과 같은 처리다 — 정상 흐름을 예외로 끊을 이유가 없다).
-- 그러지 않으면 사용자가 스스로를 담당자로 박아 넣거나 잠금을 지울 수 있다.
--
-- SECURITY INVOKER 를 유지해야 한다. DEFINER 로 두면 current_user 가 함수 소유자로
-- 평가되어 첫 분기가 항상 참이 되고 가드가 통째로 무력화된다(20260908001000 사고).
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

  /* 취소 해제(un-cancel)와 "상태는 그대로 두고 cancelled_at 만 찍기"를 함께 막는다.
     둘 다 취소 여부와 상태가 어긋난 행을 만든다. */
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

  return new;
end;
$$;

comment on function public.guard_inquiry_owner_update() is
  'SECURITY INVOKER 여야 한다. 소유자 UPDATE 를 "접수 대기 상태의 본문 수정"과 "접수 취소(대기·처리 중 → 종료)"로만 좁히고, 운영 컬럼(answered_at · 담당자 · 작성 중 잠금)은 되돌린다.';

-- -----------------------------------------------------------------------------
-- 4. inquiry_notes — 운영자 전용 내부 메모
--
-- 사용자에게는 **어떤 경로로도** 보이지 않아야 한다. `inquiries` 는 소유자에게
-- 행이 열려 있어 "메모 열"을 그 테이블에 두면 사용자 쪽 select 한 줄로 새어 나간다.
-- 그래서 별도 테이블 + 관리자 전용 정책으로 분리한다(anon·소유자 정책이 아예 없다).
--
-- author_nickname_snapshot: 메모를 남긴 시점의 닉네임. 작성자가 퇴사하면
-- author_id 는 null 이 되지만 "누가 남긴 판단인가"는 남아야 한다.
-- -----------------------------------------------------------------------------
create table if not exists public.inquiry_notes (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_nickname_snapshot text not null,
  body text not null,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inquiry_notes'::regclass and conname = 'inquiry_notes_body_length'
  ) then
    alter table public.inquiry_notes
      add constraint inquiry_notes_body_length
      check (char_length(body) between 1 and 2000);
  end if;
end $$;

comment on table public.inquiry_notes is
  '1:1 문의의 운영자 전용 내부 메모. 사용자에게 노출되지 않는다(관리자 전용 RLS · 사용자 사이트는 이 테이블을 읽지 않는다).';
comment on column public.inquiry_notes.author_nickname_snapshot is
  '작성 시점의 운영자 닉네임. 계정이 사라져도(author_id = null) 누가 남긴 판단인지 남는다.';
comment on column public.inquiry_notes.body is
  '메모 본문(1~2000자 · 답변 상한과 같은 숫자). 평문이며 줄바꿈만 살린다.';

create index if not exists inquiry_notes_inquiry_created_idx
  on public.inquiry_notes (inquiry_id, created_at desc);

alter table public.inquiry_notes enable row level security;

revoke all on public.inquiry_notes from anon;
grant select, insert, delete on public.inquiry_notes to authenticated;
grant all on public.inquiry_notes to service_role;

/* `for all` 정책 하나로 묶지 않는다 — 그러면 아무 관리자나 남의 메모를 지울 수
   있다. 메모는 판단의 기록이라 지우는 것은 남긴 사람만 할 수 있어야 한다.
   UPDATE 정책은 아예 없다(메모는 고치지 않고 지우고 다시 쓴다). */
drop policy if exists inquiry_notes_select_admin on public.inquiry_notes;
create policy inquiry_notes_select_admin on public.inquiry_notes
  for select to authenticated
  using (public.is_admin());

drop policy if exists inquiry_notes_insert_admin on public.inquiry_notes;
create policy inquiry_notes_insert_admin on public.inquiry_notes
  for insert to authenticated
  with check (public.is_admin() and author_id = (select auth.uid()));

drop policy if exists inquiry_notes_delete_own on public.inquiry_notes;
create policy inquiry_notes_delete_own on public.inquiry_notes
  for delete to authenticated
  using (public.is_admin() and author_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 5. claim_inquiry_edit(p_inquiry_id, p_force) -> jsonb
--
-- "지금부터 내가 쓴다"를 선언한다. 성공 조건은 셋 중 하나다.
--   * 아무도 잡고 있지 않다
--   * 내가 이미 잡고 있다(= 하트비트)
--   * 잡은 지 5분이 넘었다(만료) 또는 p_force 로 가로챈다
--
-- SECURITY DEFINER 인 이유: 잠금 갱신은 문의 본문과 무관한 운영 조작이라
-- `inquiries_admin_all` 이 열어 준 UPDATE 를 그대로 쓰면 충분하지만, 소유자 가드
-- 트리거(SECURITY INVOKER)가 매 UPDATE 마다 `is_admin()` 을 다시 부른다. DEFINER 로
-- 두면 그 왕복이 사라지고, 함수 첫 줄의 `is_admin()` 검사 하나로 인가가 모인다.
-- 대신 DEFINER 는 RLS 를 우회하므로 **첫 줄의 검사와 search_path 고정, 그리고
-- public·anon 실행 권한 회수**가 세트다.
--
-- 반환: { ok, editing_by, editing_nickname, editing_at, expired, taken_over }
--   ok=false 면 다른 사람이 **살아 있는** 잠금을 쥐고 있다는 뜻이고, 그때의
--   editing_* 는 그 사람의 것이다(화면이 "OOO 관리자가 작성 중" 배너를 세운다).
-- -----------------------------------------------------------------------------
create or replace function public.claim_inquiry_edit(
  p_inquiry_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  holder uuid;
  held_at timestamptz;
  holder_nickname text;
  is_expired boolean;
  claimed_at timestamptz := now();
begin
  if not public.is_admin() then
    raise exception '관리자만 문의 작성 잠금을 잡을 수 있습니다.' using errcode = '42501';
  end if;

  select editing_by, editing_at into holder, held_at
  from public.inquiries
  where id = p_inquiry_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- 하트비트가 5분 넘게 끊긴 잠금은 "브라우저를 닫고 간 것"으로 본다.
  is_expired := held_at is null or held_at < claimed_at - interval '5 minutes';

  if holder is not null and holder <> actor and not is_expired and not p_force then
    select nickname into holder_nickname from public.profiles where id = holder;

    return jsonb_build_object(
      'ok', false,
      'code', 'locked',
      'editing_by', holder,
      'editing_nickname', holder_nickname,
      'editing_at', held_at,
      'expired', false
    );
  end if;

  update public.inquiries
  set editing_by = actor, editing_at = claimed_at
  where id = p_inquiry_id;

  select nickname into holder_nickname from public.profiles where id = actor;

  return jsonb_build_object(
    'ok', true,
    'editing_by', actor,
    'editing_nickname', holder_nickname,
    'editing_at', claimed_at,
    'expired', is_expired,
    -- 남이 쥐고 있던(그리고 살아 있던) 잠금을 가로챘는가. 감사 로그는 이때만 남긴다.
    'taken_over', holder is not null and holder <> actor and not is_expired
  );
end;
$$;

comment on function public.claim_inquiry_edit(uuid, boolean) is
  '답변 작성 중 소프트 락을 잡거나 갱신한다(하트비트). 5분 넘게 끊긴 잠금은 만료로 보고, p_force 면 살아 있는 잠금도 가로챈다. 관리자 전용.';

-- -----------------------------------------------------------------------------
-- release_inquiry_edit(p_inquiry_id) -> jsonb
--
-- 내가 쥔 잠금만 푼다. 남의 잠금을 풀 수 있으면 "가로채기"가 감사 로그 없이
-- 두 단계(풀기 → 잡기)로 우회된다.
-- -----------------------------------------------------------------------------
create or replace function public.release_inquiry_edit(p_inquiry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer := 0;
begin
  if not public.is_admin() then
    raise exception '관리자만 문의 작성 잠금을 풀 수 있습니다.' using errcode = '42501';
  end if;

  update public.inquiries
  set editing_by = null, editing_at = null
  where id = p_inquiry_id
    and editing_by = auth.uid();

  get diagnostics released = row_count;

  return jsonb_build_object('ok', true, 'released', released > 0);
end;
$$;

comment on function public.release_inquiry_edit(uuid) is
  '내가 쥔 작성 중 잠금만 푼다(폼 이탈 · 답변 완료). 남의 잠금은 건드리지 않는다.';

-- -----------------------------------------------------------------------------
-- 6. add_inquiry_reply(...) -> jsonb — 저장 시 충돌 감지
--
-- 소프트 락은 "동시에 쓰는 것"을 **알려 줄 뿐** 막지 못한다(가로채기도 열려 있다).
-- 마지막 방어선은 저장하는 순간의 비교다 — 운영자가 화면을 연 시점의 답변 수 ·
-- 상태와 지금 DB 가 다르면, 그 사이에 누군가 먼저 처리한 것이다.
--
-- 검사와 INSERT 가 **한 트랜잭션**이어야 하는 이유: 앱에서 두 번 왕복하면 그 사이에
-- 상대의 INSERT 가 끼어들어 두 답변이 모두 통과한다. `for update` 로 문의 행을 잡아
-- 같은 문의에 대한 동시 저장을 줄 세운다.
--
-- SECURITY INVOKER 다. 관리자는 이미 `inquiry_replies_admin_all` 로 INSERT 할 수 있고,
-- RLS 를 우회할 이유가 없다(우회하면 권한 검증이 함수 안 한 줄로 옮겨 간다).
--
-- 반환: { ok:true, reply_id, reply_count } 또는
--       { ok:false, code:'not_found'|'cancelled'|'conflict', reply_count, status }
-- -----------------------------------------------------------------------------
create or replace function public.add_inquiry_reply(
  p_inquiry_id uuid,
  p_content text,
  p_author_name text,
  p_expected_reply_count integer,
  p_expected_status public.inquiry_status,
  p_delivery_status text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_status public.inquiry_status;
  current_cancelled timestamptz;
  current_count integer;
  new_reply_id uuid;
begin
  if not public.is_admin() then
    raise exception '관리자만 답변을 등록할 수 있습니다.' using errcode = '42501';
  end if;

  select status, cancelled_at into current_status, current_cancelled
  from public.inquiries
  where id = p_inquiry_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if current_cancelled is not null then
    return jsonb_build_object('ok', false, 'code', 'cancelled');
  end if;

  select count(*) into current_count
  from public.inquiry_replies
  where inquiry_id = p_inquiry_id;

  /* 기대값을 주지 않은 호출(옛 클라이언트 · 스크립트)은 검사를 건너뛴다. 충돌 감지는
     보안 경계가 아니라 협업 장치라, 모르는 호출자를 막는 것보다 저장을 잇는 편이 낫다. */
  if (p_expected_reply_count is not null and p_expected_reply_count <> current_count)
     or (p_expected_status is not null and p_expected_status <> current_status)
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'reply_count', current_count,
      'status', current_status
    );
  end if;

  insert into public.inquiry_replies (
    inquiry_id, author_id, author_name, content, direction, delivery_status
  )
  values (
    p_inquiry_id, auth.uid(), p_author_name, p_content, 'outbound', p_delivery_status
  )
  returning id into new_reply_id;

  /* 답변을 저장한 사람의 잠금은 여기서 함께 푼다. 그러지 않으면 이미 끝난 작업이
     최대 5분(만료 시간) 동안 목록에 "작성 중"으로 남는다. */
  update public.inquiries
  set editing_by = null, editing_at = null
  where id = p_inquiry_id
    and editing_by = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'reply_id', new_reply_id,
    'reply_count', current_count + 1
  );
end;
$$;

comment on function public.add_inquiry_reply(uuid, text, text, integer, public.inquiry_status, text) is
  '답변 INSERT + 충돌 감지를 한 트랜잭션으로 묶는다. 화면을 연 시점의 답변 수·상태와 다르면 code=conflict 로 거절한다. 관리자 전용.';

-- -----------------------------------------------------------------------------
-- 7. 실행 권한
-- public · anon 에서는 회수하고 로그인 세션과 서비스 롤에만 연다. 실제 인가는
-- 각 함수 첫 줄의 is_admin() 이 한다.
-- -----------------------------------------------------------------------------
revoke all on function public.claim_inquiry_edit(uuid, boolean) from public, anon;
revoke all on function public.release_inquiry_edit(uuid) from public, anon;
revoke all on function public.add_inquiry_reply(uuid, text, text, integer, public.inquiry_status, text) from public, anon;

grant execute on function public.claim_inquiry_edit(uuid, boolean) to authenticated, service_role;
grant execute on function public.release_inquiry_edit(uuid) to authenticated, service_role;
grant execute on function public.add_inquiry_reply(uuid, text, text, integer, public.inquiry_status, text)
  to authenticated, service_role;
