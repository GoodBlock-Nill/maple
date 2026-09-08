-- =============================================================================
-- 20260908000800_storage_buckets
-- 스토리지 버킷 3종과 storage.objects 정책.
--
--  public-assets        공개  배너·마스코트·아이콘 등 사이트 자산 (쓰기: 관리자)
--  post-images          공개  커뮤니티 본문 이미지 (쓰기: 로그인 사용자, `{uid}/` 하위만)
--  inquiry-attachments  비공개 1:1 문의 첨부 (읽기: 작성자·관리자)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'public-assets',
    'public-assets',
    true,
    10485760, -- 10MiB
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
  ),
  (
    'post-images',
    'post-images',
    true,
    5242880, -- 5MiB
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  ),
  (
    'inquiry-attachments',
    'inquiry-attachments',
    false,
    209715200, -- 200MiB. 시안의 첨부 안내 문구(각 200MB 이하)와 맞춘다.
    array['image/png', 'image/jpeg', 'image/gif', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- public-assets
-- -----------------------------------------------------------------------------
drop policy if exists "public_assets_read" on storage.objects;
create policy "public_assets_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-assets');

drop policy if exists "public_assets_admin_write" on storage.objects;
create policy "public_assets_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

-- -----------------------------------------------------------------------------
-- post-images
-- 경로 첫 세그먼트를 업로더 uid 로 강제한다. 이렇게 해야 "남의 파일 덮어쓰기"를
-- 이름 충돌만으로 막을 수 있고, 탈퇴 처리 시 접두사 하나로 일괄 정리할 수 있다.
-- 클라이언트는 lib/supabase/storage.ts 의 buildUserScopedPath() 로 같은 규칙을 만든다.
-- -----------------------------------------------------------------------------
drop policy if exists "post_images_read" on storage.objects;
create policy "post_images_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'post-images');

drop policy if exists "post_images_insert_own" on storage.objects;
create policy "post_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "post_images_update_own" on storage.objects;
create policy "post_images_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "post_images_delete_own" on storage.objects;
create policy "post_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

-- -----------------------------------------------------------------------------
-- inquiry-attachments
-- 비공개 버킷이라 URL 을 알아도 접근할 수 없다. 서명 URL 발급 시 이 정책이 평가된다.
-- -----------------------------------------------------------------------------
drop policy if exists "inquiry_attachments_read_own" on storage.objects;
create policy "inquiry_attachments_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'inquiry-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

drop policy if exists "inquiry_attachments_insert_own" on storage.objects;
create policy "inquiry_attachments_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'inquiry-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 접수된 첨부는 사용자가 지울 수 없다(답변 근거 보존). 관리자만 정리한다.
drop policy if exists "inquiry_attachments_admin_write" on storage.objects;
create policy "inquiry_attachments_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'inquiry-attachments' and public.is_admin())
  with check (bucket_id = 'inquiry-attachments' and public.is_admin());
