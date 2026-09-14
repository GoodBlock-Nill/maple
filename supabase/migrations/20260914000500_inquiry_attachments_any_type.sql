-- =============================================================================
-- 20260914000500_inquiry_attachments_any_type
-- 1:1 문의 첨부를 **형식과 무관한 하나의 규칙**으로 통일한다 — 총 5개 · 합계 200MB.
--
-- 오너 지시(2026-09-14): "고객지원 문의 접수(및 수정·회원 답장)의 첨부는 형식
-- (이미지·PDF·영상)에 관계없이 총 5개, 총 200MB 로 통일한다."
--
-- 무엇이 사라지나
--   * `*_attachments_file_kind_max_3` · `*_attachments_video_kind_max_2`
--     (20260911000600 · 20260914000400) — 종류별 개수 상한
--   * 이미지 개당 5MB · 합계 12MB (코드 쪽 상수였고 DB 에는 없었다)
--
-- 무엇이 남고 새로 생기나
--   * `*_attachments_max_5` — 그대로 둔다(숫자도 그대로다)
--   * `inquiry_attachments_total_bytes(jsonb)` + `*_attachments_total_bytes_max_200mb`
--     — 용량 상한이 처음으로 DB 에 생긴다
--
-- **용량을 이제 와서 DB 가 재는 이유**: 예전에는 이미지가 서버 액션 본문을 거쳤고
-- 그 본문 상한이 사실상의 천장이었다(넘으면 요청 자체가 끊긴다). 지금은 모든 첨부가
-- 브라우저 → 버킷으로 직접 올라가고 폼에는 경로만 실린다. 그 길에는 본문 상한이
-- 없으므로, 앱을 거치지 않는 쓰기(직접 POST · 관리자 콘솔 · 미래의 배치)에 대해
-- "합계 200MB"를 지킬 자리가 DB 말고는 없다.
--
-- 크기는 첨부 원소의 `size`(바이트)를 읽는다. 그 값은 **스토리지가 아는 값**이다 —
-- 서버가 확정 단계에서 폼의 신고 값을 버리고 오브젝트 메타로 갈아 끼운다
-- (`lib/actions/inquiry-uploads.ts`). 그래서 DB 가 이 숫자를 믿을 수 있다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 첨부 합계 바이트를 세는 헬퍼
--
-- CHECK 제약은 다른 테이블을 보는 서브쿼리를 못 쓰지만, 인자로 받은 jsonb 하나만
-- 들여다보는 immutable 함수 호출은 된다(20260911000600 의 판단과 같다).
--
-- 두 겹으로 방어한다.
--   * `jsonb_typeof(...) = 'array'` — `jsonb_array_elements()` 는 배열이 아니면
--     오류를 던진다. is_array 제약과 평가 순서가 보장되지 않으므로 여기서도 본다.
--   * 원소의 `size` 가 숫자인지 — 문자열이 들어오면 `::bigint` 캐스팅이 22P02 로
--     터져 사용자가 영문 오류를 본다. 숫자가 아니면 0 으로 세고, 모양 검사는
--     애플리케이션(zod)과 화면이 맡는다.
-- -----------------------------------------------------------------------------
create or replace function public.inquiry_attachments_total_bytes(p_attachments jsonb)
returns bigint
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_attachments) = 'array' then coalesce((
      select sum(
        case
          when jsonb_typeof(elem -> 'size') = 'number' then (elem ->> 'size')::bigint
          else 0
        end
      )
      from jsonb_array_elements(p_attachments) as elem
    ), 0)
    else 0
  end;
$$;

comment on function public.inquiry_attachments_total_bytes(jsonb) is
  '첨부 jsonb 배열의 size 합계(바이트). 숫자가 아닌 size 는 0 으로 센다. inquiries · inquiry_replies 의 합계 CHECK 제약이 쓴다.';

