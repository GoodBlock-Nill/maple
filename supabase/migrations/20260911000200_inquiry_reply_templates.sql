-- =============================================================================
-- 20260911000200_inquiry_reply_templates
-- 1:1 문의 답변 템플릿 — 카테고리별 상용구.
--
--   운영자 ──/inquiries/reply-templates──▶ inquiry_reply_templates
--                                                │
--                    문의 상세의 '템플릿 불러오기' ┘ (자리표시자 치환 후 답변 칸에 삽입)
--
-- 이 마이그레이션이 다루는 것
--   1) public.inquiry_reply_templates — 카테고리(또는 공통) · 이름 · 본문 · 정렬 · 활성
--   2) RLS — 관리자만(`is_admin()`). 사용자 사이트는 이 테이블을 보지 않는다.
--   3) 공통 2개 + 카테고리 4종의 기본 문안 시드
--
-- 왜 inquiry_categories 에 칸을 더하지 않는가
--   카테고리 하나에 템플릿은 여러 개다('접수 확인' · '추가 정보 요청' …). 배열 칸으로
--   넣으면 정렬·활성·작성자를 항목마다 들고 있을 수 없고, 한 항목을 고치려고 배열
--   전체를 다시 써야 한다.
--
-- category_id 가 NULL 이면 '공통'이다
--   모든 카테고리에서 보이는 템플릿이다. 별도 플래그(`is_common`)를 두면 "NULL 인데
--   is_common 이 false" 같은 모순 상태가 생긴다. NULL 하나로 규칙이 닫힌다.
--
-- 본문 상한은 **답변 입력칸과 같은 2000자**다
--   불러온 문안이 곧 답변으로 저장된다(`INQUIRY_REPLY_MAX_LENGTH`). 여기가 더 관대하면
--   "불러왔는데 등록할 수 없는" 템플릿이 만들어진다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. inquiry_reply_templates
--
-- 카테고리가 사라지면 그 카테고리 전용 템플릿도 함께 간다(on delete cascade).
-- 남겨 두면 어느 문의에서도 보이지 않는 문안이 목록에만 쌓인다. 공통 템플릿은
-- 카테고리를 가리키지 않으므로 그 삭제에 영향을 받지 않는다.
-- -----------------------------------------------------------------------------
create table if not exists public.inquiry_reply_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.inquiry_categories (id) on delete cascade,
  name text not null,
  body text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inquiry_reply_templates_name_length check (char_length(name) between 1 and 40),
  constraint inquiry_reply_templates_body_length check (char_length(body) between 1 and 2000)
);

comment on table public.inquiry_reply_templates is
  '1:1 문의 답변 상용구. 관리자 전용 — 문의 상세의 답변 칸에 불러다 쓴다.';
comment on column public.inquiry_reply_templates.category_id is
  '이 템플릿이 붙는 문의 카테고리. NULL 이면 공통(모든 카테고리에서 보인다).';
comment on column public.inquiry_reply_templates.name is
  '목록·선택 상자에 보이는 이름(≤ 40자). 운영자가 문안을 고르는 유일한 단서다.';
comment on column public.inquiry_reply_templates.body is
  '답변 칸에 채워지는 평문(≤ 2000자 = 답변 상한). 자리표시자 {{닉네임}} · {{문의번호}} · {{카테고리}} · {{제목}} 는 불러오는 시점에 앱이 치환한다.';
comment on column public.inquiry_reply_templates.is_active is
  '끄면 답변 화면의 선택 상자에서 사라진다. 행과 문안은 그대로 남는다.';

/* 같은 카테고리(공통 포함) 안에서 이름은 하나뿐이다. 선택 상자에 같은 이름이 둘 있으면
   운영자가 무엇이 다른지 알 수 없다. NULL 은 서로 다른 값으로 취급되므로 고정 UUID 로
   접어 비교한다(부분 인덱스 둘로 나누면 '공통 vs 카테고리' 규칙이 두 곳에 흩어진다). */
