-- =============================================================================
-- 20260911000400_inquiry_no
-- 1:1 문의의 **접수번호** — 사람이 부르고 받아 적을 수 있는 번호.
--
-- 배경
--   지금까지 문의를 가리키는 값은 uuid 뿐이었다. 전화·메일로 "문의 아이디가
--   3f2a…" 를 불러 줄 수는 없고, 운영자와 사용자가 같은 문의를 이야기하고 있는지
--   확인할 방법도 없었다. 그래서 짧은 정수 번호를 하나 붙인다.
--
--   * 1001 부터 시작한다. 1 부터 시작하면 "몇 번째 문의인지"가 그대로 드러나
--     서비스 규모가 노출되고, 세 자리 번호는 접수번호처럼 보이지도 않는다.
--   * `generated always as identity` 다 — **`by default` 가 아니다.**
--     by default 로 두면 접수 폼이 임의의 번호를 실어 보낼 수 있고(사용자 INSERT 는
--     `inquiries_insert_own` 으로 열려 있다), 누가 큰 번호를 선점하면 시퀀스가
--     그 자리에 닿는 순간 접수가 통째로 실패한다. always 면 Postgres 가 직접
--     거절하므로 트리거로 막을 것이 없다.
--   * 되돌아가지 않는 값이다. 취소·삭제로 생긴 빈 번호는 그대로 둔다.
--
-- 검증 질의(적용 뒤 한 번 돌려 본다 — 둘 다 0 이어야 한다)
--   select count(*) from public.inquiries where inquiry_no is null;
--   select count(*) from (
--     select inquiry_no from public.inquiries group by inquiry_no having count(*) > 1
--   ) duplicated;
-- =============================================================================

alter table public.inquiries
  add column if not exists inquiry_no bigint;

-- -----------------------------------------------------------------------------
-- 백필 + identity 전환
--
-- 이미 쌓인 문의에는 **접수 순서대로** 번호를 매긴다(created_at, 동시각은 id).
-- 번호가 접수 순서와 어긋나면 "3번이 5번보다 늦게 들어왔다"는 이상한 목록이 된다.
--
-- 다시 실행해도 안전하다 — 비어 있는 행에만, 지금 최댓값 뒤로 이어 붙인다.
-- -----------------------------------------------------------------------------
do $$
declare
  next_start bigint;
  identity_kind "char";
begin
  if exists (select 1 from public.inquiries where inquiry_no is null) then
    /* 서브쿼리의 max 는 문 시작 시점의 스냅샷이라 행마다 다시 계산되지 않는다.
       빈 테이블이면 1000 이 되어 첫 문의가 1001 을 받는다. */
    with ordered as (
      select id, row_number() over (order by created_at, id) as rn
      from public.inquiries
      where inquiry_no is null
    )
    update public.inquiries i
    set inquiry_no = coalesce((select max(inquiry_no) from public.inquiries), 1000) + o.rn
    from ordered o
    where i.id = o.id;
  end if;

  -- 이미 not null 이면 아무 일도 하지 않는다.
  alter table public.inquiries alter column inquiry_no set not null;

  select coalesce(max(inquiry_no), 1000) + 1 into next_start from public.inquiries;

  select attidentity into identity_kind
  from pg_attribute
  where attrelid = 'public.inquiries'::regclass and attname = 'inquiry_no';

  -- '' = identity 가 아직 없음. 재실행 시 두 번 붙이면 42710 이 난다.
  if identity_kind = '' then
    execute format(
      'alter table public.inquiries alter column inquiry_no add generated always as identity (start with %s)',
      next_start
    );
  end if;
end $$;

/* 접수번호는 사용자가 불러 주는 값이다. 두 문의가 같은 번호를 가지면 그 순간
   "번호로 문의를 찾는다"는 규약 전체가 무너지므로 유니크로 못 박는다. */
create unique index if not exists inquiries_inquiry_no_key
  on public.inquiries (inquiry_no);

comment on column public.inquiries.inquiry_no is
  '사람이 부르는 접수번호(1001부터). 화면 표기는 #1024. generated always as identity — 접수 폼이 값을 정할 수 없다. 취소·삭제로 생긴 빈 번호는 다시 쓰지 않는다.';

-- -----------------------------------------------------------------------------
-- 소유자 UPDATE 가드 — 접수번호 고정
--
-- `generated always` 라 `set inquiry_no = ...` 는 Postgres 가 이미 거절한다. 그래도
-- 가드에 한 줄을 남기는 이유는 규약을 한곳에서 읽히게 하려는 것이다 — 이 함수를
-- 보면 "사용자가 건드릴 수 없는 열"이 전부 모여 있다.
-- 나머지 본문은 20260911000300 과 같다(SECURITY INVOKER 유지가 핵심이다).
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

  return new;
end;
$$;

comment on function public.guard_inquiry_owner_update() is
  'SECURITY INVOKER 여야 한다. 소유자 UPDATE 를 "접수 대기 상태의 본문 수정"과 "접수 취소"로만 좁히고, 운영 컬럼(answered_at · 담당자 · 작성 중 잠금 · 접수번호)은 되돌린다.';