revoke all on function public.inquiry_attachments_total_bytes(jsonb) from public;
grant execute on function public.inquiry_attachments_total_bytes(jsonb) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. inquiries — 종류별 상한 제거 + 합계 상한 추가
--
-- `max_5` 는 건드리지 않는다(이미 있고 숫자도 같다). 없는 환경(옛 백업에서 복원 등)을
-- 대비해 한 번 더 붙이되, 있으면 그대로 두도록 drop → add 로 쓴다.
--
-- 200MB = 209715200 바이트. 버킷의 `file_size_limit`(200MiB)과 같은 숫자다 —
-- 한 파일이 합계를 넘을 수 없으니 둘을 같은 값으로 둔다.
-- -----------------------------------------------------------------------------
alter table public.inquiries
  drop constraint if exists inquiries_attachments_file_kind_max_3;
alter table public.inquiries
  drop constraint if exists inquiries_attachments_video_kind_max_2;

alter table public.inquiries
  drop constraint if exists inquiries_attachments_max_5;
alter table public.inquiries
  add constraint inquiries_attachments_max_5
  check (jsonb_typeof(attachments) <> 'array' or jsonb_array_length(attachments) <= 5);

alter table public.inquiries
  drop constraint if exists inquiries_attachments_total_bytes_max_200mb;
alter table public.inquiries
  add constraint inquiries_attachments_total_bytes_max_200mb
  check (public.inquiry_attachments_total_bytes(attachments) <= 209715200);

comment on column public.inquiries.attachments is
  '첨부 목록({ name, path, size, mimeType }). 형식에 관계없이 5개 · 합계 200MB 까지(2026-09-14 오너 지시).';

-- -----------------------------------------------------------------------------
-- 3. inquiry_replies — 같은 규칙
--
-- 답장 칸만 관대하거나 엄격하면 "접수할 때는 되는데 답장할 때는 막히는" 경계가
-- 생긴다. 접수 폼과 **같은 두 제약**을 건다.
-- -----------------------------------------------------------------------------
alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_file_kind_max_3;
alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_video_kind_max_2;

alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_max_5;
alter table public.inquiry_replies
  add constraint inquiry_replies_attachments_max_5
  check (jsonb_typeof(attachments) <> 'array' or jsonb_array_length(attachments) <= 5);

alter table public.inquiry_replies
  drop constraint if exists inquiry_replies_attachments_total_bytes_max_200mb;
alter table public.inquiry_replies
  add constraint inquiry_replies_attachments_total_bytes_max_200mb
  check (public.inquiry_attachments_total_bytes(attachments) <= 209715200);

comment on column public.inquiry_replies.attachments is
  '답변·답장의 첨부 목록(inquiries.attachments 와 같은 모양). 형식에 관계없이 5개 · 합계 200MB 까지. 기존 행은 빈 배열(백필 없음).';

