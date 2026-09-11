-- =============================================================================
-- 20260911000100_news_category_templates
-- 뉴스 카테고리별 글 템플릿.
--
--   운영자 ──/news/templates──▶ news_category_templates ──/news/new 카테고리 선택──▶ 새 글 폼 프리필
--
-- 이 마이그레이션이 다루는 것
--   1) public.news_category_templates — 카테고리 1개당 1행(제목 · 요약 · 본문 양식)
--   2) RLS — 관리자만 읽고 쓴다. 사용자 사이트는 이 테이블을 **보지 않는다**
--      (템플릿은 글이 되기 전의 초안 양식이고, 발행된 글은 이미 posts 에 있다).
--   3) 카테고리 6종의 기본 템플릿 시드
--
-- 왜 posts 와 따로 두는가
--   템플릿은 "글"이 아니다. posts 에 임시저장으로 끼워 넣으면 목록·검색·통계가
--   전부 그것을 글로 세고, 실수로 발행될 수도 있다.
--
-- 자리표시자(`{{날짜}}`)는 치환하지 않는다
--   운영자가 직접 고쳐 쓰는 평범한 글자다. DB·앱 어디에도 치환 코드가 없다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. news_category_templates
--
-- board 칸을 고정값으로 들고 있는 이유는 외래키 때문이다. board_categories 의 키는
-- (board, key) 복합이라 category_key 한 칸만으로는 참조할 수 없다. 이 한 칸 덕분에
-- 없는 카테고리를 가리키는 템플릿이 생기지 않고, 카테고리가 사라지면 템플릿도 함께 간다.
--
-- 길이 상한은 **뉴스 글 필드와 같은 숫자**다(제목 100 · 요약 200). 템플릿이 폼에
-- 그대로 들어가야 하므로, 여기가 더 관대하면 "저장된 템플릿을 불러왔는데 글로는
-- 저장할 수 없는" 상태가 만들어진다.
-- -----------------------------------------------------------------------------
create table if not exists public.news_category_templates (
  id uuid primary key default gen_random_uuid(),
  board public.board_type not null default 'news',
  category_key text not null,
  title_template text not null default '',
  summary_template text not null default '',
  body_template text not null default '',
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_category_templates_board_news check (board = 'news'),
  constraint news_category_templates_category_fkey foreign key (board, category_key)
    references public.board_categories (board, key) on update cascade on delete cascade,
  constraint news_category_templates_category_unique unique (category_key),
  constraint news_category_templates_title_length check (char_length(title_template) <= 100),
  constraint news_category_templates_summary_length check (char_length(summary_template) <= 200),
  constraint news_category_templates_body_length check (char_length(body_template) <= 20000)
);

comment on table public.news_category_templates is
  '뉴스 카테고리별 글 템플릿. 관리자 전용 — 새 글 작성 화면이 카테고리 선택 시 이 양식을 채운다.';
comment on column public.news_category_templates.category_key is
  'board_categories(board = ''news'') 의 key. posts.category_key 와 같은 값이며 카테고리당 한 행뿐이다.';
comment on column public.news_category_templates.title_template is
  '제목 칸 프리필. 제목이 비어 있을 때만 채운다(운영자가 쓴 제목을 덮지 않는다).';
comment on column public.news_category_templates.body_template is
  '본문 프리필(Tiptap HTML). 태그는 lib/sanitize/post-html.ts 의 허용 목록 안에 있어야 한다.';
comment on column public.news_category_templates.is_active is
  '끄면 새 글 폼이 이 카테고리에서 아무것도 채우지 않는다. 행과 문안은 그대로 남는다.';
comment on column public.news_category_templates.updated_by is
  '마지막으로 저장한 관리자. 누가 문안을 바꿨는지는 감사 로그(news_template.update)가 함께 남긴다.';

drop trigger if exists set_news_category_templates_updated_at on public.news_category_templates;
create trigger set_news_category_templates_updated_at
  before update on public.news_category_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. RLS — 관리자만
--
-- anon · 일반 로그인 사용자에게는 select 조차 열지 않는다. 발행 전 점검 일정이나
-- 이벤트 보상 초안이 템플릿에 적히는 일이 흔한데, 그것은 아직 공개된 정보가 아니다.
-- Supabase 의 기본 권한은 마이그레이션으로 만든 테이블에 자동으로 붙지 않으므로
-- grant 를 함께 적는다(권한이 없으면 정책이 통과해도 42501 이 난다).
-- -----------------------------------------------------------------------------
alter table public.news_category_templates enable row level security;

