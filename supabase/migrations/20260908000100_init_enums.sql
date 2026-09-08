-- =============================================================================
-- 20260908000100_init_enums
-- 확장(extension)과 열거형(enum) 정의. 이후 모든 마이그레이션이 이 파일에 의존한다.
-- =============================================================================

-- Supabase 관례상 확장은 public 이 아닌 extensions 스키마에 설치한다.
-- public 에 두면 `supabase gen types` 결과와 PostgREST 스키마 캐시가 오염된다.
create schema if not exists extensions;

-- 제목 부분일치 검색(`ilike '%키워드%'`)을 인덱스로 태우기 위해 필요하다.
create extension if not exists pg_trgm with schema extensions;

-- gen_random_uuid() 는 PostgreSQL 13+ 코어 함수라 pgcrypto 를 별도로 켜지 않는다.

-- -----------------------------------------------------------------------------
-- enum
-- `create type` 은 `if not exists` 를 지원하지 않으므로 duplicate_object 를 삼켜
-- 재실행 가능(idempotent)하게 만든다.
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.board_type as enum ('news', 'community');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.content_format as enum ('markdown', 'html');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.inquiry_status as enum ('pending', 'in_progress', 'answered', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.faq_category as enum ('notice', 'account', 'payment', 'bug', 'etc');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gacha_tab as enum ('premium', 'cube', 'scroll');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ranking_type as enum ('total', 'job', 'guild');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.job_group as enum ('adventurer', 'cygnus', 'resistance', 'hero', 'demon');
exception when duplicate_object then null;
end $$;

comment on type public.board_type is '게시판 종류. 뉴스(운영자 전용)와 커뮤니티(사용자 작성) 2종.';
comment on type public.user_role is '서비스 권한. role 은 절대 사용자 입력으로 채우지 않는다.';
