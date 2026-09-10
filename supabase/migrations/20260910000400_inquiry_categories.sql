-- =============================================================================
-- 20260910000400_inquiry_categories
-- 1:1 문의 카테고리 + 카테고리별 프리필(문의 내용 양식).
--
--   운영자 ──관리자 콘솔──▶ inquiry_categories ──공개 읽기──▶ 사용자 문의 폼
--                                                              (선택 시 내용 프리필)
--
-- 이 마이그레이션이 다루는 것
--   1) public.inquiry_categories — 라벨 · 설명 · 프리필 양식 · 정렬 · 활성 여부
--   2) RLS — 활성 행은 누구나 읽고(라벨·프리필은 공개 문구다), 쓰기는 관리자만
--   3) docs/1on1.md 의 8개 카테고리 시드
--
-- `inquiries.category` 는 **text(라벨) 그대로** 둔다. 외래키로 묶으면
--   (1) 이미 쌓인 '계정' · '결제' 같은 값이 제약 위반으로 남고,
--   (2) 카테고리를 지우는 순간 과거 문의의 분류가 사라진다.
-- 접수 시점의 유효성은 앱(서버 액션)이 활성 라벨 목록으로 검사하고, 관리자 목록
-- 필터는 DB 카테고리 + 데이터에 남은 옛 값을 함께 보여 준다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. inquiry_categories
--
-- key 는 라벨과 별개인 안정 식별자다. 운영자가 라벨을 고쳐도(예: '접속·서버' →
-- '접속/서버') 코드·시드가 같은 행을 가리킬 수 있어야 한다.
--
-- label 에 unique 를 거는 이유는 `inquiries.category` 가 라벨을 저장하기 때문이다.
-- 같은 라벨이 두 행에 있으면 "이 문의가 어느 카테고리인지"가 갈린다.
-- -----------------------------------------------------------------------------
create table if not exists public.inquiry_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  description text,
  prefill text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inquiry_categories_key_shape check (key ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  constraint inquiry_categories_label_length check (char_length(label) between 1 and 20),
  constraint inquiry_categories_description_length
    check (description is null or char_length(description) <= 100),
  constraint inquiry_categories_prefill_length check (char_length(prefill) <= 2000)
);

comment on table public.inquiry_categories is
  '1:1 문의 카테고리와 카테고리별 프리필 양식. 활성 행은 공개 읽기(사용자 문의 폼이 그대로 읽는다).';
comment on column public.inquiry_categories.key is
  '안정 식별자(슬러그). 라벨을 고쳐도 같은 행을 가리키기 위한 값이라 화면에는 보이지 않는다.';
comment on column public.inquiry_categories.label is
  '화면 표시 문구이자 inquiries.category 에 그대로 저장되는 값. 20자 이하.';
comment on column public.inquiry_categories.description is
  '카테고리 선택 아래 한 줄 안내. 비워 두면 아무것도 그리지 않는다.';
comment on column public.inquiry_categories.prefill is
  '카테고리를 고르면 문의 내용 textarea 에 채워지는 평문 양식. 줄바꿈은 LF 로 저장한다.';
comment on column public.inquiry_categories.is_active is
  '비활성 카테고리는 사용자 폼에서 사라지고 접수도 거절된다. 과거 문의의 분류 문자열은 그대로 남는다.';

create unique index if not exists inquiry_categories_key_key
  on public.inquiry_categories (key);

create unique index if not exists inquiry_categories_label_key
  on public.inquiry_categories (label);

create index if not exists inquiry_categories_active_sort_idx
  on public.inquiry_categories (sort_order, created_at)
  where is_active;

drop trigger if exists set_inquiry_categories_updated_at on public.inquiry_categories;
create trigger set_inquiry_categories_updated_at
  before update on public.inquiry_categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. RLS
--
-- 활성 행은 anon 에게도 연다 — 로그인하지 않은 방문자도 문의 폼의 카테고리를 보고
-- 어떤 양식을 써야 하는지 알 수 있어야 한다(제출만 로그인이 필요하다).
-- 비활성 행은 관리자만 본다(정리 중인 카테고리가 사용자 폼에 비치지 않게).
-- -----------------------------------------------------------------------------
alter table public.inquiry_categories enable row level security;