grant select, insert, update, delete on public.news_category_templates to authenticated;
grant all on public.news_category_templates to service_role;

drop policy if exists news_category_templates_admin_all on public.news_category_templates;
create policy news_category_templates_admin_all on public.news_category_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. 시드 — 카테고리 6종의 기본 템플릿
--
-- `on conflict do nothing` 이다. 운영자가 문안을 고친 뒤 마이그레이션을 다시 돌려도
-- 원본으로 되돌아가지 않는다. 되돌리기는 화면의 '기본값으로 되돌리기' 로만 일어난다
-- (같은 문안이 admin/lib/constants/news-templates.ts 에 있다).
-- -----------------------------------------------------------------------------
insert into public.news_category_templates
  (category_key, title_template, summary_template, body_template)
values
  -- 공지사항
  (
    'notice',
    $tpl$[공지] {{제목}}$tpl$,
    $tpl$$tpl$,
    $tpl$<p>안녕하세요, 글자월드입니다.</p><h3>안내</h3><p>{{안내 내용}}</p><h3>유의사항</h3><ul><li><p>{{유의사항}}</p></li></ul>$tpl$
  ),
  -- 점검안내
  (
    'maintenance',
    $tpl$[점검] {{날짜}} 정기 점검 안내$tpl$,
    $tpl${{날짜}} {{시작 시각}}~{{종료 시각}} 서버 점검이 진행됩니다.$tpl$,
    $tpl$<p>안녕하세요, 글자월드입니다.</p><p>더 나은 서비스를 위해 아래와 같이 서버 점검을 진행합니다.</p><h3>점검 일시</h3><p>{{날짜}} {{시작 시각}} ~ {{종료 시각}} (약 {{소요 시간}})</p><h3>점검 내용</h3><ul><li><p>{{점검 항목}}</p></li></ul><h3>유의사항</h3><ul><li><p>점검 중에는 게임에 접속할 수 없습니다.</p></li><li><p>점검 시간은 진행 상황에 따라 늘어나거나 줄어들 수 있습니다.</p></li></ul>$tpl$
  ),
  -- 업데이트 안내
  (
    'update',
    $tpl$[업데이트] {{날짜}} 업데이트 안내$tpl$,
    $tpl$$tpl$,
    $tpl$<h3>적용 일시</h3><p>{{날짜}} {{시각}}</p><h3>업데이트 내용</h3><ul><li><p>{{업데이트 내용}}</p></li></ul><h3>유의사항</h3><ul><li><p>{{유의사항}}</p></li></ul>$tpl$
  ),
  -- 패치노트
  (
    'patch',
    $tpl$[패치노트] v{{버전}}$tpl$,
    $tpl$v{{버전}} 패치 내역입니다.$tpl$,
    $tpl$<h3>버전</h3><p>v{{버전}} · {{적용 일시}}</p><h3>변경 사항</h3><ul><li><p>{{변경 내용}}</p></li></ul><h3>버그 수정</h3><ul><li><p>{{수정 내용}}</p></li></ul>$tpl$
  ),
  -- 이벤트
  (
    'event',
    $tpl$[이벤트] {{이벤트명}}$tpl$,
    $tpl${{시작일}} ~ {{종료일}} 진행되는 {{이벤트명}} 안내입니다.$tpl$,
    $tpl$<h3>기간</h3><p>{{시작일}} {{시각}} ~ {{종료일}} {{시각}}</p><h3>참여 방법</h3><ul><li><p>{{참여 방법}}</p></li></ul><h3>보상</h3><ul><li><p>{{보상}}</p></li></ul><h3>유의사항</h3><ul><li><p>{{유의사항}}</p></li></ul>$tpl$
  ),
  -- 안내사항
  (
    'info',
    $tpl$[안내] {{제목}}$tpl$,
    $tpl$$tpl$,
    $tpl$<h3>안내</h3><p>{{안내 내용}}</p><h3>문의</h3><p>궁금한 점은 1:1 문의로 알려 주세요.</p>$tpl$
  )
on conflict (category_key) do nothing;
