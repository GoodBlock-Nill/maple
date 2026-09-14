-- =============================================================================
-- 20260914000100_inquiry_kind
-- 고객지원 접수 종류(kind) — 1:1 문의 · 버그제보 · 불법이용제보.
--
--   (전) 고객지원 = 1:1 문의 하나. 카테고리 8종이 접속 장애부터 건의까지 전부 받는다.
--   (후) 같은 폼·같은 목록·같은 권한 위에 **축 하나(kind)** 를 더해 세 창구로 나눈다.
--        /support(inquiry) · /support/bug(bug) · /support/report(report)
--
-- 이 마이그레이션이 다루는 것
--   1) inquiry_categories.kind — 카테고리가 어느 창구에 속하는가(sort_order 는 kind 안의 순서)
--   2) inquiries.kind          — 접수된 문의가 어느 창구로 들어왔는가
--   3) set_inquiry_kind_from_category() 트리거 — 카테고리가 kind 의 단일 출처
--   4) 기존 8개 카테고리 중 4개를 bug 로 이동 + kind 안에서 sort_order 재부여
--   5) 불법이용제보(report) 카테고리 5종 시드
--   6) 기존 inquiries 백필
--   7) update_inquiry_category() 9인자 — kind 변경의 연쇄 반영
--
-- **별도 테이블을 두지 않는다.** 세 창구는 폼·첨부·상태·답변·감사 로그가 전부 같다.
-- 테이블을 쪼개면 "내 문의 내역"과 관리자 목록이 매번 세 번 조회해 합쳐야 하고,
-- 답변 템플릿·담당자 배정·이메일 인바운드가 세 벌이 된다. 달라지는 것은 분류 하나뿐이라
-- 열 하나로 충분하다.
--
-- **kind 의 단일 출처는 카테고리다.** inquiries.kind 를 앱이 직접 채우게 두면
-- 클라이언트 · 관리자 · 이메일 웹훅 세 경로가 제각기 다른 값을 넣을 수 있고, 카테고리를
-- 다른 창구로 옮긴 뒤 과거 문의만 옛 kind 로 남는다. 그래서 트리거가 카테고리 라벨로
-- 다시 계산한다(3) — 앱이 넣는 kind 는 의도를 드러내는 주석일 뿐 판정이 아니다.
--
-- 실행 순서가 의미를 가진다: 카테고리 이동(4)·시드(5)를 **먼저** 끝낸 뒤 백필(6)한다.
-- 반대로 하면 백필이 옛 분류(전부 'inquiry')를 굳혀 버린다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. inquiry_categories.kind
--
-- label 의 전역 유니크는 그대로 둔다(20260910000400). 종류가 달라도 같은 라벨을
-- 허용하면 `inquiries.category` 가 라벨 문자열인 이상 "이 문의가 어느 카테고리인지"가
-- 갈리고, 관리자 필터·과거 문의 재라벨링이 통째로 흔들린다.
--
-- sort_order 의 의미가 바뀐다: 전역 순서 → **kind 안에서의 순서**. 관리자 카테고리
-- 화면이 kind 별 3개 섹션으로 나뉘고 순서 이동도 섹션 안에서만 일어난다.
-- -----------------------------------------------------------------------------
alter table public.inquiry_categories
  add column if not exists kind text not null default 'inquiry';

alter table public.inquiry_categories drop constraint if exists inquiry_categories_kind_check;
alter table public.inquiry_categories
  add constraint inquiry_categories_kind_check
  check (kind in ('inquiry', 'bug', 'report'));

comment on column public.inquiry_categories.kind is
  '이 카테고리가 속한 접수 창구. inquiry = 1:1 문의, bug = 버그제보, report = 불법이용제보. inquiries.kind 의 단일 출처다.';

-- 사용자 폼(창구별 카테고리 목록)과 관리자 kind 별 섹션이 그대로 타는 순서다.
create index if not exists inquiry_categories_kind_sort_idx
  on public.inquiry_categories (kind, sort_order, created_at)
  where is_active;

-- -----------------------------------------------------------------------------
-- 2. inquiries.kind
--
-- default 'inquiry' 라 기존 행과 옛 코드의 insert 가 그대로 통과한다. 실제 값은
-- 트리거(3)가 카테고리로 다시 정하므로, 이 기본값은 "카테고리를 못 찾았을 때의
-- 안전한 자리"다 — 분류를 잃은 문의는 1:1 문의 창구에 남아 사람이 볼 수 있다.
-- -----------------------------------------------------------------------------
alter table public.inquiries
  add column if not exists kind text not null default 'inquiry';

