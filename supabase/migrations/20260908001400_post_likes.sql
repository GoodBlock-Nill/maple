-- =============================================================================
-- 20260908001400_post_likes
-- 게시글 좋아요. `posts.like_count` 는 지금까지 시드값을 그대로 보여 주기만 했고
-- 누가 눌렀는지 남는 곳이 없어 토글을 만들 수 없었다. 사용자별 행을 두어
-- "이미 눌렀는가"를 판정하고, 집계 컬럼은 트리거가 따라오게 한다.
--
-- 이 마이그레이션이 다루는 것
--   1) `post_likes` — (post_id, user_id) 복합 PK. 중복 좋아요는 스키마가 막는다.
--   2) RLS — 본인 행만 읽고/넣고/지운다. 관리자는 전체 조회(운영 통계·어뷰징 확인).
--   3) `sync_post_like_count()` — insert +1 / delete -1 (0 미만으로 내려가지 않는다).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- post_likes
--
-- 복합 PK 를 쓰는 이유는 두 가지다.
--   * 같은 사용자가 같은 글에 두 번 넣는 것을 제약으로 막는다. 서버 액션이 "이미
--     눌렀는가"를 먼저 조회하지만, 더블클릭·동시 요청 경합은 조회로 막을 수 없다.
--   * 조회 패턴이 항상 (글, 나)라서 PK 인덱스만으로 상세 페이지 질의가 끝난다.
--
-- 별도 surrogate id 는 두지 않는다. 행 자체가 "이 사람이 이 글을 좋아한다"는
-- 사실이고, 개별 행을 id 로 지목할 일이 없다(삭제도 (글, 나)로 한다).
-- -----------------------------------------------------------------------------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.post_likes is
  '게시글 좋아요. (post_id, user_id) 한 행이 곧 "눌렀다"는 사실이고, posts.like_count 는 sync_post_like_count() 트리거가 유지한다.';

/* 도배 방지(서버 액션의 쿨다운)가 "이 사용자의 마지막 좋아요 시각"을 읽는다.
   PK 는 post_id 선두라 이 질의에 쓰이지 않으므로 사용자 기준 인덱스를 따로 둔다. */
