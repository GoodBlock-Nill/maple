-- =============================================================================
-- 20260908001300_post_content_html
-- 커뮤니티 본문 에디터(Tiptap) 도입에 따른 저장 형식 정리.
--
-- `content_format` enum 에는 20260908000100_init_enums 에서 이미 'html' 이 들어 있다.
-- 그럼에도 이 마이그레이션을 두는 이유:
--
--  1) 초기 enum 정의가 나중에 손질되어도 'html' 이 반드시 존재하도록 못 박는다.
--     `add value if not exists` 는 재실행해도 안전하다.
--  2) 컬럼 주석으로 "html 은 정제를 마친 값만 들어온다"는 계약을 스키마에 남긴다.
--     이 계약을 강제하는 것은 DB 제약이 아니라 애플리케이션(lib/sanitize/post-html.ts)
--     이므로, 스키마만 보고 작업하는 사람이 놓치지 않도록 여기에 적어 둔다.
--
-- 주의: `alter type ... add value` 로 **추가한 값을 같은 트랜잭션 안에서 사용**할 수는
-- 없다(PostgreSQL 제약). 이 파일은 값을 쓰지 않고 추가·주석만 하므로 분리하지 않는다.
-- 값을 쓰는 백필이 필요해지면 반드시 다음 마이그레이션으로 나눠야 한다.
-- =============================================================================

alter type public.content_format add value if not exists 'html';

comment on column public.posts.content_format is
  '본문 저장 형식. 에디터로 쓴 글은 html(lib/sanitize/post-html.ts 의 허용 목록을 통과한 값만 저장된다), markdown 은 에디터 도입 이전 글이다.';

comment on column public.posts.content is
  'content_format 이 html 이면 정제를 마친 HTML. 영상은 iframe 이 아니라 <div data-video="youtube:{id}"> 자리표시자로 저장하고, 실제 iframe 은 표시 시점에 조립한다.';

-- -----------------------------------------------------------------------------
-- post-images
-- 버킷·정책은 20260908000800_storage_buckets 그대로 쓴다. 에디터가 만드는 경로는
-- `{uid}/{yyyy}/{uuid}.{ext}` 인데, 정책이 보는 것은 **첫 세그먼트뿐**이라
-- (`(storage.foldername(name))[1] = auth.uid()::text`) 연도 폴더가 끼어들어도
-- 판정이 그대로 유지된다. 정책 변경이 필요 없다는 사실을 여기 남겨 둔다.
-- -----------------------------------------------------------------------------