alter table public.inquiries drop constraint if exists inquiries_kind_check;
alter table public.inquiries
  add constraint inquiries_kind_check
  check (kind in ('inquiry', 'bug', 'report'));

comment on column public.inquiries.kind is
  '접수 창구. inquiry = 1:1 문의, bug = 버그제보, report = 불법이용제보. 카테고리 라벨로 트리거가 정한다(직접 쓰지 않는다).';

-- 내 문의 내역은 세 종류를 함께 보여 주지만(필터 없음), 창구별 화면·통계가
-- user_id 와 kind 를 함께 좁힌다.
create index if not exists inquiries_user_kind_idx
  on public.inquiries (user_id, kind);

-- 관리자 목록의 종류 필터(?kind=)와 탭 카운트.
create index if not exists inquiries_kind_status_idx
  on public.inquiries (kind, status);

-- -----------------------------------------------------------------------------
-- 3. set_inquiry_kind_from_category()
--
-- SECURITY DEFINER 다. RLS(`inquiry_categories_select_active`)는 일반 사용자에게
-- 활성 행만 연다 — INVOKER 로 두면 **비활성 카테고리로 접수·수정된 문의가 매칭에
-- 실패해** 기본값 'inquiry' 로 떨어진다(버그제보가 1:1 문의 목록에 섞인다).
-- 이 함수는 권한을 판정하지 않고 라벨 → kind 매핑만 읽으므로 DEFINER 로 올려도
-- 새는 정보가 없다(20260908001000 의 사고는 current_user 로 권한을 보던 가드였다).
--
-- 매칭되는 카테고리가 없으면 **값을 건드리지 않는다.** 과거 라벨('계정' · '결제')이나
-- 이메일 인바운드가 넣은 임의 문자열은 카테고리 표에 없다 — 그때는 호출자가 넣은
-- kind(또는 기본값)를 존중하는 편이 "전부 1:1 문의로 되돌리기"보다 덜 파괴적이다.
--
-- update 는 `of category` 로 좁힌다. 상태 변경·답변·잠금 하트비트마다 카테고리 표를
-- 다시 읽을 이유가 없다.
-- -----------------------------------------------------------------------------
create or replace function public.set_inquiry_kind_from_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_kind text;
begin
  select c.kind into matched_kind
  from public.inquiry_categories as c
  where c.label = new.category;

  if matched_kind is not null then
    new.kind := matched_kind;
  end if;

  return new;
end;
$$;

comment on function public.set_inquiry_kind_from_category() is
  '문의의 kind 를 카테고리 라벨로 맞춘다. 매칭 카테고리가 없으면 값을 그대로 둔다. 비활성 카테고리도 봐야 해서 SECURITY DEFINER 다.';

/* 트리거는 이름 순으로 실행된다:
     guard_inquiry_owner_update → inquiries_set_kind_from_category → set_updated_at
   가드가 먼저 "이 수정이 허용되는가"를 판정하고(그 시점의 old/new.kind 는 아직 옛값이라
   가드의 비교 대상에 끼어들지 않는다), 그 뒤 kind 를 다시 계산하고, 마지막에 수정
   시각을 찍는다. 이름을 바꾸면 이 순서가 깨진다. */
drop trigger if exists inquiries_set_kind_from_category on public.inquiries;
create trigger inquiries_set_kind_from_category
  before insert or update of category on public.inquiries
  for each row execute function public.set_inquiry_kind_from_category();

-- -----------------------------------------------------------------------------
-- 4. 기존 8개 카테고리의 창구 재배치
--
-- 접속·서버 / 캐릭터·게임 진행 / 저장·데이터 / 기능·UI 는 "동작이 잘못됐다"는 신고라
-- 버그제보로 간다. 재화·아이템은 버그처럼 보이지만 **운영자 복구가 필요한 문의**라
-- 1:1 에 남긴다(제보로 보내면 답변 없이 닫히는 흐름에 섞인다).
--
-- key 로 찍는다 — 운영자가 라벨을 고쳤을 수 있다.
-- -----------------------------------------------------------------------------
update public.inquiry_categories
set kind = 'bug'
where key in ('connection', 'character', 'save-data', 'feature-ui');

