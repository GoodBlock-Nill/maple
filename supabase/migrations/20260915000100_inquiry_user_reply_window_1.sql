-- =============================================================================
-- 20260915000100_inquiry_user_reply_window_1
-- 회원 답장 창을 **운영자 답변 하나당 1건**으로 좁힌다(3 → 1).
--
-- 배경: 오너 결정(2026-09-15) — "운영자 답변 하나에 회원 답장은 1건". 운영자가
-- 물은 것에 답하는 자리이지 이어서 쏟아내는 자리가 아니라는 판단이다. 창이 다시
-- 열리는 셈법은 그대로다 — 운영자가 한 번 더 답하면 `last_outbound_at` 이 뒤로
-- 밀리고 그 이후의 내 답장 수가 다시 0 이 된다. 대화 자체는 계속 이어진다.
--
-- 방식: `add_inquiry_user_reply(uuid, text, jsonb)` 를 통째로 재정의하되
-- **`too_many` 문턱 하나만** 바꾼다(`recent_reply_count >= 3` → `>= 1`).
-- 본문·검사 순서·반환 코드 집합은 20260914000500 과 같다 — 순서가 곧 안내 문구의
-- 우선순위라 흔들면 화면(`canUserReply()`)과 어긋난다. 권한(`security definer` ·
-- `set search_path` · grant)도 그대로 다시 적어 재실행해도 같은 상태가 되게 둔다.
--
-- 재실행 안전: `create or replace` + `revoke`/`grant` 뿐이라 몇 번을 돌려도 결과가
-- 같다. 기존 답장 행은 건드리지 않는다 — 이미 2~3건이 쌓인 문의는 그대로 남고,
-- 다음 답장부터 새 문턱이 걸린다(백필 없음).
-- =============================================================================

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
     열린다 — 대화는 이어지고, 운영자 답변 하나에 답장 하나만 받는다. */
  select count(*) into recent_reply_count
  from public.inquiry_replies
  where inquiry_id = p_inquiry_id
    and direction = 'inbound'
    and author_id = actor
    and created_at > last_outbound_at;

  if recent_reply_count >= 1 then
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
  '회원이 자기 문의에 답장한다. 본인 · 취소 아님 · 처리 중 · 운영자 답변 있음 · 마지막 답변 이후 1건 미만(운영자 답변 하나당 답장 1건, 2026-09-15) · 내용 1~2000자 · 첨부 5개/합계 200MB 를 순서대로 보고, 어긋나면 코드로 돌려준다. inquiry_replies 에 사용자 INSERT 정책이 없으므로 SECURITY DEFINER.';

revoke all on function public.add_inquiry_user_reply(uuid, text, jsonb) from public, anon;
grant execute on function public.add_inquiry_user_reply(uuid, text, jsonb) to authenticated, service_role;
