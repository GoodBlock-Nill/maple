-- =============================================================================
-- 20260910000500_inquiry_category_admin
-- 관리자 콘솔의 문의 카테고리 관리에 필요한 두 함수.
--
--   1) public.inquiry_category_usage()   — 라벨별 문의 수(삭제 가능 여부 · 필터 옵션)
--   2) public.update_inquiry_category()  — 카테고리 수정 + 라벨 변경의 연쇄 반영
--
-- `inquiries.category` 는 라벨 문자열이다(20260910000400 머리말). 그래서 라벨을
-- 바꾸면 과거 문의가 **가리키는 곳을 잃는다** — 목록 필터에서 사라지고 통계가 갈린다.
-- 라벨 변경과 과거 문의의 재라벨링은 반드시 함께 성공하거나 함께 실패해야 하므로
-- 한 함수(=한 트랜잭션) 안에서 처리한다.
--
-- 알려진 부수 효과: 재라벨링은 `inquiries.updated_at` 을 건드린다(set_updated_at 트리거).
-- 트리거를 끄면 잠금 범위가 테이블 전체로 커지므로 그대로 둔다 — 화면의 "수정일"이
-- 카테고리 개명 시각으로 밀릴 뿐, 문의 내용·상태·이력은 그대로다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. inquiry_category_usage()
--
-- SECURITY INVOKER 다. 관리자 세션에서는 `inquiries_select_admin` 이 전체 행을 열어
-- 정확한 집계가 나오고, 일반 사용자가 부르면 자기 문의만 세어진다(정보가 새지 않는다).
--
-- 관리자 화면은 이 결과로 두 가지를 한다.
--   · 카테고리 삭제 가능 여부(0건일 때만 삭제, 그 외에는 비활성화를 권한다)
--   · 목록 필터의 옵션(= DB 카테고리 + 데이터에만 남은 옛 라벨)
-- -----------------------------------------------------------------------------
create or replace function public.inquiry_category_usage()
returns table (category text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select i.category, count(*) as total
  from public.inquiries as i
  group by i.category
$$;

comment on function public.inquiry_category_usage() is
  '라벨별 문의 수. 카테고리 삭제 가능 여부와 목록 필터 옵션(옛 라벨 포함)을 여기서 얻는다.';

grant execute on function public.inquiry_category_usage() to authenticated;
grant execute on function public.inquiry_category_usage() to service_role;

-- -----------------------------------------------------------------------------
-- 2. update_inquiry_category()
--
-- 카테고리 한 행을 고치고, 라벨이 바뀌었으면 그 라벨로 접수된 문의를 새 라벨로
-- 옮긴다. 돌려주는 값은 옮긴 문의 수다(관리자 감사 로그와 완료 안내에 쓴다).
--
-- 권한은 함수가 스스로 다시 본다. RLS 만 믿으면 비관리자가 불렀을 때 "0건 갱신"이
-- 조용히 성공으로 돌아오고, 최악의 경우 자기 문의의 분류만 바꾸는 길이 열린다.
-- -----------------------------------------------------------------------------
create or replace function public.update_inquiry_category(
  p_id uuid,
  p_key text,
  p_label text,
  p_description text,
  p_prefill text,
  p_sort_order integer,
  p_is_active boolean
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_label text;
  moved integer := 0;
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  select label into old_label
  from public.inquiry_categories
  where id = p_id
  for update;

  if old_label is null then
    raise exception '카테고리를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  update public.inquiry_categories
  set key = p_key,
      label = p_label,
      description = p_description,
      prefill = p_prefill,
      sort_order = p_sort_order,
      is_active = p_is_active
  where id = p_id;

  if p_label is distinct from old_label then
    update public.inquiries
    set category = p_label
    where category = old_label;

    get diagnostics moved = row_count;
  end if;

  return moved;
end;
$$;

comment on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean) is
  '카테고리 수정 + 라벨 변경 시 과거 문의의 category 재라벨링을 한 트랜잭션으로 묶는다. 반환값은 옮긴 문의 수.';

grant execute on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean)
  to authenticated;
grant execute on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean)
  to service_role;
