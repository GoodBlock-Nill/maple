-- =============================================================================
-- 20260908000400_support
-- 고객지원: 1:1 문의 · 문의 답변 · 자주 묻는 질문.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- inquiries
-- 시안의 폼(계정 ID · 카테고리/유형 2단 셀렉트 · 제목 · 내용 · 첨부 3개 · 동의)을 그대로 담는다.
-- -----------------------------------------------------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  account_id text,
  category text not null,
  type text not null,
  title text not null,
  content text not null,
  -- [{ name, path, size, mimeType }] 형태. 파일 실체는 inquiry-attachments 버킷에 있고
  -- 개수(<=3)만 제약으로 강제한다. 별도 테이블로 쪼갤 만큼 조회 패턴이 복잡하지 않다.
  attachments jsonb not null default '[]'::jsonb,
  privacy_consent boolean not null default false,
  status public.inquiry_status not null default 'pending',
  contact_email text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inquiries_attachments_is_array check (jsonb_typeof(attachments) = 'array'),
  constraint inquiries_attachments_max_3 check (jsonb_array_length(attachments) <= 3),
  -- 개인정보 수집 동의 없이는 접수 자체를 막는다(법적 요건).
  constraint inquiries_privacy_consent_required check (privacy_consent)
);

comment on column public.inquiries.account_id is 'MSW 계정 ID 15자리. 본인 확인용이라 서식은 강제하지 않는다.';
comment on column public.inquiries.category is '계정/결제/버그/신고/기타. 운영 중 항목이 늘어날 수 있어 enum 대신 text 를 쓴다.';
comment on column public.inquiries.type is '문의/신고/제안. category 와 같은 이유로 text.';

create index if not exists inquiries_user_created_idx on public.inquiries (user_id, created_at desc);
create index if not exists inquiries_status_created_idx on public.inquiries (status, created_at desc);

-- -----------------------------------------------------------------------------
-- inquiry_replies
-- 운영자 답변. 사용자는 자기 문의의 답변만 읽을 수 있다.
-- -----------------------------------------------------------------------------
create table if not exists public.inquiry_replies (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text not null default '운영자',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inquiry_replies_inquiry_idx
  on public.inquiry_replies (inquiry_id, created_at);

-- -----------------------------------------------------------------------------
-- faqs
-- -----------------------------------------------------------------------------
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  category public.faq_category not null,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faqs_category_sort_idx
  on public.faqs (category, sort_order)
  where is_published;