create unique index if not exists inquiry_reply_templates_name_key
  on public.inquiry_reply_templates
     (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

create index if not exists inquiry_reply_templates_category_sort_idx
  on public.inquiry_reply_templates (category_id, sort_order, created_at);

drop trigger if exists set_inquiry_reply_templates_updated_at on public.inquiry_reply_templates;
create trigger set_inquiry_reply_templates_updated_at
  before update on public.inquiry_reply_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. RLS — 관리자만
--
-- anon · 일반 로그인 사용자에게는 select 도 열지 않는다. 상용구에는 아직 공지되지
-- 않은 점검 일정이나 보상 기준이 적히고, 그것이 사용자에게 먼저 보이면 안 된다.
--
-- Supabase 의 기본 권한은 마이그레이션으로 만든 테이블에 자동으로 붙지 않는다.
-- grant 가 없으면 정책이 통과해도 42501 이 난다(20260910000400 에서 겪은 일).
-- -----------------------------------------------------------------------------
alter table public.inquiry_reply_templates enable row level security;

grant select, insert, update, delete on public.inquiry_reply_templates to authenticated;
grant all on public.inquiry_reply_templates to service_role;

drop policy if exists inquiry_reply_templates_admin_all on public.inquiry_reply_templates;
create policy inquiry_reply_templates_admin_all on public.inquiry_reply_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. 시드 — 공통 2개 + 카테고리 4종
--
-- `where not exists` 로 넣는다. 운영자가 문안을 고치거나 지운 뒤 마이그레이션을 다시
-- 돌려도 원본이 되살아나지 않는다(카테고리 시드와 같은 규칙).
--
-- 카테고리는 `key` 로 찾는다 — 라벨은 운영자가 바꿀 수 있고, 바뀐 뒤에도 같은 행을
-- 가리켜야 한다. 해당 key 가 없으면 그 시드는 조용히 건너뛴다(하위 select 가 비면
-- insert 자체가 0행이다).
-- -----------------------------------------------------------------------------
with seed (category_key, name, body, sort_order) as (
  values
    (
      null::text,
      '접수 확인 안내',
      $tpl$안녕하세요, {{닉네임}}님. 글자월드 운영팀입니다.

문의해 주신 내용(접수번호 {{문의번호}})을 확인했습니다.
담당 부서에서 확인 중이며, 확인이 끝나는 대로 이 화면에 답변을 남기겠습니다.

기다려 주셔서 감사합니다.$tpl$,
      0
    ),
    (
      null,
      '추가 정보 요청',
      $tpl$안녕하세요, {{닉네임}}님. 글자월드 운영팀입니다.

문의해 주신 '{{제목}}' 건을 확인하려면 아래 정보가 더 필요합니다.

- 글자월드 캐릭터 닉네임:
- 발생 일시(예: 2026년 1월 1일 12시 12분경):
- 발생 상황 화면(사진 또는 영상):

남겨 주시면 이어서 확인하겠습니다.$tpl$,
      1
    ),
    (
      'connection',
      '서버 점검 안내',
      $tpl$안녕하세요, {{닉네임}}님. 글자월드 운영팀입니다.

말씀해 주신 접속 문제는 아래 점검 시간과 겹쳐 발생한 것으로 확인됩니다.

- 점검 일시:
- 점검 내용:

점검이 끝난 뒤에도 같은 증상이 이어지면 접속 시각과 화면을 남겨 주세요. 이어서 확인하겠습니다.$tpl$,
      0
    ),
    (
      'save-data',
      '데이터 확인 후 복구 안내',
      $tpl$안녕하세요, {{닉네임}}님. 글자월드 운영팀입니다.

{{카테고리}} 문의를 확인했습니다. 계정 기록을 살펴본 결과는 아래와 같습니다.

- 확인한 기간:
- 확인 결과:
- 복구 여부:

복구가 진행되면 접속 후 확인 부탁드립니다. 다른 점이 있으면 이 문의에 이어서 남겨 주세요.$tpl$,
      0
    ),
    (
      'currency',
      '아이템 지급 처리 완료',
      $tpl$안녕하세요, {{닉네임}}님. 글자월드 운영팀입니다.

문의해 주신 내용(접수번호 {{문의번호}})을 확인해 아래와 같이 처리했습니다.

- 지급 항목:
- 지급 일시:
- 확인 위치: 게임 접속 후 우편함

불편을 드려 죄송합니다. 받지 못하셨다면 이 문의에 이어서 알려 주세요.$tpl$,
      0
    ),
    (
      'etc',
      '건의 접수 감사',
      $tpl$안녕하세요, {{닉네임}}님. 글자월드 운영팀입니다.

'{{제목}}' 건의를 남겨 주셔서 감사합니다. 주신 의견은 담당 부서에 그대로 전달했습니다.

검토에는 시간이 걸릴 수 있고, 반영 여부는 공지로 안내드립니다. 앞으로도 좋은 의견 부탁드립니다.$tpl$,
      0
    )
)
insert into public.inquiry_reply_templates (category_id, name, body, sort_order)
select category.id, seed.name, seed.body, seed.sort_order
from seed
left join public.inquiry_categories as category on category.key = seed.category_key
where (seed.category_key is null or category.id is not null)
  and not exists (
    select 1
    from public.inquiry_reply_templates as existing
    where existing.name = seed.name
      and existing.category_id is not distinct from category.id
  );
