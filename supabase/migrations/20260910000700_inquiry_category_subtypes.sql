-- =============================================================================
-- 20260910000700_inquiry_category_subtypes
-- 카테고리별 "세부 문의 유형" — 프리필 안내문에서 셀렉트 선택지로 옮긴다.
--
--   (전) 카테고리 선택 → 프리필 본문에 "세부 문의 유형 (해당 항목만 남겨 주세요)"
--        + 유형 셀렉트는 '문의 · 신고 · 제안' 고정 3종
--   (후) 카테고리 선택 → 그 카테고리의 세부 유형이 셀렉트에 채워지고
--        `inquiries.type` 에 고른 세부 유형 라벨이 그대로 저장된다
--
-- 이 마이그레이션이 다루는 것
--   1) inquiry_categories.subtypes text[] — 카테고리별 세부 유형(≤ 20개 · 각 ≤ 30자)
--   2) docs/1on1.md 의 세부 유형 시드(8종 중 7종. '기타·건의' 는 문서에 항목이 없다)
--   3) 프리필에서 "세부 문의 유형" 블록 제거 — **원본 시드 그대로인 행만**
--   4) update_inquiry_category() 에 p_subtypes 추가(관리자 수정 경로)
--   5) inquiry_type_usage() — 유형별 문의 수(관리자 목록 필터의 옛 값 보존)
--
-- `inquiries.type` 은 계속 **text(라벨) 그대로**다. 카테고리(`category`)와 같은 이유다 —
-- 외래키로 묶으면 이미 쌓인 '문의' · '신고' · '제안' 이 제약 위반으로 남고, 유형을
-- 지우는 순간 과거 문의의 분류가 사라진다. 접수 시점의 유효성은 앱(서버 액션)이
-- 활성 카테고리의 세부 유형 목록으로 검사하고, 관리자 목록 필터는 DB 의 세부 유형 +
-- 데이터에 남은 옛 값을 함께 보여 준다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. subtypes 컬럼
--
-- 요소 검사를 CHECK 식에 직접 쓸 수 없어(부분 질의 불가) immutable 함수로 뺀다.
-- 함수는 인자만 보고 판정하므로 테이블을 읽지 않는다 — CHECK 에 넣어도 안전하다.
--
-- 상한(20개 · 30자)은 관리자 검증(`admin/lib/validation/inquiry-categories.ts`)과
-- **같은 숫자**여야 한다. 어긋나면 화면이 통과시킨 값이 저장에서 23514 로 떨어져
-- 운영자는 이유를 알 수 없는 실패를 본다.
-- -----------------------------------------------------------------------------
create or replace function public.inquiry_subtypes_valid(p_subtypes text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_subtypes is not null
     and coalesce(array_length(p_subtypes, 1), 0) <= 20
     -- 다차원 배열은 화면이 그릴 수 없다. 1차원(또는 빈 배열)만 받는다.
     and coalesce(array_ndims(p_subtypes), 1) = 1
     and not exists (
       select 1
       from unnest(p_subtypes) as element
       where element is null
          or btrim(element) = ''
          or char_length(element) > 30
     )
$$;

comment on function public.inquiry_subtypes_valid(text[]) is
  '세부 문의 유형 배열의 모양 검사(1차원 · 20개 이하 · 각 1~30자 · null/공백 없음). CHECK 제약에서 쓴다.';

alter table public.inquiry_categories
  add column if not exists subtypes text[] not null default '{}';

comment on column public.inquiry_categories.subtypes is
  '카테고리별 세부 문의 유형. 사용자 폼의 유형 셀렉트 선택지이자 inquiries.type 에 저장되는 값. 비어 있으면 폼이 셀렉트를 감추고 ''기타'' 로 접수한다.';

alter table public.inquiry_categories
  drop constraint if exists inquiry_categories_subtypes_shape;

alter table public.inquiry_categories
  add constraint inquiry_categories_subtypes_shape
  check (public.inquiry_subtypes_valid(subtypes));

-- -----------------------------------------------------------------------------
-- 2. 세부 유형 시드 — docs/1on1.md 의 "세부 문의 유형" 항목
--
-- key 로 찍는다(라벨은 운영자가 바꿨을 수 있다). 이미 값을 넣어 둔 행은 건드리지
-- 않는다 — `subtypes = '{}'` 조건이 그 방어다.
--
-- '기타·건의'(key = 'etc')는 문서에 세부 유형이 없어 **비워 둔다**. 폼은 세부 유형이
-- 없는 카테고리에서 셀렉트를 감추고 '기타' 로 접수한다(관리자가 나중에 항목을 넣으면
-- 그때부터 셀렉트가 생긴다 — 코드 수정 없이).
-- -----------------------------------------------------------------------------
update public.inquiry_categories
set subtypes = array['로그인/접속 불가', '강제 종료', '지연/서버 장애']
where key = 'connection' and subtypes = '{}';

update public.inquiry_categories
set subtypes = array['퀘스트/콘텐츠 진행 불가', '캐릭터/맵/NPC 오류', '보상 획득 오류']
where key = 'character' and subtypes = '{}';

update public.inquiry_categories
set subtypes = array['데이터 롤백', '아이템/재화/진행상황 유실', '저장되지 않음']
where key = 'save-data' and subtypes = '{}';

update public.inquiry_categories
set subtypes = array['아이템 미지급/소실', '재화 증가/감소 오류', '비정상 재화/아이템 획득', '거래 오류']
where key = 'currency' and subtypes = '{}';

update public.inquiry_categories
set subtypes = array['성장/난이도', '드랍/보상', '콘텐츠 개선 의견']
where key = 'content-balance' and subtypes = '{}';

update public.inquiry_categories
set subtypes = array['계정/캐릭터 관련', '설치/업데이트', 'CBT 참여 관련']
where key = 'account-environment' and subtypes = '{}';

update public.inquiry_categories
set subtypes = array['기능 오류', 'UI/그래픽/사운드 오류', '성능/프레임 문제']
where key = 'feature-ui' and subtypes = '{}';

-- -----------------------------------------------------------------------------
-- 3. 프리필에서 "세부 문의 유형" 블록 제거
--
-- 이제 셀렉트가 같은 것을 묻는다. 양식에도 남겨 두면 사용자는 **두 번** 고르게 되고,
-- 둘이 어긋난 문의(셀렉트는 '강제 종료', 본문은 '로그인/접속 불가')가 들어온다.
--
-- 조건이 `prefill = <원본 시드>` 인 것이 이 블록의 핵심이다. 운영자가 관리자에서
-- 고친 양식은 한 글자라도 다르면 그대로 둔다 — 운영 중인 문구를 마이그레이션이
-- 말없이 덮어쓰면 되돌릴 근거가 없다. 그런 행의 안내문 정리는 관리자 화면에서
-- 사람이 판단할 일이다.
-- -----------------------------------------------------------------------------
update public.inquiry_categories
set prefill = $new$글자월드 캐릭터 닉네임:

발생 일시: 2026년 1월 1일 12시 12분 경
상세 내용:
첨부 자료(사진, 영상 등):$new$
where key = 'connection'
  and prefill = $orig$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 로그인/접속 불가
- 강제 종료
- 지연/서버 장애

발생 일시: 2026년 1월 1일 12시 12분 경
상세 내용:
첨부 자료(사진, 영상 등):$orig$;

update public.inquiry_categories
set prefill = $new$글자월드 캐릭터 닉네임:

발생 일시: 2026년 1월 1일 12시 12분 경
발생 위치/채널:
상세 내용:
첨부 자료(사진, 영상 등):$new$
where key = 'character'
  and prefill = $orig$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 퀘스트/콘텐츠 진행 불가
- 캐릭터/맵/NPC 오류
- 보상 획득 오류

발생 일시: 2026년 1월 1일 12시 12분 경
발생 위치/채널:
상세 내용:
첨부 자료(사진, 영상 등):$orig$;

update public.inquiry_categories
set prefill = $new$글자월드 캐릭터 닉네임:

정상 확인 시점:
변경/유실 내용:
발생 상황:
첨부 자료(사진, 영상 등):$new$
where key = 'save-data'
  and prefill = $orig$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 데이터 롤백
- 아이템/재화/진행상황 유실
- 저장되지 않음

정상 확인 시점:
변경/유실 내용:
발생 상황:
첨부 자료(사진, 영상 등):$orig$;

update public.inquiry_categories
set prefill = $new$글자월드 캐릭터 닉네임:

발생 일시: 2026년 1월 1일 12시 12분 경
재화/아이템 정보:
발생 경로:
변경/유실 내용:
첨부 자료(사진, 영상 등):$new$
where key = 'currency'
  and prefill = $orig$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 아이템 미지급/소실
- 재화 증가/감소 오류
- 비정상 재화/아이템 획득
- 거래 오류

발생 일시: 2026년 1월 1일 12시 12분 경
재화/아이템 정보:
발생 경로:
변경/유실 내용:
첨부 자료(사진, 영상 등):$orig$;

update public.inquiry_categories
set prefill = $new$글자월드 캐릭터 닉네임:

콘텐츠명:
체감/불편 사항:
개선 의견:$new$
where key = 'content-balance'
  and prefill = $orig$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 성장/난이도
- 드랍/보상
- 콘텐츠 개선 의견

콘텐츠명:
체감/불편 사항:
개선 의견:$orig$;

update public.inquiry_categories
set prefill = $new$글자월드 캐릭터 닉네임:

발생 일시: 2026년 1월 1일 12시 12분 경
문의 내용:
첨부 자료(사진, 영상 등):$new$
where key = 'account-environment'
  and prefill = $orig$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 계정/캐릭터 관련
- 설치/업데이트
- CBT 참여 관련

발생 일시: 2026년 1월 1일 12시 12분 경
문의 내용:
첨부 자료(사진, 영상 등):$orig$;

update public.inquiry_categories
set prefill = $new$글자월드 캐릭터 닉네임:

발생 일시: 2026년 1월 1일 12시 12분 경
콘텐츠명:
발생 위치:
발생 상황, 상세 내용:
재현 여부: 항상 발생 / 간헐적 발생 / 1회 발생$new$
where key = 'feature-ui'
  and prefill = $orig$글자월드 캐릭터 닉네임:

세부 문의 유형 (해당 항목만 남겨 주세요)
- 기능 오류
- UI/그래픽/사운드 오류
- 성능/프레임 문제

발생 일시: 2026년 1월 1일 12시 12분 경
콘텐츠명:
발생 위치:
발생 상황, 상세 내용:
재현 여부: 항상 발생 / 간헐적 발생 / 1회 발생$orig$;

-- -----------------------------------------------------------------------------
-- 4. update_inquiry_category() — p_subtypes 추가
--
-- 인자 하나가 늘었다. 옛 7-인자 함수를 남겨 두면 PostgREST 가 이름으로 골라 주는
-- 동안에도 "세부 유형만 저장되지 않는" 경로가 살아 있게 되므로 **먼저 지운다**.
-- 나머지 규약은 그대로다 — 라벨 변경 시 과거 문의의 재라벨링을 같은 트랜잭션에서
-- 처리하고, 옮긴 문의 수를 돌려준다(20260910000500 머리말).
-- -----------------------------------------------------------------------------
drop function if exists public.update_inquiry_category(uuid, text, text, text, text, integer, boolean);

create or replace function public.update_inquiry_category(
  p_id uuid,
  p_key text,
  p_label text,
  p_description text,
  p_prefill text,
  p_sort_order integer,
  p_is_active boolean,
  p_subtypes text[]
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
      is_active = p_is_active,
      /* null 은 "바꾸지 않음"이 아니라 잘못된 호출이다. 컬럼이 not null 이므로
         빈 배열로 눕혀 제약 위반(23502) 대신 "세부 유형 없음"으로 저장한다. */
      subtypes = coalesce(p_subtypes, '{}')
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

comment on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean, text[]) is
  '카테고리 수정(세부 유형 포함) + 라벨 변경 시 과거 문의의 category 재라벨링을 한 트랜잭션으로 묶는다. 반환값은 옮긴 문의 수.';

grant execute on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean, text[])
  to authenticated;
grant execute on function public.update_inquiry_category(uuid, text, text, text, text, integer, boolean, text[])
  to service_role;

-- -----------------------------------------------------------------------------
-- 5. inquiry_type_usage()
--
-- `inquiry_category_usage()` 와 같은 규격이다(SECURITY INVOKER — 관리자 세션에서만
-- 전체가 보이고, 일반 사용자가 부르면 자기 문의만 세어진다).
--
-- 관리자 목록의 '유형' 필터가 이 결과를 쓴다. 등록된 세부 유형만 옵션으로 두면
-- 옛 값('문의' · '신고' · '제안')으로 접수된 과거 문의를 필터로 찾을 길이 사라진다.
-- -----------------------------------------------------------------------------
create or replace function public.inquiry_type_usage()
returns table (type text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select i.type, count(*) as total
  from public.inquiries as i
  group by i.type
$$;

comment on function public.inquiry_type_usage() is
  '세부 문의 유형별 문의 수. 관리자 목록 필터의 옵션(데이터에만 남은 옛 유형 포함)을 여기서 얻는다.';

grant execute on function public.inquiry_type_usage() to authenticated;
grant execute on function public.inquiry_type_usage() to service_role;
