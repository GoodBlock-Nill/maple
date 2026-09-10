-- =============================================================================
-- 20260910000600_inquiry_video_attachments
-- 1:1 문의 첨부에 **영상**을 허용한다.
--
-- 영상은 100MB 까지 받는다. 서버 액션 본문(14MB · next.config.ts)에는 절대 실을 수
-- 없으므로 브라우저가 세션 클라이언트로 버킷에 **직접** 올린다. 접수 전의 파일은
-- `<uid>/pending/<uuid>.<ext>` 에 두었다가, 접수·수정이 성공할 때 서버가
-- `<uid>/<uuid>-<파일명>`(기존 첨부와 같은 규칙)으로 옮긴다.
--
--   1) 버킷 allowed_mime_types 에 영상 4종 추가(file_size_limit 200MiB 는 그대로)
--   2) 버려진 pending 오브젝트를 찾는 조회 함수(야간 배치가 경로를 받아 지운다)
--
-- 스토리지 정책은 새로 만들 것이 없다. 기존 세 정책이 모두 `<uid>/` 접두사만 보므로
-- 한 단계 깊은 `<uid>/pending/…` 도 그대로 통과한다 —
-- `inquiry_attachments_insert_own`(업로드) · `inquiry_attachments_read_own`(읽기) ·
-- `inquiry_attachments_delete_own`(업로드 취소 · 20260908001900).
-- 접수 후의 이동(move)만 사용자 권한 밖이라(UPDATE 정책이 없다) 서버가 서비스 롤로 한다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 버킷 허용 MIME
-- 버킷의 목록이 앱의 허용 목록보다 좁으면 업로드가 영문 400 으로 막힌다.
-- 기존 값(이미지 4종 · pdf · zip · txt — 20260909000300)에 영상 4종을 더한다.
--   video/mp4       .mp4  (안드로이드 · 데스크톱 표준)
--   video/quicktime .mov  (아이폰 기본 촬영 형식)
--   video/webm      .webm (데스크톱 화면 녹화)
--   video/x-m4v     .m4v  (일부 아이폰/아이패드가 붙이는 변형)
-- file_size_limit 은 200MiB 그대로다. 실질 상한(영상 100MB)은 앱이 쥔다.
-- -----------------------------------------------------------------------------
update storage.buckets
set
  file_size_limit = 209715200, -- 200MiB
  allowed_mime_types = array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf', 'application/zip', 'text/plain',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
  ]
where id = 'inquiry-attachments';

-- -----------------------------------------------------------------------------
-- 곁다리 — 삭제 정책은 **새로 만들 것이 없다**
--
-- 업로드 취소·목록에서 빼기는 브라우저가 `<uid>/pending/…` 오브젝트를 직접 지우는
-- 동작이다. 그 권한은 이미 열려 있다 — `inquiry_attachments_delete_own`
-- (20260908001900)이 "자기 폴더(`<uid>/` 접두사) 안이면 삭제"를 허용한다.
-- pending 은 그 접두사 **안쪽**이므로 그대로 통과한다.
--
-- 한때 `inquiry_attachments_delete_pending_own` 이라는 더 좁은 정책을 이 자리에
-- 두었다가 뺐다. 정책은 OR 로 합쳐지므로 넓은 정책이 이미 있는 한 좁은 정책은
-- 아무것도 좁히지 못하고, "pending 만 지울 수 있다"는 **틀린 인상**만 남긴다
-- (실제로는 접수된 첨부도 본인은 지울 수 있다 — 20260908001900 의 판단이고,
-- 실효 경계는 "본문 수정 자체가 접수 대기에서만 된다"는 DB 가드다).
-- 이미 적용된 환경을 위해 지우는 문장만 남긴다.
-- -----------------------------------------------------------------------------
drop policy if exists "inquiry_attachments_delete_pending_own" on storage.objects;

-- -----------------------------------------------------------------------------
-- 2. 버려진 pending 오브젝트 조회
--
-- 폼을 열어 영상만 올리고 접수하지 않은 채 떠난 사용자의 파일은 아무도 참조하지
-- 않는다. 그런 오브젝트의 경로를 돌려준다 — **여기서 지우지 않는** 이유는 SQL 로
-- storage.objects 행을 지워도 실제 파일(S3)은 남아 용량만 새기 때문이다. 야간 배치
-- (Edge Function `purge-withdrawn`)가 이 목록을 받아 Storage API 로 지운다.
--
-- 24시간을 두는 이유: 같은 파일을 올려 두고 다음 날 이어서 쓰는 사용자를 자르지
-- 않기 위해서다. 접수가 끝난 영상은 이 접두사에 남지 않으므로(서버가 옮긴다)
-- 여기 걸리는 것은 정의상 버려진 파일뿐이다.
-- -----------------------------------------------------------------------------
create or replace function public.stale_inquiry_pending_attachments(
  p_cutoff_hours integer default 24,
  p_limit integer default 500
)
returns table (path text)
language sql
security definer
set search_path = public, storage
as $$
  select o.name
  from storage.objects as o
  where o.bucket_id = 'inquiry-attachments'
    and (storage.foldername(o.name))[2] = 'pending'
    and o.created_at < now() - make_interval(hours => greatest(p_cutoff_hours, 1))
  order by o.created_at
  limit greatest(p_limit, 1);
$$;

comment on function public.stale_inquiry_pending_attachments(integer, integer) is
  '접수되지 않은 채 남은 1:1 문의 첨부(`<uid>/pending/…`)의 경로. 야간 배치가 받아 Storage API 로 지운다. 서비스 롤 전용.';

revoke all on function public.stale_inquiry_pending_attachments(integer, integer) from public;
revoke all on function public.stale_inquiry_pending_attachments(integer, integer) from anon;
revoke all on function public.stale_inquiry_pending_attachments(integer, integer) from authenticated;
grant execute on function public.stale_inquiry_pending_attachments(integer, integer) to service_role;