-- Supabase 의 기본 권한(alter default privileges)은 마이그레이션으로 만든 테이블에
-- 자동으로 붙지 않는다. RLS 앞에 테이블 권한이 없으면 정책이 통과해도 42501 이 난다.
grant select on public.inquiry_categories to anon, authenticated;
grant insert, update, delete on public.inquiry_categories to authenticated;
grant all on public.inquiry_categories to service_role;

drop policy if exists inquiry_categories_select_active on public.inquiry_categories;
create policy inquiry_categories_select_active on public.inquiry_categories
  for select to anon, authenticated
  using (is_active);

drop policy if exists inquiry_categories_admin_all on public.inquiry_categories;
create policy inquiry_categories_admin_all on public.inquiry_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. 시드 — docs/1on1.md 의 8개 카테고리
--
-- `on conflict do nothing` 이다. 운영자가 프리필을 고친 뒤 마이그레이션을 다시
-- 돌려도 문구가 원본으로 되돌아가지 않는다.
-- -----------------------------------------------------------------------------
insert into public.inquiry_categories (key, label, description, prefill, sort_order)
values
  (
    'connection',
    '접속·서버',
    '로그인·접속 불가, 강제 종료, 서버 지연처럼 게임에 들어가지 못하는 문제.',
    $prefill$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 로그인/접속 불가
- 강제 종료
- 지연/서버 장애

발생 일시: 2026년 1월 1일 12시 12분 경
상세 내용:
첨부 자료(사진, 영상 등):$prefill$,
    0
  ),
  (
    'character',
    '캐릭터·게임 진행',
    '퀘스트·콘텐츠 진행 불가, 캐릭터/맵/NPC 오류, 보상 획득 오류.',
    $prefill$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 퀘스트/콘텐츠 진행 불가
- 캐릭터/맵/NPC 오류
- 보상 획득 오류

발생 일시: 2026년 1월 1일 12시 12분 경
발생 위치/채널:
상세 내용:
첨부 자료(사진, 영상 등):$prefill$,
    1
  ),
  (
    'save-data',
    '저장·데이터',
    '데이터 롤백, 아이템·재화·진행상황 유실, 저장되지 않는 문제.',
    $prefill$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 데이터 롤백
- 아이템/재화/진행상황 유실
- 저장되지 않음

정상 확인 시점:
변경/유실 내용:
발생 상황:
첨부 자료(사진, 영상 등):$prefill$,
    2
  ),
  (
    'currency',
    '재화·아이템',
    '아이템 미지급·소실, 재화 증감 오류, 비정상 획득, 거래 오류.',
    $prefill$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 아이템 미지급/소실
- 재화 증가/감소 오류
- 비정상 재화/아이템 획득
- 거래 오류

발생 일시: 2026년 1월 1일 12시 12분 경
재화/아이템 정보:
발생 경로:
변경/유실 내용:
첨부 자료(사진, 영상 등):$prefill$,
    3
  ),
  (
    'content-balance',
    '콘텐츠·밸런스',
    '성장·난이도, 드랍·보상 밸런스, 콘텐츠 개선 의견.',
    $prefill$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 성장/난이도
- 드랍/보상
- 콘텐츠 개선 의견

콘텐츠명:
체감/불편 사항:
개선 의견:$prefill$,
    4
  ),
  (
    'account-environment',
    '계정·이용환경',
    '계정·캐릭터 관련, 설치·업데이트, CBT 참여 문의.',
    $prefill$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 계정/캐릭터 관련
- 설치/업데이트
- CBT 참여 관련

발생 일시: 2026년 1월 1일 12시 12분 경
문의 내용:
첨부 자료(사진, 영상 등):$prefill$,
    5
  ),
  (
    'feature-ui',
    '기능·UI',
    '기능 오류, UI·그래픽·사운드 오류, 성능·프레임 문제.',
    $prefill$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 기능 오류
- UI/그래픽/사운드 오류
- 성능/프레임 문제

발생 일시: 2026년 1월 1일 12시 12분 경
콘텐츠명:
발생 위치:
발생 상황, 상세 내용:
재현 여부: 항상 발생 / 간헐적 발생 / 1회 발생$prefill$,
    6
  ),
  (
    'etc',
    '기타·건의',
    '시스템·운영·콘텐츠 제안 등 위 분류에 없는 이야기.',
    $prefill$글자월드 캐릭터 닉네임:

건의 주제: 시스템, 운영, 콘텐츠, 제안 등
상세 내용, 현재 불편한 점 등: 자유롭게 작성$prefill$,
    7
  )
on conflict (key) do nothing;
