-- =============================================================================
-- 20260908002100_reports_admin_update_and_notes
-- 신고 처리(관리자)에 필요한 권한 · 컬럼 · 가드.
--
-- 배경
--   20260908001100 이 `reports_update_admin` 정책은 만들었지만 테이블 권한은
--   `select, insert` 만 다시 부여했다. PostgreSQL 에서 RLS 정책은 **권한을 주지
--   않는다** — 권한(GRANT)을 통과한 뒤에야 정책이 평가된다. 그래서 관리자 세션도
--   신고 상태를 바꾸려 하면 정책이 아니라 권한 단계에서 42501 로 튕겼다.
--
-- 이 마이그레이션이 다루는 세 가지
--   1) `grant update on public.reports to authenticated`
--      — 행 단위 판정은 그대로 `reports_update_admin`(is_admin())이 한다.
--   2) 처리 이력 컬럼 — `note` · `resolved_by` · `resolved_at`.
--      "무엇을 왜 했는지"가 남지 않으면 같은 신고가 다시 올라왔을 때 판단 근거가 없다.
--   3) `guard_report_admin_columns()` — 운영 컬럼은 관리자만 쓴다.
--      정책은 "어느 행을" 까지만 판별한다. "어느 컬럼을" 은 컬럼 단위 WITH CHECK 이
--      없어 표현할 수 없으므로, 기존 가드 트리거들과 같은 방식으로 잠근다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 처리 이력 컬럼
--
-- `status` 는 이미 있다(open → resolved | dismissed). 여기서는 "누가 · 언제 ·
-- 어떤 판단으로" 를 채운다. 감사 로그(`audit_logs`)에도 남지만, 신고 큐에서
-- 한눈에 보이려면 행 자체가 들고 있어야 한다.
--
-- resolved_by 는 on delete set null 이다. 처리한 관리자가 탈퇴해도 신고 이력과
-- 메모는 남아야 한다(누구였는지만 사라진다).
-- -----------------------------------------------------------------------------
alter table public.reports
  add column if not exists note        text,
  add column if not exists resolved_by uuid references public.profiles (id) on delete set null,
  add column if not exists resolved_at timestamptz;

-- 제약에는 `if not exists` 가 없다. 재실행 가능하도록 카탈로그를 직접 본다.
do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.reports'::regclass
      and conname = 'reports_note_length'
  ) then
    alter table public.reports
      add constraint reports_note_length check (note is null or char_length(note) <= 500);
  end if;
end $$;

comment on column public.reports.note is
  '운영자 처리 메모(500자 이하). 사용자에게 노출하지 않는다 — reports 는 본인 신고 행만 select 되지만, 클라이언트 조회는 이 컬럼을 읽지 않는다.';
comment on column public.reports.resolved_by is
  '처리한 관리자. 탈퇴해도 이력은 남아야 하므로 on delete set null 이다.';
comment on column public.reports.resolved_at is
  '처리 완료 시각. status 가 open 을 벗어난 시점을 관리자 액션이 찍는다.';

-- 관리자 큐: 처리자별 · 처리 시각순 조회.
create index if not exists reports_resolved_idx
  on public.reports (resolved_at desc)
  where resolved_at is not null;

-- -----------------------------------------------------------------------------
-- 2. UPDATE 권한
--
-- Supabase 의 `alter default privileges` 로 붙었던 전권을 20260908001100 이
-- 회수하면서 update 를 빼놓았다. 정책(`reports_update_admin`)이 이미 관리자만
-- 통과시키므로, 권한을 열어도 일반 사용자는 여전히 한 행도 갱신하지 못한다.
-- DELETE 는 열지 않는다 — 신고 이력은 지우지 않고 status 로만 종결한다.
-- -----------------------------------------------------------------------------
grant update on public.reports to authenticated;

-- -----------------------------------------------------------------------------
-- 3. guard_report_admin_columns()
--
-- SECURITY **INVOKER** 여야 한다. DEFINER 로 두면 `current_user` 가 호출자가 아니라
-- 함수 소유자로 평가되어 첫 분기가 항상 참이 되고 가드가 통째로 무력화된다
-- (20260908001000 · 20260908001700 에 같은 회귀 기록이 있다).
--
-- INSERT 에도 건다. `reports_insert_own` 은 `status = 'open'` 만 강제하므로, 신고를
-- 넣으면서 note · resolved_by · resolved_at 을 함께 실어 보내는 요청이 통과한다.
-- 그러면 접수되지 않은 신고가 "이미 처리된 것"처럼 큐에 들어온다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_report_admin_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.is_admin()
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- 접수는 언제나 "미처리, 메모 없음"에서 시작한다.
    new.status      := 'open';
    new.note        := null;
    new.resolved_by := null;
    new.resolved_at := null;

    return new;
  end if;

  -- UPDATE: 관리자 판단(상태 · 메모 · 처리자 · 처리 시각)과 접수 원문을 모두 고정한다.
  new.status      := old.status;
  new.note        := old.note;
  new.resolved_by := old.resolved_by;
  new.resolved_at := old.resolved_at;
  new.target_type := old.target_type;
  new.target_id   := old.target_id;
  new.reporter_id := old.reporter_id;
  new.reason      := old.reason;
  new.detail      := old.detail;
  new.created_at  := old.created_at;

  return new;
end;
$$;

comment on function public.guard_report_admin_columns() is
  'SECURITY INVOKER 여야 한다. 신고의 처리 컬럼(status · note · resolved_by · resolved_at)을 관리자 외에는 쓰지 못하게 되돌린다.';

drop trigger if exists guard_report_admin_columns on public.reports;
create trigger guard_report_admin_columns
  before insert or update on public.reports
  for each row execute function public.guard_report_admin_columns();
