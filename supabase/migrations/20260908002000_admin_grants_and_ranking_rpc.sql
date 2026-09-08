-- =============================================================================
-- 20260908002000_admin_grants_and_ranking_rpc
-- 관리자 콘텐츠 모듈(가이드 · 랭킹 · 사이트 설정 · 히어로 배너)이 기대는 두 가지.
--
--   1) 네 테이블에 대한 authenticated 쓰기 **권한(GRANT)** 명시.
--   2) 랭킹 스냅샷 통째 교체 RPC `replace_ranking_snapshot()`.
--
-- 왜 GRANT 를 다시 쓰는가
--   RLS 정책(20260908000700)은 "어느 행을" 만 정한다. 그 앞단의 테이블 권한이
--   없으면 정책을 만족해도 `permission denied for table` 이 난다. 지금 이 네
--   테이블이 동작하는 근거는 Supabase 의 `alter default privileges ... grant all
--   on tables to anon, authenticated` 뿐이다 — 프로젝트 설정이나 향후
--   마이그레이션이 그 기본값을 조이면 관리자 CRUD 가 통째로 멈춘다.
--   20260908001700 이 admin_invites/audit_logs 에 한 것과 같은 방식으로,
--   의존을 없애고 필요한 권한을 명시적으로 붙인다. 읽기는 anon 도 필요하므로
--   여기서는 revoke 하지 않고 authenticated 쓰기만 추가한다(정책이 계속 게이트).
-- =============================================================================

grant select, insert, update, delete on public.gacha_items    to authenticated;
grant select, insert, update, delete on public.rankings       to authenticated;
grant select, insert, update, delete on public.site_settings  to authenticated;
grant select, insert, update, delete on public.hero_banners   to authenticated;

-- 서비스 롤(초기 시드·백필)도 명시해 둔다.
grant all on public.gacha_items   to service_role;
grant all on public.rankings      to service_role;
grant all on public.site_settings to service_role;
grant all on public.hero_banners  to service_role;

