-- =============================================================================
-- 20260908000700_rls_policies
-- 모든 public 테이블에 RLS 를 켜고 정책을 정의한다.
--
-- 원칙
--  1) 기본은 차단. 읽기는 "공개 상태"인 행만 anon 에게 연다.
--  2) 쓰기는 소유자(author_id/user_id = auth.uid()) 또는 관리자만.
--  3) auth.uid() 는 `(select auth.uid())` 로 감싼다. 이렇게 해야 플래너가 행마다
--     재평가하지 않고 InitPlan 으로 한 번만 계산한다(대량 목록 쿼리 성능).
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.board_categories  enable row level security;
alter table public.posts             enable row level security;
alter table public.comments          enable row level security;
alter table public.inquiries         enable row level security;
alter table public.inquiry_replies   enable row level security;
alter table public.faqs              enable row level security;
alter table public.site_settings     enable row level security;
alter table public.hero_banners      enable row level security;
alter table public.gacha_items       enable row level security;
alter table public.rankings          enable row level security;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on
  public.posts, public.comments, public.inquiries, public.profiles
  to authenticated;
grant all on all tables in schema public to service_role;

-- -----------------------------------------------------------------------------
-- profiles
-- 목록·상세에 필요한 닉네임은 posts.author_name / comments.author_name 으로
-- 비정규화돼 있다. 따라서 프로필 전체를 공개할 이유가 없고, email 노출을 막기 위해
-- 읽기를 본인·관리자로 제한한다.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- INSERT 정책은 두지 않는다. 프로필 생성은 handle_new_user() 트리거(SECURITY
-- DEFINER)만 수행하므로 클라이언트가 임의 프로필을 만들 경로가 없어야 한다.

-- -----------------------------------------------------------------------------
-- board_categories
-- -----------------------------------------------------------------------------
drop policy if exists board_categories_select_active on public.board_categories;
create policy board_categories_select_active on public.board_categories
  for select to anon, authenticated
  using (is_active);

drop policy if exists board_categories_admin_all on public.board_categories;
create policy board_categories_admin_all on public.board_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------
drop policy if exists posts_select_published on public.posts;
create policy posts_select_published on public.posts
  for select to anon, authenticated
  using (is_published and deleted_at is null and published_at <= now());

drop policy if exists posts_select_own on public.posts;
create policy posts_select_own on public.posts
  for select to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists posts_select_admin on public.posts;
create policy posts_select_admin on public.posts
  for select to authenticated
  using (public.is_admin());

-- 일반 사용자는 커뮤니티에만, 본인 이름으로만 글을 쓸 수 있다.
-- 뉴스(board = 'news')는 관리자 전용 정책으로만 작성된다.
drop policy if exists posts_insert_community on public.posts;
create policy posts_insert_community on public.posts
  for insert to authenticated
  with check (
    board = 'community'
    and author_id = (select auth.uid())
    and deleted_at is null
    and is_published
    and not is_pinned
  );

drop policy if exists posts_insert_admin on public.posts;
create policy posts_insert_admin on public.posts
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and board = 'community' and deleted_at is null)
  with check (author_id = (select auth.uid()) and board = 'community');

drop policy if exists posts_update_admin on public.posts;
create policy posts_update_admin on public.posts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 물리 삭제는 관리자만. 사용자 "삭제"는 deleted_at 을 채우는 UPDATE 로 처리한다.
drop policy if exists posts_delete_admin on public.posts;
create policy posts_delete_admin on public.posts
  for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
drop policy if exists comments_select_public on public.comments;
create policy comments_select_public on public.comments
  for select to anon, authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.posts p
      where p.id = comments.post_id
        and p.is_published
        and p.deleted_at is null
    )
  );

drop policy if exists comments_select_admin on public.comments;
create policy comments_select_admin on public.comments
  for select to authenticated
  using (public.is_admin());

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and deleted_at is null
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.is_published
        and p.deleted_at is null
    )
  );

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists comments_admin_all on public.comments;
create policy comments_admin_all on public.comments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- inquiries / inquiry_replies
-- 개인정보(계정 ID · 첨부)가 들어가므로 anon 에게는 어떤 행도 열지 않는다.
-- -----------------------------------------------------------------------------
drop policy if exists inquiries_select_own on public.inquiries;
create policy inquiries_select_own on public.inquiries
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists inquiries_select_admin on public.inquiries;
create policy inquiries_select_admin on public.inquiries
  for select to authenticated
  using (public.is_admin());

drop policy if exists inquiries_insert_own on public.inquiries;
create policy inquiries_insert_own on public.inquiries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

-- 접수 후 본문 수정은 허용하지 않는다(답변 근거가 바뀌면 이력 추적이 불가능해진다).
drop policy if exists inquiries_admin_all on public.inquiries;
create policy inquiries_admin_all on public.inquiries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists inquiry_replies_select_owner on public.inquiry_replies;
create policy inquiry_replies_select_owner on public.inquiry_replies
  for select to authenticated
  using (
    exists (
      select 1
      from public.inquiries i
      where i.id = inquiry_replies.inquiry_id
        and i.user_id = (select auth.uid())
    )
  );

drop policy if exists inquiry_replies_admin_all on public.inquiry_replies;
create policy inquiry_replies_admin_all on public.inquiry_replies
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- faqs / site_settings / hero_banners / gacha_items / rankings
-- 전부 공개 읽기 + 관리자 쓰기.
-- -----------------------------------------------------------------------------
drop policy if exists faqs_select_published on public.faqs;
create policy faqs_select_published on public.faqs
  for select to anon, authenticated
  using (is_published);

drop policy if exists faqs_admin_all on public.faqs;
create policy faqs_admin_all on public.faqs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists site_settings_select_all on public.site_settings;
create policy site_settings_select_all on public.site_settings
  for select to anon, authenticated
  using (true);

drop policy if exists site_settings_admin_all on public.site_settings;
create policy site_settings_admin_all on public.site_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 노출 기간이 지난 배너는 anon 이 조회할 수 없다(예약 배너 사전 유출 방지).
drop policy if exists hero_banners_select_active on public.hero_banners;
create policy hero_banners_select_active on public.hero_banners
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists hero_banners_admin_all on public.hero_banners;
create policy hero_banners_admin_all on public.hero_banners
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists gacha_items_select_published on public.gacha_items;
create policy gacha_items_select_published on public.gacha_items
  for select to anon, authenticated
  using (is_published and published_at <= now());

drop policy if exists gacha_items_admin_all on public.gacha_items;
create policy gacha_items_admin_all on public.gacha_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists rankings_select_all on public.rankings;
create policy rankings_select_all on public.rankings
  for select to anon, authenticated
  using (true);

drop policy if exists rankings_admin_all on public.rankings;
create policy rankings_admin_all on public.rankings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
