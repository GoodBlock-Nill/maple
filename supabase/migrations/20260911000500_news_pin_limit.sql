-- =============================================================================
-- 20260911000500_news_pin_limit
-- 뉴스 상단 고정 최대 3개(2026-09-11 운영 요청).
--
-- 배경
--   상단 고정(`posts.is_pinned`)은 개수 제한이 없었다. 운영자가 계속 고정만
--   누르면 "고정"이 목록 절반을 채워 원래 목적(중요한 공지를 눈에 띄게)을
--   잃는다.
--
-- 집계 기준 — 세는 것은 "클라이언트에 실제로 뜰 수 있는" 고정 글뿐이다.
--   is_pinned AND is_published AND NOT is_hidden AND deleted_at IS NULL
--   (`published_at` 이 미래인 예약 글은 포함한다 — 예약이 지나면 트리거 없이도
--   그대로 노출되므로, 지금 세어 두지 않으면 나중에 한도를 넘겨도 아무도 막지
--   못한다.) 임시저장·숨김 글에 고정 표시만 미리 걸어 두는 것은 막지 않는다 —
--   클라이언트에 어차피 보이지 않기 때문이다. 그 글을 나중에 발행하거나 숨김을
--   해제하는 UPDATE 도 이 트리거를 다시 타므로, "고정된 채로 몰래 한도를 넘기는"
--   경로가 없다(관리자 화면 admin/lib/data/news.ts 의 `getPinnedNewsSummary()` 가
--   같은 조건으로 화면에 "고정 n/3" 을 보여 준다).
--
-- 서버 액션(admin/lib/actions/news-actions.ts)이 저장 전에 같은 조건으로 먼저
-- 걸러 안내 문구를 보여 주지만, 동시에 두 글을 고정하는 요청은 애플리케이션
-- 레벨의 "먼저 세고 나중에 쓰는" 검사만으로 막을 수 없다(TOCTOU). 최종 방어선은
-- 여기 트리거다 — SECURITY INVOKER 로 두어, 애초에 news 를 쓸 수 없는 사람은
-- (posts_update_admin/posts_insert_admin) 이 트리거에도 닿지 않는다.
-- =============================================================================

create or replace function public.guard_news_pin_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  pinned_count integer;
begin
  -- 뉴스가 아니거나, 이 행이 애초에 "고정 집계"에 들어가지 않으면 검사할 필요가 없다.
  if new.board <> 'news'
     or not new.is_pinned
     or not new.is_published
     or new.is_hidden
     or new.deleted_at is not null
  then
    return new;
  end if;

  select count(*)
    into pinned_count
  from public.posts
  where board = 'news'
    and is_pinned
    and is_published
    and not is_hidden
    and deleted_at is null
    and id <> new.id;

  if pinned_count >= 3 then
    -- 문구는 코드 상수가 아니라 여기 고정 문자열이다 — admin/lib/actions/news-actions.ts
    -- 가 이 메시지를 보고 같은 한국어 안내로 옮긴다(원문은 화면에 노출하지 않는다,
    -- DEVELOPER-GUIDE §7.1).
    raise exception using
      errcode = 'P0001',
      message = 'news_pin_limit_exceeded';
  end if;

  return new;
end;
$$;

comment on function public.guard_news_pin_limit() is
  'SECURITY INVOKER. 뉴스 상단 고정 최대 3개 — 발행 중(is_published)·숨김 아님·삭제 아님인 글만 센다. 초과 시 news_pin_limit_exceeded 를 던진다(admin/lib/actions/news-actions.ts 가 한국어 문구로 옮긴다).';

drop trigger if exists guard_news_pin_limit on public.posts;
create trigger guard_news_pin_limit
  before insert or update on public.posts
  for each row execute function public.guard_news_pin_limit();
