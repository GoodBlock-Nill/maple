-- =============================================================================
-- 20260908001100_reports_and_author_edits
-- 신고(게시글 · 댓글) 접수 테이블 + 작성자 본인 수정/삭제에 필요한 정책·가드 보강.
--
-- 이 마이그레이션이 다루는 세 가지
--   1) `reports` — 신고 접수함. 운영자 검토 큐의 저장소이며, 사용자는 "쓰고 자기
--      것만 읽는다". 처리(상태 변경)는 관리자만 한다.
--   2) 작성자 자율 수정/삭제 — 정책은 이미 `posts_update_own` 이 열어 두었지만,
--      "무엇을 바꿀 수 있는가"는 정책으로 표현할 수 없다(컬럼 단위 WITH CHECK 이
--      없다). 가드 트리거를 넓혀 제목·본문·말머리·소프트삭제만 남긴다.
--   3) 댓글 소프트 삭제 — `comments_update_own` 이 되살리기(undelete)까지 허용하고
--      있어 USING 절에 `deleted_at is null` 을 더한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- report_reason
-- 라벨은 프론트(lib/constants/report.ts)가 소유한다. DB 에는 키만 둔다.
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.report_reason as enum ('spam', 'abuse', 'obscene', 'privacy', 'other');
exception when duplicate_object then null;
end $$;

comment on type public.report_reason is
  '신고 사유. spam(스팸·광고) / abuse(욕설·비방) / obscene(음란·불쾌) / privacy(개인정보 노출) / other(기타).';

-- -----------------------------------------------------------------------------
-- reports
--
-- 대상은 `posts` 와 `comments` 두 테이블에 걸쳐 있다. 테이블별로 신고함을 나누면
-- 운영자 큐가 둘로 쪼개지고 정렬·페이지네이션을 두 번 구현해야 하므로, 다형
-- 참조(target_type + target_id)로 한 테이블에 모은다. FK 를 걸 수 없는 대신
-- 존재 여부는 INSERT 정책(`can_report_target`)이 검사한다.
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_target_type_check check (target_type in ('post', 'comment')),
  constraint reports_detail_length check (detail is null or char_length(detail) <= 500),
  constraint reports_status_check check (status in ('open', 'resolved', 'dismissed')),
  -- 같은 사용자가 같은 대상을 여러 번 신고해도 큐에는 한 건만 남는다.
  -- 서버 액션은 여기서 나는 23505 를 "이미 신고했습니다" 안내로 바꾼다.
  constraint reports_unique_reporter unique (target_type, target_id, reporter_id)
);

comment on table public.reports is
  '게시글 · 댓글 신고 접수함. 사용자는 insert 와 본인 행 select 만 할 수 있고, 상태 변경은 관리자 전용이다.';
comment on column public.reports.target_type is
  'post | comment. FK 를 걸 수 없는 다형 참조라 존재 검증은 can_report_target() 이 맡는다.';
comment on column public.reports.status is
  'open(접수) → resolved(조치) | dismissed(반려). 운영자 검토 큐의 상태값.';

-- 운영자 큐: 대상별 묶어보기.
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- 운영자 큐: 미처리분 최신순.
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

create index if not exists reports_reporter_idx on public.reports (reporter_id);