-- -----------------------------------------------------------------------------
-- replace_ranking_snapshot(p_rank_type, p_rows) -> timestamptz
--
-- 랭킹은 "행 단위 수정"이 없는 데이터다. 관리자는 CSV 한 장을 통째로 올리고,
-- 그 결과는 새 `snapshot_at` 하나로 묶인 N 행이어야 한다. 이 일을 클라이언트에서
-- insert 여러 번으로 하면 두 가지가 깨진다.
--   * 원자성 — 중간에 실패하면 절반짜리 스냅샷이 남고, 목록 쿼리는 "가장 최근
--     snapshot_at" 을 고르므로 그 반쪽이 즉시 노출된다.
--   * 시각 일치 — `default now()` 는 **문 단위**로 달라질 수 있어 한 업로드가
--     여러 스냅샷으로 쪼개진다(`rankings_unique_rank` 는 그걸 막지 못한다).
-- 그래서 함수 하나에 넣고 `now()` 를 한 번만 읽어 전 행에 같은 값을 박는다.
--
-- SECURITY DEFINER 인 이유와 그 대가
--   보관 정책(오래된 스냅샷 삭제)까지 한 트랜잭션에서 끝내려면 삭제 권한이
--   필요하다. 대신 DEFINER 는 RLS 를 우회하므로 **함수 첫 줄에서 직접**
--   `public.is_admin()` 을 확인하고, 아니면 42501(insufficient_privilege)로
--   끊는다. `search_path` 고정과 `revoke execute from public, anon` 은 그
--   우회 경로를 좁히는 나머지 절반이다.
--
-- p_rows 계약(관리자 앱이 만드는 jsonb 배열)
--   [{ "rank": 1, "character_name": "...", "level": 300, "job": "...",
--      "job_group": "adventurer", "avatar_url": null, "guild": null,
--      "guild_icon_url": null, "exp": "98.7B" }, ...]
--   * rank 는 1..n 연속이어야 한다. 빠진 순위가 있으면 화면의 TOP3/더보기 계산이
--     어긋나므로 입력 단계에서 끊는다.
--   * character_name · job · job_group 은 필수(테이블 not null).
--   * job_group 은 public.job_group enum 값이어야 한다 — 캐스팅 실패는 22P02 다.
-- -----------------------------------------------------------------------------
create or replace function public.replace_ranking_snapshot(
  p_rank_type public.ranking_type,
  p_rows jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot timestamptz := now();
  row_count integer;
  keep_from timestamptz;
begin
  if not public.is_admin() then
    raise exception '관리자만 랭킹 스냅샷을 교체할 수 있습니다.'
      using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows 는 jsonb 배열이어야 합니다.'
      using errcode = '22023';
  end if;

  row_count := jsonb_array_length(p_rows);

  if row_count = 0 then
    raise exception '빈 스냅샷은 저장하지 않습니다.'
      using errcode = '22023';
  end if;

  -- 필수 칸 검사. 여기서 걸러야 아래 insert 가 not-null 위반으로 죽는 대신
  -- 관리자 화면이 읽을 수 있는 메시지가 나간다.
  if exists (
    select 1
    from jsonb_array_elements(p_rows) as element
    where coalesce(nullif(trim(element ->> 'character_name'), ''), '') = ''
       or coalesce(nullif(trim(element ->> 'job'), ''), '') = ''
       or coalesce(nullif(trim(element ->> 'job_group'), ''), '') = ''
       or (element ->> 'rank') is null
  ) then
    raise exception 'rank · character_name · job · job_group 은 모든 행에 있어야 합니다.'
      using errcode = '22023';
  end if;

  -- 순위는 1..n 연속이어야 한다. 중복도 여기서 함께 걸린다(개수 비교).
  if exists (
    select 1
    from generate_series(1, row_count) as expected(rank)
    where not exists (
      select 1
      from jsonb_array_elements(p_rows) as element
      where (element ->> 'rank')::integer = expected.rank
    )
  ) then
    raise exception '순위는 1부터 %까지 빠짐없이 이어져야 합니다.', row_count
      using errcode = '22023';
  end if;

  insert into public.rankings (
    rank_type, rank, character_name, avatar_url, level,
    job, job_group, guild, guild_icon_url, exp, snapshot_at
  )
  select
    p_rank_type,
    (element ->> 'rank')::integer,
    trim(element ->> 'character_name'),
    nullif(trim(coalesce(element ->> 'avatar_url', '')), ''),
    coalesce((element ->> 'level')::integer, 1),
    trim(element ->> 'job'),
    (trim(element ->> 'job_group'))::public.job_group,
    nullif(trim(coalesce(element ->> 'guild', '')), ''),
    nullif(trim(coalesce(element ->> 'guild_icon_url', '')), ''),
    nullif(trim(coalesce(element ->> 'exp', '')), ''),
    snapshot
  from jsonb_array_elements(p_rows) as element;

  /* 보관 정책: 같은 rank_type 의 최근 5개 스냅샷만 남긴다. 이력이 필요한 이유는
     "잘못 올렸을 때 직전으로 되돌리기" 하나뿐이라 무한히 쌓을 이유가 없다.
     방금 만든 스냅샷도 이 5개에 포함된다. */
  select min(snapshot_at)
    into keep_from
    from (
      select distinct snapshot_at
        from public.rankings
       where rank_type = p_rank_type
       order by snapshot_at desc
       limit 5
    ) as recent;

  delete from public.rankings
   where rank_type = p_rank_type
     and snapshot_at < keep_from;

  return snapshot;
end;
$$;

comment on function public.replace_ranking_snapshot(public.ranking_type, jsonb) is
  '관리자 전용. 랭킹 스냅샷을 한 트랜잭션에서 통째로 적재하고 최근 5개만 남긴 뒤 새 snapshot_at 을 돌려준다. is_admin() 이 아니면 42501.';

-- DEFINER 함수는 실행 권한을 최소로 좁힌다. anon 이 실행할 수 있으면 RLS 우회
-- 경로가 그대로 열린다(함수 안 is_admin() 검사가 유일한 방어선이 되어선 안 된다).
revoke execute on function public.replace_ranking_snapshot(public.ranking_type, jsonb) from public;
revoke execute on function public.replace_ranking_snapshot(public.ranking_type, jsonb) from anon;
grant execute on function public.replace_ranking_snapshot(public.ranking_type, jsonb) to authenticated;
grant execute on function public.replace_ranking_snapshot(public.ranking_type, jsonb) to service_role;