-- -----------------------------------------------------------------------------
-- 4. add_inquiry_user_reply(...) — invalid 검사에서 종류별 상한을 뺀다
--
-- 본문은 20260914000400 과 같고 `invalid` 조건 한 덩어리만 바뀐다. 함수 안에서
-- **먼저** 보는 이유도 그대로다 — 테이블 CHECK 에 걸리면 23514 예외가 나가 화면이
-- 코드 대신 영문 오류를 받는다.
--
-- 합계도 여기서 함께 본다. 개수만 보고 통과시키면 5개 안쪽이지만 합계를 넘긴 답장이
-- 제약에서 터진다.
-- -----------------------------------------------------------------------------
create or replace function public.add_inquiry_user_reply(
  p_inquiry_id uuid,
  p_content text,
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  owner_id uuid;
  current_status public.inquiry_status;
  current_cancelled timestamptz;
  last_outbound_at timestamptz;
  recent_reply_count integer;
  trimmed_content text := btrim(coalesce(p_content, ''));
  payload_attachments jsonb := coalesce(p_attachments, '[]'::jsonb);
  author_nickname text;
  new_reply_id uuid;
begin
  -- 로그인하지 않은 호출(anon 세션 · 서비스 롤 직접 호출)은 소유자일 수 없다.
  if actor is null then
    return jsonb_build_object('ok', false, 'code', 'not_owner');
  end if;

  select user_id, status, cancelled_at
  into owner_id, current_status, current_cancelled
  from public.inquiries
  where id = p_inquiry_id
  for update;

  if not found or owner_id is distinct from actor then
    return jsonb_build_object('ok', false, 'code', 'not_owner');
  end if;

  if current_cancelled is not null then
    return jsonb_build_object('ok', false, 'code', 'cancelled');
  end if;

  if current_status <> 'in_progress' then
    return jsonb_build_object('ok', false, 'code', 'not_in_progress');
  end if;

  select max(created_at) into last_outbound_at
  from public.inquiry_replies
  where inquiry_id = p_inquiry_id
    and direction = 'outbound';

  if last_outbound_at is null then
    return jsonb_build_object('ok', false, 'code', 'no_operator_reply');
  end if;

  /* 마지막 운영자 답변 **이후**의 내 답장만 센다. 운영자가 다시 답하면 창이 새로
     열린다 — 대화는 이어지고, 한 번에 쏟아내는 것만 막는다. */
  select count(*) into recent_reply_count
  from public.inquiry_replies
  where inquiry_id = p_inquiry_id
    and direction = 'inbound'
    and author_id = actor
    and created_at > last_outbound_at;

  if recent_reply_count >= 3 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;

  /* 내용 1~2000자 · 첨부 배열 5개 이내 · 합계 200MB 이내. 형식은 가리지 않는다
     (2026-09-14) — 종류별 상한 두 줄이 여기서 빠졌다. */
  if char_length(trimmed_content) < 1
     or char_length(trimmed_content) > 2000
     or jsonb_typeof(payload_attachments) <> 'array'
     or jsonb_array_length(payload_attachments) > 5
     or public.inquiry_attachments_total_bytes(payload_attachments) > 209715200
  then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  /* 닉네임은 **저장 시점의 스냅샷**이다(inquiry_notes 의 author_nickname_snapshot 과
     같은 판단). 나중에 닉네임을 바꿔도 지난 대화의 화자 표기는 흔들리지 않는다.
     프로필이 없을 리는 없지만, 있으면 없는 대로 대화는 이어져야 한다. */
  select nickname into author_nickname
  from public.profiles
  where id = actor;

  insert into public.inquiry_replies (
    inquiry_id, author_id, author_name, content, direction, attachments
  )
  values (
    p_inquiry_id,
    actor,
    coalesce(nullif(btrim(author_nickname), ''), '회원'),
    trimmed_content,
    'inbound',
    payload_attachments
  )
  returning id into new_reply_id;

  -- user_replied_at · updated_at 은 20260914000400 의 트리거가 찍는다(경로가 하나여야 한다).

  return jsonb_build_object('ok', true, 'reply_id', new_reply_id);
end;
$$;

comment on function public.add_inquiry_user_reply(uuid, text, jsonb) is
  '회원이 자기 문의에 답장한다. 본인 · 취소 아님 · 처리 중 · 운영자 답변 있음 · 마지막 답변 이후 3건 미만 · 내용 1~2000자 · 첨부 5개/합계 200MB 를 순서대로 보고, 어긋나면 코드로 돌려준다. inquiry_replies 에 사용자 INSERT 정책이 없으므로 SECURITY DEFINER.';

revoke all on function public.add_inquiry_user_reply(uuid, text, jsonb) from public, anon;
grant execute on function public.add_inquiry_user_reply(uuid, text, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. inquiry_attachment_kind_count(jsonb, boolean) 는 남겨 둔다
--
-- 이제 어떤 제약도 이 함수를 참조하지 않는다. 그래도 지우지 않는 이유는 운영
-- 콘솔·분석 쿼리가 "이 문의에 영상이 몇 개인가"를 물을 때 쓸 수 있는 순수 함수이고,
-- 지워 봐야 아끼는 것이 없기 때문이다. 대신 주석으로 **더 이상 규칙이 아니라는 것**을
-- 남긴다 — 남은 함수를 보고 종류별 상한이 아직 있다고 오해하지 않도록.
-- -----------------------------------------------------------------------------
comment on function public.inquiry_attachment_kind_count(jsonb, boolean) is
  '첨부 jsonb 배열에서 영상(mimeType 이 video/ 로 시작)이거나 그 반대인 원소 수. 2026-09-14 부터 어떤 CHECK 제약도 쓰지 않는다(종류별 상한 폐지) — 조회용으로만 남는다.';