-- -----------------------------------------------------------------------------
-- can_report_target(target_type, target_id)
--
-- INSERT 정책 안에서 쓰는 존재·자격 검사.
--
--  * SECURITY INVOKER(기본값)여야 한다. 그래야 posts/comments 의 SELECT 정책이
--    호출자 기준으로 평가되어, 볼 수 없는 글(미게시 · 소프트 삭제)을 신고 대상으로
--    삼을 수 없다. DEFINER 로 두면 숨겨진 행의 존재 여부가 새어 나간다.
--  * 자기 글 신고는 거른다. 서버 액션도 같은 검사를 하지만, 액션은 UI 를 거치지
--    않는 직접 POST 로도 호출되므로 최종 방어선은 DB 에 둔다.
-- -----------------------------------------------------------------------------
create or replace function public.can_report_target(p_target_type text, p_target_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case p_target_type
    when 'post' then exists (
      select 1
      from public.posts p
      where p.id = p_target_id
        and p.deleted_at is null
        and p.is_published
        and p.author_id is distinct from (select auth.uid())
    )
    when 'comment' then exists (
      select 1
      from public.comments c
      where c.id = p_target_id
        and c.deleted_at is null
        and c.author_id is distinct from (select auth.uid())
    )
    else false
  end;
$$;

comment on function public.can_report_target(text, uuid) is
  'SECURITY INVOKER 여야 한다. DEFINER 로 두면 비공개·삭제된 행의 존재가 신고 성공 여부로 드러난다.';

/* Supabase 는 `alter default privileges ... grant all on functions to anon,
   authenticated` 를 걸어 둔다. PUBLIC 회수만으로는 anon 에 직접 붙은 권한이 남으므로
   롤을 명시해 함께 회수한다(확인: anon 키로 rpc 호출이 성공했다). */
revoke all on function public.can_report_target(text, uuid) from public;
revoke all on function public.can_report_target(text, uuid) from anon;
grant execute on function public.can_report_target(text, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- reports RLS
--
-- Supabase 는 `alter default privileges ... grant all on tables to anon,
-- authenticated` 를 걸어 두므로, 새 테이블은 만들자마자 두 롤에 전권이 붙는다.
-- RLS 가 막아 주긴 하지만 권한 자체를 회수해 두 겹으로 잠근다.
-- -----------------------------------------------------------------------------
alter table public.reports enable row level security;

revoke all on public.reports from anon;
revoke all on public.reports from authenticated;
grant select, insert on public.reports to authenticated;
grant all on public.reports to service_role;

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and public.can_report_target(target_type, target_id)
  );

drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin on public.reports
  for select to authenticated
  using (public.is_admin());

drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE 정책은 두지 않는다. 신고 이력은 남겨 두고 status 로만 종결한다.

-- -----------------------------------------------------------------------------
-- guard_post_counters() 확장
--
-- 작성자 수정 기능이 열리면서 UPDATE 경로가 실사용된다. 기존 가드가 되돌리던
-- 집계·운영 컬럼에 더해, 작성자 스냅샷(author_name)과 게시 상태(is_published ·
-- published_at)까지 고정한다. 남는 수정 가능 컬럼은 title · content · summary ·
-- category_key · thumbnail_url · deleted_at(소프트 삭제) 뿐이다.
--
-- 20260908001000 과 동일하게 SECURITY INVOKER 를 유지해야 한다. DEFINER 로 두면
-- current_user 가 소유자로 평가되어 가드가 통째로 무력화된다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_post_counters()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(current_setting('app.counter_bypass', true), 'off') = 'on'
     or public.is_admin()
  then
    return new;
  end if;

  new.view_count := old.view_count;
  new.comment_count := old.comment_count;
  new.like_count := old.like_count;
  new.board := old.board;
  new.is_pinned := old.is_pinned;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.is_published := old.is_published;
  new.published_at := old.published_at;
  new.created_at := old.created_at;
  /* edited_at 은 아래 mark_post_edited() 트리거만 채운다. 여기서 되돌려 두면
     본문을 고치지 않고 표시만 지우거나 위조하는 요청이 통하지 않는다. */
  new.edited_at := old.edited_at;

  return new;
end;
$$;

comment on function public.guard_post_counters() is
  'SECURITY INVOKER 여야 한다. 작성자 수정 경로에서 집계·작성자·게시 상태 컬럼을 이전 값으로 되돌린다.';

drop trigger if exists guard_post_counters on public.posts;
create trigger guard_post_counters
  before update on public.posts
  for each row execute function public.guard_post_counters();

-- -----------------------------------------------------------------------------
-- posts.edited_at + mark_post_edited()
--
-- "수정됨" 표시를 `updated_at > created_at` 으로 판정할 수 없다.
-- `set_updated_at` 트리거는 **모든** UPDATE 에서 도는데, `increment_post_view()`
-- 가 조회수를 올릴 때마다 그 UPDATE 가 발생한다. 즉 조회만 돼도 updated_at 이
-- 밀려서 사실상 모든 글에 "수정됨"이 붙는다(시드 데이터도 created_at 만 과거로
-- 지정해 두어 updated_at 이 전부 now() 다).
--
-- 그래서 본문이 실제로 바뀐 순간만 기록하는 컬럼을 따로 둔다. 값 비교
-- (`is distinct from`)로 판정하므로 같은 값을 다시 써 넣는 요청은 표시를 켜지
-- 않는다.
-- -----------------------------------------------------------------------------
alter table public.posts add column if not exists edited_at timestamptz;

comment on column public.posts.edited_at is
  '작성자가 제목·본문·요약·말머리를 실제로 고친 마지막 시각. 조회수 증가로도 밀리는 updated_at 대신 "수정됨" 표시의 근거가 된다.';

create or replace function public.mark_post_edited()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.title is distinct from old.title
     or new.content is distinct from old.content
     or new.summary is distinct from old.summary
     or new.category_key is distinct from old.category_key
  then
    new.edited_at := now();
  end if;

  return new;
end;
$$;

comment on function public.mark_post_edited() is
  'guard_post_counters() 다음(이름 순)에 돌아야 한다. 가드가 edited_at 을 이전 값으로 되돌린 뒤 여기서만 새 값을 넣는다.';

-- 트리거는 이름 순으로 실행된다: guard_post_counters → mark_post_edited → set_updated_at.
drop trigger if exists mark_post_edited on public.posts;
create trigger mark_post_edited
  before update on public.posts
  for each row execute function public.mark_post_edited();

-- -----------------------------------------------------------------------------
-- guard_comment_columns()
--
-- 댓글에도 같은 문제가 있다. `comments_update_own` 은 "내 댓글"까지만 판별할 수
-- 있어서 작성자가 post_id 를 다른 글로 옮기거나 author_name 을 바꿔 사칭하는 것을
-- 막지 못한다. 수정 가능한 컬럼은 content 와 deleted_at 뿐이어야 한다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_comment_columns()
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

  new.post_id := old.post_id;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.created_at := old.created_at;

  return new;
end;
$$;

comment on function public.guard_comment_columns() is
  'SECURITY INVOKER 여야 한다. DEFINER 로 두면 current_user 가 소유자로 평가되어 가드가 무력화된다.';

drop trigger if exists guard_comment_columns on public.comments;
create trigger guard_comment_columns
  before update on public.comments
  for each row execute function public.guard_comment_columns();

-- -----------------------------------------------------------------------------
-- comments_update_own 보강
-- 기존 정책은 USING 에 `deleted_at is null` 이 없어 삭제한 댓글을 다시 살릴 수
-- 있었다. 소프트 삭제를 되돌리는 경로는 관리자에게만 남긴다.
-- -----------------------------------------------------------------------------
drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null)
  with check (author_id = (select auth.uid()));
