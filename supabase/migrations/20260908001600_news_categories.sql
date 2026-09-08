-- -----------------------------------------------------------------------------
-- 뉴스 말머리 확장 — 점검안내 · 업데이트 안내 · 안내사항
--
-- Figma `공지별 배너_1200x628`(2032:1882) 이 배너를 6종으로 주기 때문에
-- 말머리도 6종으로 맞춘다. 칩·배너·뱃지가 같은 키(`key`)를 공유하므로
-- 프론트에서는 public/images/news/banners/<key>.png 로 배너를 찾는다.
--
-- color 는 hex 가 아니라 BADGE_CLASS 토큰 키다(Tailwind v4 정적 스캔).
-- 뉴스 '안내사항'은 커뮤니티 'info'(정보)가 이미 초록을 쓰고 있어
-- 'news-info' 라는 별도 토큰 키를 갖는다.
-- -----------------------------------------------------------------------------

insert into public.board_categories (id, board, key, label, color, sort_order, is_active) values
  ('77777777-0000-4000-8000-000000000004', 'news', 'maintenance', '점검안내', 'maintenance', 2, true),
  ('77777777-0000-4000-8000-000000000005', 'news', 'update', '업데이트 안내', 'update', 3, true),
  ('77777777-0000-4000-8000-000000000006', 'news', 'info', '안내사항', 'news-info', 6, true)
on conflict (board, key) do nothing;

-- 칩 노출 순서: 공지사항 · 점검안내 · 업데이트 안내 · 패치노트 · 이벤트 · 안내사항.
-- 기존 3종(notice/patch/event)의 sort_order 도 새 순서에 맞춰 다시 매긴다.
update public.board_categories as target
set sort_order = ordered.sort_order
from (values
  ('notice', 1),
  ('maintenance', 2),
  ('update', 3),
  ('patch', 4),
  ('event', 5),
  ('info', 6)
) as ordered (key, sort_order)
where target.board = 'news'
  and target.key = ordered.key
  and target.sort_order is distinct from ordered.sort_order;
