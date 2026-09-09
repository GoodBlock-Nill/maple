-- =============================================================================
-- 20260909000100_hero_banner_media
-- 히어로 배너에 유튜브 영상을 허용한다(2026-09-09 운영 요청).
--
-- 배너는 지금까지 이미지 한 장이었다. 영상 배너를 이미지와 **다른 표**로 나누면
-- 순서·기간·노출 토글을 두 벌 관리해야 하므로, 같은 행에 종류(media_type)만
-- 더한다. 대신 "종류에 맞는 주소가 실제로 들어 있는가"를 DB 가 직접 지킨다 —
-- 화면을 우회한 직접 INSERT 로도 재생할 수 없는 배너가 생기지 않게 한다.
-- =============================================================================

alter table public.hero_banners
  add column if not exists media_type text not null default 'image',
  add column if not exists video_url text;

-- 영상 배너에는 이미지가 없을 수 있다. 기존 행은 모두 값이 있으므로 완화만 한다.
alter table public.hero_banners
  alter column image_url drop not null;

alter table public.hero_banners
  drop constraint if exists hero_banners_media_type;

alter table public.hero_banners
  add constraint hero_banners_media_type check (media_type in ('image', 'youtube'));

-- 종류와 실제 주소가 어긋난 행(영상인데 video_url 이 비어 있는 등)을 원천 차단한다.
alter table public.hero_banners
  drop constraint if exists hero_banners_media_shape;

alter table public.hero_banners
  add constraint hero_banners_media_shape check (
    (media_type = 'image' and image_url is not null)
    or (media_type = 'youtube' and video_url is not null)
  );

comment on column public.hero_banners.media_type is
  '배너 종류. image = 이미지 한 장, youtube = 유튜브 영상(사용자 사이트에서 무음 자동 재생·반복).';
comment on column public.hero_banners.image_url is
  '이미지 배너의 그림. 영상 배너에서는 선택 항목이며 포스터(영상을 재생할 수 없을 때·모바일 절전 시 보여 줄 대체 이미지)로 쓴다.';
comment on column public.hero_banners.video_url is
  '유튜브 주소 원본(watch?v= · youtu.be · shorts 모두 허용). 영상 id 는 읽는 쪽에서 파싱한다.';
