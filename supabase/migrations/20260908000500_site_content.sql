-- =============================================================================
-- 20260908000500_site_content
-- 사이트 설정 · 히어로 배너 · 확률형 아이템(가이드) · 랭킹.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- site_settings
-- id = 1 단일 행. 체크 제약으로 2행째 생성을 막아 "설정이 두 벌"인 상태를 원천 차단한다.
-- -----------------------------------------------------------------------------
create table if not exists public.site_settings (
  id smallint primary key default 1,
  game_name text not null default '글자월드',
  world_id text,
  discord_url text,
  youtube_url text,
  contact_email text,
  ip_notice text,
  copyright text,
  creator_name text,
  creator_slogan text,
  creator_intro text,
  creator_photo_url text,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = 1)
);

comment on table public.site_settings is '사이트 전역 설정 단일 행(id = 1). lib/constants/site.ts 의 플레이스홀더를 대체한다.';
comment on column public.site_settings.creator_intro is '마크다운. 문단 구분은 빈 줄 두 개.';

-- -----------------------------------------------------------------------------
-- hero_banners
-- -----------------------------------------------------------------------------
create table if not exists public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text not null,
  link_url text,
  cta_label text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 종료가 시작보다 빠른 배너는 영원히 노출되지 않으므로 입력 단계에서 막는다.
  constraint hero_banners_period check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create index if not exists hero_banners_active_sort_idx
  on public.hero_banners (sort_order)
  where is_active;

-- -----------------------------------------------------------------------------
-- gacha_items (확률형 아이템 공시)
-- -----------------------------------------------------------------------------
create table if not exists public.gacha_items (
  id uuid primary key default gen_random_uuid(),
  tab public.gacha_tab not null,
  name text not null,
  icon_url text,
  probability numeric(6, 3) not null default 0,
  -- [{ grade, itemName, itemIcon, probability, note }] 확률표.
  -- 행 수가 아이템마다 다르고 통계 쿼리 대상이 아니라 jsonb 로 통째 보관한다.
  "rows" jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gacha_items_rows_is_array check (jsonb_typeof("rows") = 'array'),
  constraint gacha_items_probability_range check (probability >= 0 and probability <= 100)
);

comment on column public.gacha_items.probability is '카드에 노출되는 대표 확률(%). 소수 셋째 자리까지 공시한다.';

create index if not exists gacha_items_tab_published_idx
  on public.gacha_items (tab, published_at desc)
  where is_published;


-- -----------------------------------------------------------------------------
-- rankings
-- 출처(외부 API vs 수동 CSV)가 확정되지 않아 스냅샷 단위로 통째 적재/교체한다.
-- -----------------------------------------------------------------------------
create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  rank_type public.ranking_type not null default 'total',
  rank integer not null,
  character_name text not null,
  avatar_url text,
  level integer not null default 1,
  job text not null,
  job_group public.job_group not null,
  guild text,
  guild_icon_url text,
  -- "98.7B" 처럼 축약된 표기를 그대로 받는다. 정렬은 rank 컬럼으로 하므로 숫자형이 필요 없다.
  exp text,
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint rankings_rank_positive check (rank >= 1),
  constraint rankings_unique_rank unique (rank_type, snapshot_at, rank)
);

create index if not exists rankings_type_rank_idx on public.rankings (rank_type, snapshot_at desc, rank);
create index if not exists rankings_job_group_idx on public.rankings (rank_type, job_group, rank);
-- 이름 검색용 trigram 인덱스. 연산자 클래스 스키마는 20260908000300 과 같은 이유로
-- 카탈로그에서 찾아 붙인다.
do $$
declare
  trgm_schema text;
begin
  select n.nspname into trgm_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  execute format(
    'create index if not exists gacha_items_name_trgm_idx on public.gacha_items using gin (name %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists rankings_character_trgm_idx on public.rankings using gin (character_name %I.gin_trgm_ops)',
    trgm_schema
  );
end $$;
