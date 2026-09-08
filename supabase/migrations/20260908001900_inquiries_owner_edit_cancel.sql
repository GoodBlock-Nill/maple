-- =============================================================================
-- 20260908001900_inquiries_owner_edit_cancel
-- 1:1 문의 — 소유자의 "접수 취소"와 "수정(접수 대기 한정)".
--
-- 이 마이그레이션이 다루는 세 가지
--   1) `inquiries.cancelled_at` — 취소 시각. enum 에 값을 더하지 않는 이유는
--      `inquiry_status` 를 읽는 코드(관리자 큐 · 통계 · 화면 매핑)가 이미 네 값을
--      전제로 갈라져 있어서다. 취소는 "종료(closed)된 문의 중 사용자가 스스로
--      끝낸 것"이라는 부가 정보이므로 별도 컬럼이 더 안전하다.
--   2) `inquiries_update_own` — 소유자에게 UPDATE 를 연다. 정책은 "어느 행을"
--      만질 수 있는지만 말할 수 있고 "어떤 컬럼을 언제" 는 표현할 수 없다.
--   3) `guard_inquiry_owner_update()` — 그 "어떤 컬럼을 언제"를 강제하는 가드.
--      20260908000700 의 "접수 후 본문 수정은 허용하지 않는다" 주석은 이 파일로
--      대체된다(수정은 접수 대기 상태에서만 열린다).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- cancelled_at
-- null = 취소되지 않음. 취소는 `status = 'closed'` 와 **같은 UPDATE** 에서 찍힌다
-- (가드가 둘을 한 묶음으로만 허용한다).
-- -----------------------------------------------------------------------------
alter table public.inquiries
  add column if not exists cancelled_at timestamptz;

comment on column public.inquiries.cancelled_at is
  '사용자가 스스로 접수를 취소한 시각. null 이면 취소되지 않은 문의다. 취소는 status=closed 와 같은 UPDATE 에서만 찍히며 되돌릴 수 없다.';

-- -----------------------------------------------------------------------------
-- inquiries_update_own
-- 소유자에게 UPDATE 를 연다. 실제 허용 범위는 아래 가드 트리거가 정한다.
-- -----------------------------------------------------------------------------
drop policy if exists inquiries_update_own on public.inquiries;
create policy inquiries_update_own on public.inquiries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

/* Supabase 기본 권한으로도 authenticated 는 UPDATE 권한을 갖지만, 기본 권한이
   조여지는 순간 정책만 남고 권한이 사라져 "정책은 있는데 401" 이 된다. 명시한다. */
grant update on public.inquiries to authenticated;

-- -----------------------------------------------------------------------------
-- guard_inquiry_owner_update()
--
-- SECURITY INVOKER 여야 한다. DEFINER 로 두면 `current_user` 가 함수 소유자
-- (postgres)로 평가되어 첫 분기가 항상 참이 되고 가드가 통째로 무력화된다
-- (20260908001000 에서 실제로 겪은 사고다).
--
-- 거절은 조용한 되돌리기(new.x := old.x)가 아니라 예외(42501)로 한다. 되돌리면
-- 사용자에게는 "저장됨"으로 보이고 값만 옛것으로 남아, 답변이 끝난 문의를 고쳤다고
-- 믿는 사람이 생긴다. 반대로 운영 컬럼(answered_at 등)은 사용자가 보낼 이유가
-- 없는 값이라 조용히 되돌린다 — 정상 흐름을 예외로 끊을 이유가 없다.
-- -----------------------------------------------------------------------------
create or replace function public.guard_inquiry_owner_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_cancel_transition boolean;
  edits_content boolean;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or public.is_admin()
  then
    return new;
  end if;

  -- 접수 취소: 대기·처리 중 → 종료 + 같은 UPDATE 에서 cancelled_at 이 찍힌다.
  is_cancel_transition :=
    old.status in ('pending', 'in_progress')
    and new.status = 'closed'
    and old.cancelled_at is null
    and new.cancelled_at is not null;

  edits_content :=
    new.title       is distinct from old.title
    or new.category is distinct from old.category
    or new.type     is distinct from old.type
    or new.account_id is distinct from old.account_id
    or new.content  is distinct from old.content
    or new.attachments is distinct from old.attachments;

  if new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at
  then
    raise exception '문의의 소유자와 접수 시각은 바꿀 수 없습니다.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not is_cancel_transition then
    raise exception '문의 상태는 접수 취소(접수 대기·처리 중 → 종료)로만 바꿀 수 있습니다.'
      using errcode = '42501';
  end if;

  /* 취소 해제(un-cancel)와 "상태는 그대로 두고 cancelled_at 만 찍기"를 함께 막는다.
     둘 다 취소 여부와 상태가 어긋난 행을 만든다. */
  if new.cancelled_at is distinct from old.cancelled_at and not is_cancel_transition then
    raise exception '접수 취소는 되돌리거나 따로 지정할 수 없습니다.'
      using errcode = '42501';
  end if;

  if edits_content and (old.status <> 'pending' or old.cancelled_at is not null) then
    raise exception '접수 대기 상태의 문의만 수정할 수 있습니다.'
      using errcode = '42501';
  end if;

  -- 운영자만 채우는 값. 사용자가 실어 보내도 반영하지 않는다.
  new.answered_at := old.answered_at;
  new.contact_email := old.contact_email;
  new.privacy_consent := old.privacy_consent;

  return new;
end;
$$;

comment on function public.guard_inquiry_owner_update() is
  'SECURITY INVOKER 여야 한다. 소유자 UPDATE 를 "접수 대기 상태의 본문 수정"과 "접수 취소(대기·처리 중 → 종료)"로만 좁힌다.';

-- 트리거는 이름 순으로 실행된다: guard_inquiry_owner_update → set_updated_at.
drop trigger if exists guard_inquiry_owner_update on public.inquiries;
create trigger guard_inquiry_owner_update
  before update on public.inquiries
  for each row execute function public.guard_inquiry_owner_update();

-- -----------------------------------------------------------------------------
-- inquiry-attachments — 소유자의 첨부 삭제
--
-- 20260908000800 은 "접수된 첨부는 사용자가 지울 수 없다"고 닫아 두었다. 수정이
-- 열리면서 첨부를 빼는 것도 가능해졌고, 오브젝트를 남겨 두면 어떤 문의에도
-- 연결되지 않은 고아 파일이 비공개 버킷에 쌓인다. 상태(pending) 검사는 스토리지
-- 정책에서 할 수 없으므로, 실효 경계는 "본문 수정 자체가 접수 대기에서만 된다"는
-- 위 가드다. 여기서는 **자기 폴더**로만 범위를 좁힌다.
-- -----------------------------------------------------------------------------
drop policy if exists "inquiry_attachments_delete_own" on storage.objects;
create policy "inquiry_attachments_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'inquiry-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
