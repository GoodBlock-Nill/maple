-- =============================================================================
-- 20260911000600_inquiry_attachments_max_5
-- 1:1 문의 첨부 상한을 3개 → **이미지·PDF 3개 + 영상 2개(합계 5개)** 로 넓힌다.
--
-- 오너 지시(2026-09-11): "첨부파일은 이미지 및 pdf는 최대 3개까지 영상은 최대
-- 2개까지 니깐 용량기준만 맞추면 최대 5개까지 첨부할수 있도록 해야해".
--
-- 종류 판정은 jsonb 원소의 `mimeType` 이 `video/` 로 시작하는지로 본다
-- (`lib/actions/inquiry-attachments.ts` · `lib/actions/inquiry-videos.ts` 가 첨부를
-- 적을 때 쓰는 모양이 `{ name, path, size, mimeType }` 이고, 종류를 담는 별도 열은
-- 없다 — 화면(`isVideoAttachment()`)도 같은 판정을 쓴다).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 종류별 개수를 세는 헬퍼
--
-- CHECK 제약은 다른 테이블을 보는 서브쿼리를 못 쓰지만, 인자로 받은 jsonb 하나만
-- 들여다보는 함수 호출은 된다. `jsonb_array_elements()` 는 배열이 아니면 오류를
-- 던지므로, `inquiries_attachments_is_array` 제약과 별개로 **여기서도** 방어적으로
-- typeof 를 먼저 본다 — 두 제약은 같은 순서로 평가된다는 보장이 없다.
-- -----------------------------------------------------------------------------
create or replace function public.inquiry_attachment_kind_count(
  p_attachments jsonb,
  p_is_video boolean
)
returns integer
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_attachments) = 'array' then (
      select count(*)::integer
      from jsonb_array_elements(p_attachments) as elem
      where p_is_video = (coalesce(elem ->> 'mimeType', '') like 'video/%')
    )
    else 0
  end;
$$;

comment on function public.inquiry_attachment_kind_count(jsonb, boolean) is
  '첨부 jsonb 배열에서 영상(mimeType 이 video/ 로 시작)이거나 그 반대인 원소 수. inquiries 의 개수별 CHECK 제약이 쓴다.';

revoke all on function public.inquiry_attachment_kind_count(jsonb, boolean) from public;
grant execute on function public.inquiry_attachment_kind_count(jsonb, boolean) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. 제약 교체
--
-- 옛 max_3(총 3개)을 걷어내고 셋으로 나눈다 — 총 5개, 이미지·PDF 3개, 영상 2개.
-- 셋 다 있어야 "영상만 5개" 같은 조합이 총합만으로는 통과하는 것을 막는다.
-- -----------------------------------------------------------------------------
alter table public.inquiries
  drop constraint if exists inquiries_attachments_max_3;

alter table public.inquiries
  add constraint inquiries_attachments_max_5
  check (jsonb_typeof(attachments) <> 'array' or jsonb_array_length(attachments) <= 5);

alter table public.inquiries
  add constraint inquiries_attachments_file_kind_max_3
  check (public.inquiry_attachment_kind_count(attachments, false) <= 3);

alter table public.inquiries
  add constraint inquiries_attachments_video_kind_max_2
  check (public.inquiry_attachment_kind_count(attachments, true) <= 2);
