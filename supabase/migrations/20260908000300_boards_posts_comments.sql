-- =============================================================================
-- 20260908000300_boards_posts_comments
-- 게시판 카테고리 · 게시글 · 댓글.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- board_categories
-- 뉴스/커뮤니티 말머리. 프론트의 lib/constants/board.ts 를 DB 로 옮긴 것이며
-- color 는 lib/constants/categories.ts 의 BADGE_CLASS 키(토큰명)와 1:1 대응한다.
-- Tailwind v4 가 클래스 문자열을 정적 스캔하므로 DB 에는 hex 가 아닌 "토큰 키"를 둔다.
-- -----------------------------------------------------------------------------
create table if not exists public.board_categories (
  id uuid primary key default gen_random_uuid(),
  board public.board_type not null,
  key text not null,
  label text not null,
  color text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_categories_board_key_key unique (board, key),
  constraint board_categories_key_format check (key ~ '^[a-z][a-z0-9_-]*$')
);

comment on column public.board_categories.color is
  'BADGE_CLASS 토큰 키(notice/patch/event/chat/question/info). hex 를 넣으면 Tailwind 가 클래스를 생성하지 못한다.';

create index if not exists board_categories_board_sort_idx
  on public.board_categories (board, sort_order);

-- -----------------------------------------------------------------------------
-- posts
-- 뉴스와 커뮤니티를 한 테이블로 합친다. 목록 UI(칩·검색·더보기)와 정렬 규칙이
-- 동일해 쿼리를 공유할 수 있고, 통합 검색도 한 번에 처리된다.
-- -----------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  board public.board_type not null,
  category_key text not null,
  title text not null,
  summary text,
  content text not null,
  content_format public.content_format not null default 'markdown',
  thumbnail_url text,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  view_count integer not null default 0,
  comment_count integer not null default 0,
  like_count integer not null default 0,
  is_pinned boolean not null default false,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint posts_category_fkey foreign key (board, category_key)
    references public.board_categories (board, key) on update cascade,
  constraint posts_counts_nonnegative check (
    view_count >= 0 and comment_count >= 0 and like_count >= 0
  )
);

comment on column public.posts.author_name is
  '작성 시점 닉네임 스냅샷. 탈퇴(author_id = null)해도 목록이 깨지지 않도록 비정규화해 둔다.';
comment on column public.posts.deleted_at is
  '소프트 삭제. 댓글이 달린 글을 물리 삭제하면 알림/링크가 깨지므로 플래그로만 감춘다.';
comment on column public.posts.summary is '뉴스 카드 2줄 요약. 커뮤니티는 비워 둔다.';

-- 목록 기본 쿼리: board 필터 + 고정글 우선 + 최신순.
create index if not exists posts_board_published_idx
  on public.posts (board, is_pinned desc, published_at desc)
  where is_published and deleted_at is null;

-- 카테고리 칩 필터.
create index if not exists posts_board_category_idx
  on public.posts (board, category_key, published_at desc)
  where is_published and deleted_at is null;

-- 커뮤니티 정렬(조회순/좋아요순).
create index if not exists posts_board_view_count_idx on public.posts (board, view_count desc);
create index if not exists posts_board_like_count_idx on public.posts (board, like_count desc);

-- 제목 부분일치 검색(`ilike '%q%'`)을 인덱스로 태운다.
-- pg_trgm 이 설치된 스키마는 환경마다 다를 수 있어(Supabase 는 extensions, 로컬 psql 은
-- public 인 경우가 있다) 연산자 클래스를 하드코딩하지 않고 카탈로그에서 찾아 붙인다.
do $$
declare
  trgm_schema text;
begin
  select n.nspname into trgm_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  if trgm_schema is null then
    raise exception 'pg_trgm 확장이 설치되어 있지 않습니다. 20260908000100_init_enums.sql 을 먼저 적용하세요.';
  end if;

  execute format(
    'create index if not exists posts_title_trgm_idx on public.posts using gin (title %I.gin_trgm_ops)',
    trgm_schema
  );
end $$;

create index if not exists posts_author_idx on public.posts (author_id);

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.comments.deleted_at is
  '소프트 삭제. posts.comment_count 동기화 트리거가 이 값을 기준으로 집계한다.';

create index if not exists comments_post_created_idx
  on public.comments (post_id, created_at)
  where deleted_at is null;

create index if not exists comments_author_idx on public.comments (author_id);