create index if not exists post_likes_user_created_idx
  on public.post_likes (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 집계 동기화
--
-- `guard_post_counters()` 가 like_count 를 이전 값으로 되돌리기 때문에, 평범한
-- UPDATE 로는 집계를 올릴 수 없다. 가드를 통과하는 경로는 두 가지뿐이다.
--   (a) `current_user in ('postgres', 'supabase_admin', 'service_role')`
--   (b) 세션 로컬 플래그 `app.counter_bypass = 'on'`
-- 이미 있는 `sync_post_comment_count()` · `increment_post_view()` 가 쓰는 방식
-- 그대로, SECURITY DEFINER + 플래그로 둘 다 충족시킨다.
--
-- 왜 "SECURITY INVOKER 트리거 + 권한을 회수한 SECURITY DEFINER 헬퍼"가 아닌가
--   함수 EXECUTE 권한은 **호출 시점의 current_user** 로 검사한다. 트리거 함수를
--   SECURITY INVOKER 로 두면 그 안에서 current_user 는 `authenticated` 이므로,
--   헬퍼(apply_like_delta)의 EXECUTE 를 anon/authenticated 에서 회수하는 순간
--   트리거가 `permission denied for function` 으로 죽는다. 반대로 헬퍼를
--   authenticated 에 열어 두면 REST 로 직접 호출 가능한 집계 조작 창구가 생긴다.
--   즉 그 조합은 "동작하지 않거나, 안전하지 않거나" 둘 중 하나다.
--
--   여기서 고른 방식(트리거 함수 자체가 SECURITY DEFINER)은 호출 가능한 표면이
--   아예 없다. 트리거 함수는 반환형이 `trigger` 라 SQL 로 직접 호출할 수 없고
--   (Postgres 가 거부한다) PostgREST 의 RPC 목록에도 나오지 않는다. 입력도
--   사용자에게서 받지 않고 OLD/NEW 에서만 읽으며, 그 행은 이미 post_likes 의
--   INSERT/DELETE 정책이 `user_id = auth.uid()` 로 걸러 낸 것이다.
--
--   가드 함수(guard_post_counters)를 손대지 않는 것도 중요하다. 20260908001000 이
--   기록한 대로 가드는 SECURITY INVOKER 여야 하고, "트리거 안에서 온 UPDATE"를
--   가드가 스스로 구분할 방법은 결국 같은 세션 플래그뿐이라 새로 얻는 것이 없다.
--
-- 증감(+1/-1)은 행 잠금 아래에서 직렬화된다. 복합 PK 가 중복 insert 를 막으므로
-- 정상 경로에서 값이 어긋날 수 없고, 그래도 음수로 내려가지 않도록 greatest 로
-- 바닥을 둔다(시드 데이터처럼 실제 행 없이 like_count 만 있는 글이 있다).
-- -----------------------------------------------------------------------------
create or replace function public.sync_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  delta integer;
begin
  -- DELETE 트리거에는 NEW 가 없다. TG_OP 로 갈라야 한다.
  if tg_op = 'DELETE' then
    target_id := old.post_id;
    delta := -1;
  else
    target_id := new.post_id;
    delta := 1;
  end if;

  perform set_config('app.counter_bypass', 'on', true);

  update public.posts
     set like_count = greatest(like_count + delta, 0)
   where id = target_id;

  perform set_config('app.counter_bypass', 'off', true);

  return null;
end;
$$;

comment on function public.sync_post_like_count() is
  'post_likes 의 insert/delete 를 posts.like_count 에 반영한다. guard_post_counters 를 통과해야 해서 SECURITY DEFINER + app.counter_bypass 를 쓴다. 트리거 전용이라 직접 호출·RPC 노출 경로가 없다.';

drop trigger if exists sync_post_like_count on public.post_likes;
create trigger sync_post_like_count
  after insert or delete on public.post_likes
  for each row execute function public.sync_post_like_count();

-- -----------------------------------------------------------------------------
-- RLS
--
-- Supabase 의 `alter default privileges ... grant all on tables to anon,
-- authenticated` 때문에 새 테이블은 만들자마자 두 롤에 전권이 붙는다. reports 와
-- 같이 권한 자체를 회수하고 필요한 것만 다시 준다(정책 + 권한, 두 겹).
--
-- SELECT 를 본인 행으로 좁히는 것은 프라이버시 결정이다. "누가 이 글을 좋아했는지"
-- 목록은 화면 어디에도 없고, 열어 두면 특정 사용자의 취향·활동 시간을 그대로
-- 수집할 수 있다. 화면이 필요로 하는 것은 "내가 눌렀는가"(본인 행)와 "몇 명인가"
-- (posts.like_count)뿐이다.
-- -----------------------------------------------------------------------------
alter table public.post_likes enable row level security;

revoke all on public.post_likes from anon;
revoke all on public.post_likes from authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;

drop policy if exists post_likes_select_own on public.post_likes;
create policy post_likes_select_own on public.post_likes
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists post_likes_select_admin on public.post_likes;
create policy post_likes_select_admin on public.post_likes
  for select to authenticated
  using (public.is_admin());

/* 공개·미삭제 글에만 좋아요를 남길 수 있다. exists 안의 posts 조회는 호출자
   기준으로 RLS 를 다시 타므로, 볼 수 없는 글(미게시·소프트 삭제)은 애초에
   조건을 만족하지 못한다. 자기 글에 누르는 것은 막지 않는다(신고와 달리
   자기 글 좋아요는 부정행위가 아니라 흔한 사용 패턴이다). */
drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.posts p
      where p.id = post_likes.post_id
        and p.is_published
        and p.deleted_at is null
    )
  );

/* 취소는 글 상태와 무관하게 허용한다. 글이 비공개로 바뀌었다는 이유로 이미
   누른 좋아요를 못 지우면, 사용자는 되돌릴 수 없는 상태에 갇힌다. */
drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own on public.post_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- UPDATE 정책은 두지 않는다. 좋아요는 있거나 없거나 둘 중 하나라 고칠 값이 없다.