/* sort_order 는 이제 kind 안의 순서다. 전역 0..7 을 그대로 두면 버그제보 섹션이
   0,1,2,6 으로 시작해 관리자 화면의 "위/아래로 이동"이 어긋난다. */
update public.inquiry_categories as c
set sort_order = v.sort_order
from (values
  ('connection', 0),
  ('character', 1),
  ('save-data', 2),
  ('feature-ui', 3),
  ('currency', 0),
  ('content-balance', 1),
  ('account-environment', 2),
  ('etc', 3)
) as v (key, sort_order)
where c.key = v.key
  and c.sort_order is distinct from v.sort_order;

/* '비정상 재화/아이템 획득' 은 남이 한 짓을 알리는 항목이라 제보(bug-abuse)로 옮긴다.
   과거 문의의 `type` 문자열은 그대로 남는다 — 수정 화면은 기존 legacy 처리로
   등록되지 않은 유형도 고를 수 있다(20260910000700 머리말과 같은 규칙). */
update public.inquiry_categories
set subtypes = array_remove(subtypes, '비정상 재화/아이템 획득')
where key = 'currency';

-- -----------------------------------------------------------------------------
-- 5. 불법이용제보(report) 카테고리 시드
--
-- 프리필은 기존 8종과 같은 문체다 — 첫 줄 "글자월드 캐릭터 닉네임:" 뒤 빈 줄, 그다음
-- 항목들. 제보는 **대상이 남이라** 첫 항목이 "제보 대상 닉네임:" 이다.
--
-- `on conflict (key) do nothing` — 운영자가 문구를 고친 뒤 마이그레이션을 다시 돌려도
-- 원본으로 되돌아가지 않는다(20260910000400 §3 과 같은 규칙).
-- -----------------------------------------------------------------------------
insert into public.inquiry_categories (key, label, description, prefill, subtypes, sort_order, kind)
values
  (
    'illegal-program',
    '불법 프로그램',
    '핵·치트·매크로·오토 등 불법 프로그램 사용 제보.',
    e'글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n발생 일시:\n발생 장소(맵/채널):\n상세 내용:\n첨부 자료(사진, 영상 등):',
    array['핵/치트 프로그램', '매크로/오토', '기타 불법 프로그램'],
    0,
    'report'
  ),
  (
    'bug-abuse',
    '버그 악용·비정상 획득',
    '버그를 이용한 이득 취득, 비정상 재화·아이템 획득 제보.',
    e'글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n발생 일시:\n발생 장소(맵/채널):\n상세 내용:\n첨부 자료(사진, 영상 등):',
    array['버그 악용', '비정상 재화/아이템 획득'],
    1,
    'report'
  ),
  (
    'account-trade',
    '계정·현금 거래',
    '계정 공유·거래, 현금 거래, 사기 제보.',
    e'글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n발생 일시:\n거래 내용/금액:\n상세 내용:\n첨부 자료(사진, 영상 등):',
    array['계정 공유/거래', '현금 거래', '사기/먹튀'],
    2,
    'report'
  ),
  (
    'abuse-chat',
    '욕설·비매너',
    '욕설·비방, 성희롱, 도배·광고, 사칭 제보.',
    e'글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n발생 일시:\n발생 장소(맵/채널):\n상세 내용:\n첨부 자료(사진, 영상 등):',
    array['욕설/비방', '성희롱/음란', '도배/광고', '사칭'],
    3,
    'report'
  ),
  (
    'report-etc',
    '기타 제보',
    '위 분류에 없는 불법·부정 이용 제보.',
    e'글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n상세 내용:\n첨부 자료(사진, 영상 등):',
    /* 세부 유형이 없는 카테고리에서 폼은 셀렉트를 감추고 '기타' 로 접수한다. */
    array[]::text[],
    4,
    'report'
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 6. 기존 문의 백필
--
-- 라벨로 조인한다 — `inquiries.category` 가 라벨 문자열이기 때문이다(20260910000400).
-- 카테고리 표에 없는 옛 라벨('계정' · '결제' · 이메일 문의의 임의 문자열)은 그대로
-- 'inquiry' 에 남는다. 트리거(3)와 같은 판정이다.
--
-- `is distinct from` 으로 좁히는 이유는 `set_inquiry_updated_at` 이다 — 값이 그대로인
-- 행까지 UPDATE 하면 목록의 '업데이트' 칸이 마이그레이션 시각으로 전부 밀린다.
-- (트리거가 to_jsonb 비교로 막아 주지만, 애초에 쓰지 않는 편이 잠금 범위도 좁다.)
-- -----------------------------------------------------------------------------
update public.inquiries as i
set kind = c.kind
from public.inquiry_categories as c
where c.label = i.category
  and i.kind is distinct from c.kind;

-- -----------------------------------------------------------------------------
-- 7. update_inquiry_category() — p_kind 추가(9인자)
--
-- 인자가 또 하나 늘었다. 옛 8-인자 함수를 남겨 두면 PostgREST 가 이름으로 골라 주는
-- 동안 "종류만 저장되지 않는" 경로가 살아 있게 되므로 **먼저 지운다**
-- (20260910000700 §4 와 같은 이유).
--
-- kind 변경은 라벨 변경과 **똑같은 문제**를 만든다: 카테고리만 옮기고 과거 문의를 두면
-- 버그제보 창구의 카테고리로 접수된 문의가 1:1 문의 목록에 남는다. 그래서 같은
-- 트랜잭션에서 `inquiries` 를 함께 옮기고, 옮긴 수를 돌려준다 — 라벨·kind 중
-- **하나라도** 바뀌면 센다(관리자 화면이 "N건의 종류도 함께 바뀝니다"를 그린다).
-- -----------------------------------------------------------------------------
drop function if exists public.update_inquiry_category(uuid, text, text, text, text, integer, boolean, text[]);

create or replace function public.update_inquiry_category(
  p_id uuid,
  p_key text,
  p_label text,
  p_description text,
  p_prefill text,
  p_sort_order integer,
  p_is_active boolean,
  p_subtypes text[],
  p_kind text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_label text;
  old_kind text;
  moved integer := 0;
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  /* CHECK 제약이 결국 막지만, 여기서 먼저 끊어야 실패 지점이 분명해진다 —
     23514 는 "어느 열인지"를 화면이 알아내기 어렵다. */
  if p_kind is null or p_kind not in ('inquiry', 'bug', 'report') then
    raise exception '알 수 없는 문의 종류입니다: %', coalesce(p_kind, '(null)')
      using errcode = '22023';
  end if;

  select label, kind into old_label, old_kind
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
      is_active = p_is_active,
      /* null 은 "바꾸지 않음"이 아니라 잘못된 호출이다. 컬럼이 not null 이므로
         빈 배열로 눕혀 제약 위반(23502) 대신 "세부 유형 없음"으로 저장한다. */
      subtypes = coalesce(p_subtypes, '{}'),
      kind = p_kind
  where id = p_id;

  if p_label is distinct from old_label or p_kind is distinct from old_kind then
    /* category 를 SET 에 넣으면 `inquiries_set_kind_from_category` 가 함께 돌아
       kind 를 다시 계산한다(값이 같아도 열이 SET 목록에 있으면 트리거는 발화한다).
       그래도 kind 를 명시하는 이유는 순서 의존을 없애기 위해서다 — 트리거가 빠지거나
       이름이 바뀌어도 이 함수의 약속은 지켜져야 한다. */
    update public.inquiries
    set category = p_label,
        kind = p_kind
    where category = old_label;

    get diagnostics moved = row_count;
  end if;

  return moved;
end;
$$;

comment on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean, text[], text) is
  '카테고리 수정(세부 유형 · 종류 포함) + 라벨/종류 변경 시 과거 문의의 category · kind 재배치를 한 트랜잭션으로 묶는다. 반환값은 옮긴 문의 수.';

grant execute on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean, text[], text)
  to authenticated;
grant execute on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean, text[], text)
  to service_role;

-- -----------------------------------------------------------------------------
-- 8. 손대지 않는 것
--
--   · RLS — inquiries · inquiry_categories 의 정책은 행 조건(소유자 · is_admin ·
--     is_active)만 본다. 열 목록을 열거하지 않으므로 새 열은 자동으로 따라온다.
--     권한도 테이블 단위(`grant select on ... to anon, authenticated`)라 그대로다.
--   · inquiry_category_usage() · inquiry_type_usage() — 라벨·유형 기준 집계라 변화 없다.
--   · inquiry_reply_templates.category_id — 카테고리를 가리키므로 kind 를 따라간다.
--   · 카테고리 등록은 RPC 가 아니라 직접 insert 다(admin/lib/actions/inquiry-category-actions.ts).
--     kind 는 기본값이 있고 관리자 폼이 값을 실어 보내면 그대로 저장된다 — 새 함수가 필요 없다.
-- -----------------------------------------------------------------------------
