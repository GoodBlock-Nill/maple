-- =============================================================================
-- 20260908002200_legal_documents
-- 약관·정책 문서(개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책)와
-- 그 개정 이력.
--
-- 왜 두 테이블인가
--   문서(무엇)와 개정본(언제부터 무엇이라고 썼는가)은 수명이 다르다. 한 테이블에
--   담으면 "현재 문안"을 고칠 때마다 과거 문안이 사라져, 분쟁 시점의 약관을 되짚을
--   수 없다. 법률 문서에서 그건 치명적이다. 그래서 문서는 슬러그 하나로 고정하고
--   개정본을 계속 쌓는다.
--
-- 코드 문안과의 관계
--   문안의 출처는 원래 코드(`lib/content/{operating,privacy}-policy`)였다. 이
--   마이그레이션이 그 값을 HTML 로 옮겨 최초 발행본으로 심는다(아래 SEED 구간은
--   `node scripts/seed-legal.mjs` 가 생성한다). 코드 쪽은 지우지 않는다 — DB 조회가
--   실패하거나 발행본이 없을 때의 폴백으로 남는다.
-- =============================================================================

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 슬러그는 곧 사용자 사이트의 `/policy/[slug]` 다. 자유 입력을 허용하면 아무도
  -- 읽지 않는 문서가 조용히 쌓인다.
  constraint legal_documents_slug_known check (slug in ('privacy', 'discord', 'operating'))
);

comment on table public.legal_documents is '약관·정책 문서. slug 는 사용자 사이트 /policy/[slug] 와 1:1.';

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents (id) on delete cascade,
  version text not null,
  effective_date date not null,
  content_html text not null,
  summary text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- 같은 문서에 같은 버전 두 벌이 있으면 "어느 것이 시행 중인가"에 답할 수 없다.
  constraint legal_document_versions_unique_version unique (document_id, version),
  -- 버전은 시행일 기준 YYYYMMDD. 하루에 두 번 고치는 일이 있어 `-1` 접미사를 연다.
  constraint legal_document_versions_version_format check (version ~ '^[0-9]{8}(-[0-9]{1,2})?$'),
  -- 발행 상태와 발행 시각이 어긋나면 이력이 거짓말을 한다.
  constraint legal_document_versions_published_at check (not is_published or published_at is not null)
);

comment on column public.legal_document_versions.effective_date is '시행일. 오늘 이후면 예약 상태 — current_legal_version() 이 아직 고르지 않는다.';
comment on column public.legal_document_versions.summary is '변경 요약. 목록·이력 화면에만 쓰고 본문에는 싣지 않는다.';

-- 현재 버전 판정이 그대로 인덱스를 탄다(문서별 · 발행본만).
create index if not exists legal_document_versions_current_idx
  on public.legal_document_versions (document_id, effective_date desc, published_at desc)
  where is_published;

-- 이력 화면은 최신순 전체를 읽는다(임시저장 포함).
create index if not exists legal_document_versions_history_idx
  on public.legal_document_versions (document_id, created_at desc);

drop trigger if exists set_updated_at on public.legal_documents;
create trigger set_updated_at before update on public.legal_documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- current_legal_version(slug)
--
-- "지금 시행 중인 문안"의 단일 정의. 클라이언트가 이 규칙을 직접 짜면 관리자
-- 미리보기와 사용자 화면이 서로 다른 버전을 고르는 일이 생긴다.
--
-- 규칙
--   1) 발행본 중 시행일이 오늘 이하인 것 → 시행일이 가장 늦은 것.
--   2) 그런 것이 하나도 없으면(모두 예약) → 가장 최근에 발행한 것.
--   같은 시행일이 여럿이면 나중에 발행한 쪽이 이긴다(같은 날 재개정).
--
-- SECURITY INVOKER 다. RLS 가 그대로 적용되므로 anon 은 발행본만 본다 — 함수가
-- 권한 우회 통로가 되지 않는다.
-- -----------------------------------------------------------------------------
create or replace function public.current_legal_version(p_slug text)
returns table (
  slug text,
  title text,
  version text,
  effective_date date,
  content_html text,
  summary text,
  published_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select d.slug, d.title, v.version, v.effective_date, v.content_html, v.summary, v.published_at
  from public.legal_documents d
  join public.legal_document_versions v on v.document_id = d.id
  where d.slug = p_slug
    and v.is_published
  order by
    (v.effective_date <= current_date) desc,
    case when v.effective_date <= current_date then v.effective_date end desc nulls last,
    v.published_at desc
  limit 1;
$$;

comment on function public.current_legal_version(text) is
  '슬러그의 현재 시행 문안 한 줄. 시행일이 오늘 이하인 최신 발행본, 없으면 가장 최근 발행본.';

-- -----------------------------------------------------------------------------
-- RLS
-- 읽기는 공개(발행본만), 쓰기는 관리자만. 20260908002000 과 같은 이유로 GRANT 를
-- 명시한다 — 정책을 만족해도 테이블 권한이 없으면 permission denied 가 난다.
-- -----------------------------------------------------------------------------
alter table public.legal_documents          enable row level security;
alter table public.legal_document_versions  enable row level security;

grant select on public.legal_documents         to anon, authenticated;
grant select on public.legal_document_versions to anon, authenticated;
grant insert, update, delete on public.legal_documents         to authenticated;
grant insert, update, delete on public.legal_document_versions to authenticated;
grant all on public.legal_documents         to service_role;
grant all on public.legal_document_versions to service_role;

grant execute on function public.current_legal_version(text) to anon, authenticated, service_role;

drop policy if exists legal_documents_select_public on public.legal_documents;
create policy legal_documents_select_public on public.legal_documents
  for select to anon, authenticated
  using (true);

drop policy if exists legal_documents_write_admin on public.legal_documents;
create policy legal_documents_write_admin on public.legal_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 임시저장본은 공개되지 않는다. 예약(미래 시행일) 발행본은 열어 둔다 — 개정 예고는
-- 법령상 사전 공지 대상이라 감추는 쪽이 오히려 문제가 된다.
drop policy if exists legal_versions_select_published on public.legal_document_versions;
create policy legal_versions_select_published on public.legal_document_versions
  for select to anon, authenticated
  using (is_published);

drop policy if exists legal_versions_select_admin on public.legal_document_versions;
create policy legal_versions_select_admin on public.legal_document_versions
  for select to authenticated
  using (public.is_admin());

drop policy if exists legal_versions_write_admin on public.legal_document_versions;
create policy legal_versions_write_admin on public.legal_document_versions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- >>> SEED (generated by scripts/seed-legal.mjs — do not edit by hand) >>>
-- 최초 발행본. `on conflict do nothing` 이라 재실행해도 운영자가 이미 고친
-- 문안을 덮어쓰지 않는다.

insert into public.legal_documents (slug, title)
values ('privacy', '글자월드 개인정보처리방침')
on conflict (slug) do nothing;

insert into public.legal_document_versions (
  document_id, version, effective_date, content_html, summary, is_published, published_at
)
select
  d.id,
  '20260918-5',
  date '2026-09-18',
  $legal$<p>글자월드 운영자(이하 "운영자")는 메이플스토리 월드(MapleStory Worlds)에서 서비스되는 게임 "글자월드"의 공식 홈페이지 및 커뮤니티(https://www.gjstory.com, 이하 "서비스")를 운영하면서 「개인정보 보호법」 등 관계 법령을 준수하며, 이용자의 개인정보를 안전하게 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.<br />본 방침은 서비스(웹사이트) 이용과 관련하여 운영자가 수집·이용하는 개인정보에 적용됩니다. 넥슨 계정 정보 및 메이플스토리 월드 플랫폼 내 게임 이용 정보는 운영자가 수집·처리하지 않으며(서비스 이용을 위해 수집하는 메이플스토리 월드 계정 UID·프로필 코드는 제외), 해당 정보는 넥슨(주) 및 메이플스토리 월드 운영사(Toben Studio Inc.)의 개인정보처리방침에 따릅니다.</p><h2>1. 개인정보의 처리 목적</h2><p>운영자는 다음 목적을 위해 개인정보를 처리합니다.</p><ul><li>회원 식별, 가입 의사 확인 및 본인 확인(소셜 로그인 제공자의 인증 결과 확인)</li><li>로그인 세션 유지 등 계정 보호 및 서비스 이용 환경 제공</li><li>커뮤니티(게시글·댓글 작성 및 표시), 뉴스·가이드 등 콘텐츠 제공</li><li>1:1 문의 접수, 답변 및 처리 결과 안내</li><li>서비스 관련 공지사항 및 변경사항 안내</li><li>운영정책 위반 행위 및 부정 이용 방지, 이용 제한 조치의 기록·관리</li><li>접속 통계 등 비식별화된 정보를 활용한 서비스 품질 개선</li></ul><p>수집한 개인정보는 위 목적 이외의 용도로 이용하지 않습니다. 처리 목적이 변경되는 경우 관계 법령에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.</p><h2>2. 처리하는 개인정보의 항목 및 수집 방법</h2><p><strong>①</strong>운영자는 서비스 제공을 위해 다음과 같이 최소한의 개인정보를 수집합니다.</p><table><thead><tr><th>구분</th><th>수집 항목</th><th>수집 방법</th></tr></thead><tbody><tr><td>회원가입(필수)</td><td>이메일 주소</td><td>SSO(간편로그인) 시 소셜 로그인 제공자(구글·카카오·네이버)로부터 제공받음</td></tr><tr><td>프로필 설정(선택)</td><td>닉네임</td><td>최초 로그인 또는 프로필 설정 시 이용자가 직접 입력</td></tr><tr><td>서비스 이용(필수)</td><td>메이플스토리 월드 계정 UID, 메이플스토리 월드 프로필 코드</td><td>서비스 이용 과정에서 수집</td></tr><tr><td>커뮤니티 이용</td><td>작성한 게시글·댓글, 좋아요 등 활동 기록</td><td>서비스 이용 과정에서 생성</td></tr><tr><td>1:1 문의(필수)</td><td>이메일 주소, 메이플스토리 월드 계정 UID, 문의 내용(문의 유형·제목 포함)</td><td>문의 등록 시 이용자가 직접 입력</td></tr><tr><td>1:1 문의(선택)</td><td>첨부파일(최대 3개), 이용자가 문의 과정에서 직접 제공한 정보</td><td>문의 등록 시 이용자가 직접 입력·첨부</td></tr><tr><td>자동 수집</td><td>IP 주소, 접속 일시, 브라우저·운영체제 정보, 서비스 이용 기록, 쿠키</td><td>서비스 이용 과정에서 자동 생성·수집</td></tr></tbody></table><p><strong>②</strong>이용자는 선택항목 제공에 동의하지 않을 수 있으며, 선택항목을 제공하지 않아도 기본적인 서비스 이용에는 제한이 없습니다.</p><p><strong>③</strong>운영자는 사상·신념, 건강, 성생활 등 민감정보와 주민등록번호 등 고유식별정보를 수집하지 않습니다.</p><p><strong>④</strong>이용자가 게시글·댓글에 스스로 공개한 정보(닉네임 포함)는 다른 이용자에게 공개되므로 게시 시 주의하여 주시기 바랍니다.</p><h2>3. 개인정보의 처리 및 보유기간</h2><p><strong>①</strong>운영자는 개인정보의 수집·이용 목적이 달성되면 해당 개인정보를 지체 없이 파기합니다.</p><p><strong>②</strong>회원 탈퇴를 요청한 경우 재가입에 대비하여 탈퇴일로부터 90일간 보존한 뒤 지체 없이 파기합니다(관계 법령에 따른 보존 항목 제외). 보존 기간 동안 같은 소셜 로그인 계정으로 다시 로그인하면 계정이 복구됩니다.</p><ul><li>파기 항목: 이메일 주소, 닉네임, 메이플스토리 월드 계정 UID, 메이플스토리 월드 프로필 코드</li><li>게시글·댓글은 유지되며, 작성자 정보는 "탈퇴한 회원"으로 비식별 처리됩니다. 게시물은 탈퇴 전에 이용자가 직접 삭제할 수 있습니다.</li></ul><p><strong>③</strong>다만 다음 정보는 아래 기간 동안 다른 개인정보와 분리하여 보관합니다.</p><table><thead><tr><th>보존 항목</th><th>보존 근거</th><th>보존 기간</th></tr></thead><tbody><tr><td>운영정책 위반·부정 이용 기록(이메일 주소, 제재 사유)</td><td>부정 이용 재발 방지(운영자 내부 방침)</td><td>회원 탈퇴 후 1년</td></tr><tr><td>1:1 문의 기록 및 첨부파일</td><td>소비자의 불만 또는 분쟁처리에 관한 기록(전자상거래 등에서의 소비자보호에 관한 법률)</td><td>3년</td></tr><tr><td>서비스 접속 기록(IP 주소, 접속 일시)</td><td>통신비밀보호법</td><td>3개월</td></tr></tbody></table><h2>4. 개인정보의 제3자 제공</h2><p>운영자는 이용자의 개인정보를 제1조·제2조에서 명시한 범위 내에서만 처리하며, 원칙적으로 이용자의 사전 동의 없이 제3자에게 제공하지 않습니다.</p><p>다만, 다음의 경우에는 개인정보를 제공할 수 있습니다.</p><ul><li>이용자가 사전에 동의한 경우</li><li>관계 법령에 특별한 규정이 있는 경우</li><li>수사기관 등이 관계 법령에 정해진 절차와 방법에 따라 요청한 경우</li></ul><p>향후 개인정보를 제3자에게 제공하게 되는 경우 제공받는 자, 제공 목적, 제공 항목 및 보유기간을 사전에 안내하고 필요한 동의를 받습니다.</p><h2>5. 개인정보 처리업무의 위탁</h2><p>운영자는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 외부 업체에 위탁하고 있습니다.</p><table><thead><tr><th>수탁업체</th><th>위탁업무</th></tr></thead><tbody><tr><td>Amazon Web Services, Inc.</td><td>서버 운영 및 데이터 보관</td></tr><tr><td>Sendbird, Inc.</td><td>이메일 및 알림 발송</td></tr><tr><td>(주)가비아(하이웍스)</td><td>이메일 호스팅(문의 접수·답변 등 이메일 계정 운영 및 메일 보관)</td></tr></tbody></table><p>운영자는 위탁계약 체결 시 관계 법령에 따라 개인정보 보호, 목적 외 처리 금지, 재위탁 제한, 안전성 확보조치 및 수탁업체에 대한 관리·감독 사항을 계약서 등에 명시합니다.</p><p>수탁업체 또는 위탁업무가 변경되는 경우 본 개인정보처리방침을 통해 공개합니다.</p><h2>6. 개인정보의 국외 이전</h2><p>운영자는 AWS 및 Sendbird의 실제 서버 리전과 계약 설정을 확인하여 개인정보가 국외로 이전되는 경우 이전받는 자, 이전 국가, 이전 항목, 이전 목적, 이전 일시와 방법, 보유기간 및 이전 거부 방법을 본 개인정보처리방침에 공개합니다.</p><p>AWS와 Sendbird가 모두 국내 리전으로 설정되어 개인정보가 국내에서만 처리되는 경우에는 개인정보를 국외로 이전하지 않습니다.</p><h2>7. 개인정보의 파기 절차 및 방법</h2><h3>1. 파기 절차</h3><p>보유기간이 경과하거나 처리 목적이 달성된 개인정보는 파기 대상 정보를 확인한 후 개인정보 보호책임자의 승인에 따라 지체 없이 파기합니다. 회원 탈퇴 후 보존 기간(90일)이 지난 계정의 개인정보는 자동으로 파기합니다.</p><p>다른 법령에 따라 개인정보를 보존해야 하는 경우에는 해당 개인정보를 별도의 저장 공간으로 옮겨 보존 기간 동안만 보관합니다.</p><h3>2. 파기 방법</h3><ul><li>전자적 파일 형태의 정보는 복구·재생할 수 없는 방법으로 영구 삭제합니다.</li><li>출력물은 분쇄 또는 소각하여 파기합니다.</li></ul><h2>8. 이용자와 법정대리인의 권리·의무 및 행사방법</h2><p>① 이용자는 언제든지 자신의 개인정보에 대해 다음 권리를 행사할 수 있습니다.</p><ul><li>개인정보 열람 요구</li><li>개인정보 정정 또는 삭제 요구</li><li>개인정보 처리정지 요구</li><li>개인정보 수집·이용 동의의 철회(회원 탈퇴)</li></ul><p><strong>②</strong>권리 행사는 서비스 내 계정 설정 또는 제12조의 개인정보 보호책임자 이메일(care@gjstory.com)로 요청할 수 있으며, 운영자는 요청을 받은 날부터 10일 이내에 조치합니다.</p><p><strong>③</strong>이용자는 법정대리인이나 위임받은 대리인을 통해 권리를 행사할 수 있습니다. 이 경우 관련 고시에 따른 위임장을 제출해야 합니다.</p><p><strong>④</strong>운영자는 권리 행사를 요청한 사람이 본인 또는 정당한 대리인인지 확인할 수 있습니다.</p><p><strong>⑤</strong>다른 법령에서 열람·삭제 등을 제한하거나 해당 개인정보가 법령상 보존 대상인 경우 권리 행사가 제한될 수 있습니다.</p><p><strong>⑥</strong>이용자는 자신의 개인정보를 최신 상태로 정확하게 유지할 책임이 있으며, 타인의 개인정보를 침해하는 경우 관련 법령에 따라 처벌될 수 있습니다.</p><h2>9. 만 14세 미만 아동의 개인정보</h2><p>운영자는 만 14세 미만 아동의 개인정보를 수집하지 않으며, 만 14세 미만 아동은 회원으로 가입할 수 없습니다. 만 14세 미만 아동의 가입 사실이 확인되는 경우 해당 계정과 개인정보를 지체 없이 삭제합니다.</p><h2>10. 개인정보의 안전성 확보조치</h2><p>운영자는 개인정보 보호를 위해 다음과 같은 조치를 시행합니다.</p><ul><li>비밀번호를 수집·저장하지 않으며, 인증은 소셜 로그인 제공자의 인증 결과와 세션 토큰으로 처리합니다.</li><li>개인정보는 전송 구간에서 TLS(HTTPS)로 암호화합니다.</li><li>개인정보 처리 인원을 최소한으로 제한하고, 데이터베이스 접근 권한을 계정별로 분리·통제합니다.</li><li>개인정보에 대한 접근 기록을 보관하고 위·변조를 방지합니다.</li><li>외부의 무단 접근을 방지하기 위한 접근통제 및 보안 프로그램 설치·정기 점검을 실시합니다.</li><li>개인정보 처리 인원에 대해 정기적인 보안 교육을 실시합니다.</li><li>내부관리계획을 수립·시행합니다.</li></ul><h2>11. 쿠키의 이용 및 거부</h2><p><strong>①</strong>운영자는 로그인 상태 유지 등 서비스 제공에 필수적인 목적으로 쿠키(cookie)를 사용합니다. 광고·마케팅 목적의 쿠키는 사용하지 않습니다.</p><p><strong>②</strong>쿠키는 웹사이트 서버가 이용자의 브라우저에 전송하는 소량의 정보입니다.</p><p>③ 이용자는 브라우저 설정을 통해 쿠키 저장을 허용하거나 차단·삭제할 수 있습니다.</p><ul><li>Chrome: 설정 → 개인정보 및 보안 → 서드 파티 쿠키</li><li>Edge: 설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터 관리</li><li>Safari: 설정 → 개인정보 보호 → 쿠키 설정</li></ul><p><strong>④</strong>필수 쿠키를 거부할 경우 로그인이 필요한 서비스 이용이 제한될 수 있습니다.</p><h2>12. 개인정보 보호책임자 및 열람청구</h2><p>운영자는 개인정보 처리 업무를 총괄하고 이용자의 문의 및 피해구제를 처리하기 위해 개인정보 보호책임자를 지정하고 있습니다.</p><h3>개인정보 보호책임자</h3><ul><li>담당자: 글자월드 관리자</li><li>이메일: care@gjstory.com</li></ul><h3>개인정보 열람청구 접수·처리 부서</h3><ul><li>담당 부서: 운영팀</li><li>이메일: care@gjstory.com</li></ul><p>이용자는 서비스 이용 중 발생한 개인정보 관련 문의, 불만 및 피해구제 요청을 위 연락처로 접수할 수 있으며, 운영자는 지체 없이 답변·처리합니다.</p><h2>13. 권익침해 구제방법</h2><p>개인정보 침해에 대한 신고나 상담이 필요한 경우 다음 기관에 문의할 수 있습니다.</p><table><thead><tr><th>기관</th><th>연락처</th></tr></thead><tbody><tr><td>개인정보침해신고센터(한국인터넷진흥원)</td><td>(국번 없이) 118 / https://privacy.kisa.or.kr</td></tr><tr><td>개인정보분쟁조정위원회</td><td>(국번 없이) 1833-6972 / https://www.kopico.go.kr</td></tr><tr><td>경찰청 사이버수사국</td><td>(국번 없이) 182 / https://ecrm.police.go.kr</td></tr></tbody></table><h2>14. 개인정보처리방침의 변경</h2><p>본 방침의 내용이 추가·삭제·수정되는 경우 시행일로부터 최소 7일 전에 서비스 공지사항을 통해 안내합니다. 다만 수집 항목, 이용 목적 등 이용자 권리에 중대한 영향을 미치는 변경사항은 시행일로부터 최소 30일 전에 안내합니다.</p><ul><li>공고일: 2026.09.18</li><li>시행일: 2026.09.18</li></ul>$legal$,
  '코드 문안(lib/content/privacy-policy)을 옮긴 최초 발행본.',
  true,
  now()
from public.legal_documents d
where d.slug = 'privacy'
on conflict (document_id, version) do nothing;

insert into public.legal_documents (slug, title)
values ('discord', '디스코드 운영정책')
on conflict (slug) do nothing;

insert into public.legal_document_versions (
  document_id, version, effective_date, content_html, summary, is_published, published_at
)
select
  d.id,
  '20260918-5',
  date '2026-09-18',
  $legal$<p>글자월드 공식 디스코드 서버는 모두가 안전하게 즐길 수 있는 공간을 목표로 운영됩니다.</p><p>정식 운영정책 문안은 준비 중입니다. 확정되는 대로 이 페이지에 게시합니다.</p>$legal$,
  '확정 문안 이전의 안내 문단.',
  true,
  now()
from public.legal_documents d
where d.slug = 'discord'
on conflict (document_id, version) do nothing;

insert into public.legal_documents (slug, title)
values ('operating', '글자월드 운영정책')
on conflict (slug) do nothing;

insert into public.legal_document_versions (
  document_id, version, effective_date, content_html, summary, is_published, published_at
)
select
  d.id,
  '20260918-2',
  date '2026-09-18',
  $legal$<p>본 서버는 넥슨(주)의 메이플스토리월드 플랫폼에서 공식 출시된 글자월드입니다.<br />'MapleStory' 및 관련 지식재산권은 NEXON Korea Corp.에 있습니다.<br />'MapleStory Worlds' 및 관련 지식재산권은 Toben Studio Inc.에 있습니다.<br />본 서비스는 이용약관 및 가이드라인을 준수하여 운영됩니다.</p><h2>1. 기본 원칙</h2><p><strong>[1-1]</strong>글자월드 운영팀(이하 "운영팀")이 본 운영정책을 시행하며, 모든 이용자는 본 정책 및 글자월드 이용약관에 동의한 것으로 간주합니다.</p><p><strong>[1-2]</strong>게임 내 캐릭터, 아이템, 게임 재화 등 모든 결과물의 소유권은 운영팀에 있습니다. 이용자는 이용 권한만을 가집니다.</p><p><strong>[1-3]</strong>운영정책에 명시되지 않은 사항은 운영팀의 판단, 관련 법령, 사회 통념에 따라 처리합니다.</p><p><strong>[1-4]</strong>게임 환경 또는 이용자 보호를 위해 긴급 조치가 필요한 경우, 사전 공지 없이 제재가 이루어질 수 있으며 이후 사후 공지합니다.</p><h2>2. 이용자 권리 및 의무</h2><h3>2-1. 이용자 권리</h3><ul><li>글자월드의 모든 콘텐츠를 이용약관 범위 내에서 이용할 권리</li><li>게임 이용 중 발생한 문제를 고객센터를 통해 해결 요청할 권리</li><li>운영팀의 귀책으로 인한 피해 발생 시 공식 경로로 문의 및 개선 요청할 권리</li><li>게임 이용 제한에 대해 <strong>제재일로부터 15일 이내</strong> 이의신청할 권리</li></ul><h3>2-2. 이용자 의무</h3><ul><li>다른 이용자에게 피해를 주는 행위 금지 및 건전한 게임 질서 유지 협조</li><li>계정 및 개인정보 보안 유지에 최선의 주의를 기울여야 합니다.</li><li>타인 정보 도용 및 허위 정보 입력으로 가입된 ID의 캐릭터 및 아이템 권리는 인정되지 않으며, 문제가 발생하는 경우에도 책임은 이용자에게 있습니다</li><li>버그 또는 오류 발견 시 즉시 고객센터를 통해 제보하고 해당 오류를 반복 이용하지 않을 의무</li><li>거짓 신고(허위 민원) 금지</li></ul><h2>3. 금지행위 및 제재 기준</h2><h3>3-1. 게임 내 질서 위반</h3><h4>가. 게임 운영 방해 (일반)</h4><ul><li>이벤트 또는 운영팀이 주관하는 공식 활동을 의도적으로 방해하는 행위</li><li>운영팀에 대한 근거 없는 허위 사실 유포로 운영 활동을 방해하는 행위</li><li>고객센터(1:1 문의)에 허위 신고를 반복하는 행위</li><li>게임 기획 의도에 반하는 방식으로 게임 진행을 방해하는 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재</td><td>15일 이용제한</td><td>30일 이용제한</td><td>90일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h4>나. 게임 운영 방해 (특수)</h4><p>대상 행위:</p><ul><li>운영팀 관계자 또는 운영자를 사칭하여 이용자 정보나 재화를 요구하는 행위</li><li>공식적으로 알려지지 않은 허위 정보를 마치 공식 정보인 것처럼 유포하는 행위</li><li>공식 공지·안내 내용을 임의로 수정하거나 변조하여 배포하는 행위</li><li>게임 경제 시스템에 악영향을 끼칠 목적으로 집단적·의도적 행위를 조장하는 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차 이상</th></tr></thead><tbody><tr><td>제재</td><td>90일 이용제한</td><td>180일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h3>3-2. 거래 관련 위반</h3><h4>가. 사기·비매너 거래 (부당이득 회수 가능한 경우)</h4><p>대상 행위:</p><ul><li>게임 시스템을 악용하여 거래 정보를 속이거나 부당한 방법으로 이득을 취하는 행위</li><li>허위 정보, 사기, 사칭 등의 방법으로 다른 이용자의 재화를 갈취하는 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재</td><td>30일 이용제한</td><td>90일 이용제한</td><td>180일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h4>나. 사기·비매너 거래 (부당이득 회수 불가능한 경우)</h4><table><thead><tr><th>차수</th><th>1차</th><th>2차 이상</th></tr></thead><tbody><tr><td>제재</td><td>365일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h4>다. 현금 거래</h4><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재 (회수 가능)</td><td>7일 이용제한</td><td>15일 이용제한</td><td>30일 이용제한</td><td>90일 이용제한</td></tr><tr><td>제재 (회수 불가)</td><td>15일 이용제한</td><td>60일 이용제한</td><td>180일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h3>3-3. 채팅 및 이름 위반</h3><h4>가. 채팅 정책 위반</h4><p>대상 행위:</p><ul><li>선정적·음란·비속어·혐오 표현이 포함된 채팅</li><li>다른 이용자에게 불쾌감, 수치심, 혐오감을 유발하는 채팅</li><li>특정 이용자를 향한 지속적인 비방, 욕설, 스토킹성 채팅</li><li>동일 내용을 반복 전송하는 도배 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재</td><td>3일 채팅 이용제한</td><td>7일 채팅 이용제한</td><td>15일 채팅 이용제한</td><td>30일 채팅 이용제한</td></tr></tbody></table><h4>나. 이름(닉네임·길드명) 정책 위반</h4><p>금지 사항:</p><ul><li>운영팀 관계자 또는 특정인을 사칭하는 이름</li><li>선정적·음란·비속어가 포함된 이름</li><li>차별·비하·명예훼손의 소지가 있는 이름</li><li>사회 통념에 반하는 이름</li><li>숫자·특수문자만으로 구성된 식별 불가 닉네임 ("바코드" 형태)</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재</td><td>경고 + 강제 변경</td><td>7일 이용제한</td><td>15일 이용제한</td><td>30일 이용제한</td></tr></tbody></table><h3>3-4. 비인가 프로그램</h3><p>대상 행위:</p><ul><li>자동 사냥(매크로) 프로그램 또는 이와 유사한 자동화 소프트웨어를 사용하는 행위</li><li>핵(Hack), 속도 조작, 좌표 조작, 무적 등 게임 클라이언트를 변조하는 프로그램을 사용하는 행위</li><li>게임 클라이언트의 데이터를 저장·감청·수정하는 프로그램을 사용하는 행위</li><li>다른 이용자의 정보를 수집하는 프로그램을 사용하거나 유포하는 행위</li><li>비인가 프로그램을 제작하거나 유포하는 행위</li><li>매크로 하드웨어(자동 클릭 마우스 등 물리적 자동화 장치)를 사용하는 행위</li></ul><table><thead><tr><th>차수</th><th>제재</th></tr></thead><tbody><tr><td><strong>1차 (즉시 영구)</strong></td><td><strong>영구 이용제한</strong></td></tr></tbody></table><h3>3-5. 게임 오류 유포</h3><p>대상 행위:</p><ul><li>게임 오류(버그)를 다른 이용자에게 전파하거나 유포하는 행위</li></ul><table><thead><tr><th>차수</th><th>제재 (부당이득 회수 가능)</th><th>제재 (부당이득 회수 불가)</th></tr></thead><tbody><tr><td>1차</td><td>30일 이용제한</td><td>90일 이용제한</td></tr><tr><td>2차</td><td>90일 이용제한</td><td>365일 이용제한</td></tr><tr><td>3차 이상</td><td>365일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h3>3-6. 게임 오류 사용</h3><p>대상 행위:</p><ul><li>게임 오류를 반복적으로 또는 장기간 이용하는 행위</li><li>운영팀의 공식 안내 이후에도 해당 오류를 계속 이용하는 행위</li></ul><table><thead><tr><th>차수</th><th>제재 (부당이득 회수 가능)</th><th>제재 (부당이득 회수 불가)</th></tr></thead><tbody><tr><td>1차</td><td>7일 이용제한</td><td>30일 이용제한</td></tr><tr><td>2차</td><td>15일 이용제한</td><td>90일 이용제한</td></tr><tr><td>3차 이상</td><td>30일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h3>3-7. 개인정보 도용 및 유출</h3><h4>가. 계정 도용</h4><p>대상 행위:</p><ul><li>타인의 계정(ID)을 무단으로 이용/도용하는 행위</li></ul><table><thead><tr><th>차수</th><th>제재</th></tr></thead><tbody><tr><td>1차 (즉시 영구)</td><td>영구 이용제한</td></tr></tbody></table><h4>나. 개인정보 요구·유출 시도</h4><p>대상 행위:</p><ul><li>다른 이용자의 개인정보(이름, 연락처, 주소, 사진, IP 등)나 결제정보를 요구하거나 획득을 시도하는 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차 이상</th></tr></thead><tbody><tr><td>제재</td><td>30일 이용제한</td><td>60일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h4>다. 개인정보 직접 유포</h4><p>대상 행위:</p><ul><li>타인의 개인정보를 동의 없이 게임 내외부에 유포하는 행위</li></ul><table><thead><tr><th>차수</th><th>제재</th></tr></thead><tbody><tr><td>1차 (즉시 영구)</td><td>영구 이용제한</td></tr></tbody></table><h3>3-8. 사행성 행위</h3><h4>가. 사행성 행위 참여</h4><p>대상 행위:</p><ul><li>게임 콘텐츠를 이용한 배팅·배당 등 사행성 활동에 참여하는 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재</td><td>7일 이용제한</td><td>15일 이용제한</td><td>30일 이용제한</td><td>60일 이용제한</td></tr></tbody></table><h4>나. 사행성 행위 주도</h4><p>대상 행위:</p><ul><li>불법 도박 또는 이와 유사한 사행 행위를 주최하거나 참여할 수 있게 조직·주도하는 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차 이상</th></tr></thead><tbody><tr><td>제재</td><td>90일 이용제한</td><td>180일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h3>3-9. 타인 게임 이용 방해</h3><p>대상 행위:</p><ul><li>사냥터 점령, 이동 방해 등 게임 시스템을 이용하여 타인의 정상적인 게임 이용을 방해하는 행위</li><li>특정 이용자를 대상으로 한 스토킹 또는 지속적인 비방 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재</td><td>7일 이용제한</td><td>15일 이용제한</td><td>30일 이용제한</td><td>60일 이용제한</td></tr></tbody></table><h3>3-10. 홍보·광고</h3><p>대상 행위:</p><ul><li>운영팀과 무관한 상업적 홍보·광고 행위</li><li>불법 정보 또는 유해 정보의 홍보</li><li>이용자를 외부 채널로 유도하는 행위</li></ul><table><thead><tr><th>차수</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>제재</td><td>90일 이용제한</td><td>180일 이용제한</td><td>365일 이용제한</td><td>영구 이용제한</td></tr></tbody></table><h2>4. 추가 제재 규정</h2><h3>4-1. 공통 원칙</h3><p><strong>[4-1-1]</strong>직접적으로 운영정책을 위반하지 않더라도, 해당 행위에 연관된 것이 확인될 경우 위반자와 동일한 제재가 적용될 수 있습니다.</p><p><strong>[4-1-2]</strong>동일한 PC·기기(시스템 정보)에서 반복적으로 운영정책을 위반하는 행위가 확인될 경우, 해당 기기에서 접속한 모든 계정은 동일인으로 간주하여 제재가 적용될 수 있습니다.</p><p><strong>[4-1-3]</strong>운영정책 위반으로 취득한 부당이득(아이템·게임머니·경험치 등 직·간접 취득물 전부 포함)은 회수될 수 있습니다.</p><p><strong>[4-1-4]</strong>2개 이상의 운영정책을 동시에 위반한 경우, 가장 높은 수위의 제재를 우선 적용하며 추가 조치가 병행될 수 있습니다.</p><h3>4-2. 비정상 게임 이용 탐지</h3><p>[4-2-1] 아래 사유가 확인될 경우 비정상 게임 이용 제약이 부여될 수 있습니다</p><ul><li>비정상 게임 이용 검출 시스템에 탐지된 경우</li><li>비정상적인 기록(사람이 직접 하기 어려운 수준의 플레이)이 확인된 경우</li></ul><p>[4-2-2] 비정상 게임 이용 제약의 예시</p><ul><li>비정상 게임 이용 검출 시스템 강화 적용</li><li>특정 콘텐츠 또는 이벤트 참여 일시 제한</li><li>거래(옥션, 1:1거래 등) 기능 일시 제한</li><li>지정 장소로 캐릭터 강제 이동</li></ul><h2>5. 홈페이지(게시판) 운영정책</h2><p><strong>[5-1]</strong>운영팀은 건전한 게시판 문화 조성을 위해 아래 사항에 해당하는 게시물을 사전 통보 없이 편집, 이동, 삭제할 수 있습니다.</p><p><strong>[5-2]</strong>홈페이지 이용제한 기준</p><table><thead><tr><th>위반 유형</th><th>1차</th><th>2차</th><th>3차</th><th>4차 이상</th></tr></thead><tbody><tr><td>게시판 성격과 무관한 게시물</td><td>1일 홈페이지 제한</td><td>3일 홈페이지 제한</td><td>15일 홈페이지 + 15일 게임 제한</td><td>영구 홈페이지 + 30일 게임 제한</td></tr><tr><td>도배·욕설·비방·분쟁 유발 게시물</td><td>3일 홈페이지 제한</td><td>15일 홈페이지 + 15일 게임 제한</td><td>30일 홈페이지 + 30일 게임 제한</td><td>영구 홈페이지 + 게임 제한</td></tr></tbody></table><h2>6. 복구 정책</h2><h3>6-1. 일반 복구</h3><p><strong>[6-1-1]</strong>복구는 운영팀의 귀책 사유로 인한 유실에 한하여 진행되며, 게임 기록을 근거로 복구를 위해 노력합니다.</p><p>[6-1-2] 복구가 불가능한 경우</p><ul><li>PC 결함, 인터넷 접속 불안정 등 이용자 환경 문제로 인한 유실</li><li>공식 공지를 확인하지 않아 발생한 피해</li><li>이용자의 고의 또는 과실로 인한 손실</li></ul><h2>7. 환불 정책</h2><h3>7-1. 캐시 아이템 청약철회</h3><p>[7-1-1] 캐시샵에서 구매한 아이템은 다음 조건을 모두 충족하는 경우에 한하여 환불(청약철회)이 가능합니다</p><ul><li>구매 후 <strong>7일 이내</strong>에 고객센터를 통해 환불 신청</li><li>아이템을 캐릭터 인벤토리로 이동(사용)하기 <strong>이전</strong></li></ul><p>[7-1-2] 환불이 불가능한 경우:</p><ul><li>구매 후 7일이 경과한 경우</li><li>아이템을 수령(인벤토리 이동)하거나 사용한 경우</li><li>기간제 아이템(사용 기간이 설정된 아이템)</li><li>타인에게 선물하거나 2차 거래된 아이템</li></ul><h2>8. 아동·청소년 보호정책</h2><h3>8-1. 개인정보 보호</h3><p><strong>[8-1-1]</strong>아동·청소년 시기에 본인 또는 제3자가 등록한 개인정보(휴대폰 번호, 주소, 이름, 이미지, 동영상 등)에 대해 삭제를 요청할 수 있습니다.</p><p><strong>[8-1-2]</strong>아동·청소년의 개인정보에 해당하는 데이터는 본인 또는 제3자의 요청으로 예고 없이 삭제되거나 숨김 처리될 수 있습니다.</p><p><strong>[8-1-3]</strong>아동·청소년의 개인정보를 획득하거나 이를 시도하는 경우 즉시 이용이 제한됩니다.</p><p><strong>[8-1-4]</strong>아동·청소년의 개인정보를 도용하거나 유포하는 경우 적발 즉시 영구 이용제한 및 수사 의뢰가 진행됩니다.</p><h3>8-2. 아동·청소년 인권 보호</h3><p><strong>[8-2-1]</strong>아동·청소년 대상 음란·비윤리적 행위, 욕설, 비하 등의 모욕적 언행은 즉시 이용 제한의 대상이 됩니다.</p><p><strong>[8-2-2]</strong>성적 접촉을 목적으로 아동·청소년과 정서적 관계를 구축하거나, 외부 만남을 시도·주선하는 행위가 적발될 경우 즉시 접속제한 및 영구 이용제한, 수사 의뢰 등의 조치가 진행될 수 있습니다.</p><p><strong>[8-2-3]</strong>아동·청소년 대상으로 성적인 내용을 직접·암시적으로 언급하는 행위가 적발될 경우 즉시 접속제한 및 영구 이용제한, 수사 의뢰 등의 조치가 진행될 수 있습니다.</p><h2>9. 고객센터 담당자 보호</h2><h3>9-1. 금지 행위</h3><p>고객센터(1:1 문의) 이용 시 아래 행위는 금지됩니다</p><ul><li>욕설·성희롱·인격침해·위협적 표현이 포함된 문의</li><li>게임과 무관한 욕설만으로 작성된 반복 문의</li><li>업무 방해를 목적으로 한 지속적인 욕설·악성 민원</li><li>담당자에게 심각한 정신적 피해를 주는 언행</li></ul><h3>9-2. 제재 기준</h3><table><thead><tr><th>차수</th><th>제재</th></tr></thead><tbody><tr><td>1차</td><td>경고 및 상담 중단</td></tr><tr><td>2차</td><td>3일 게임 이용제한</td></tr><tr><td>3차 이상</td><td>7일 게임 이용제한 (반복 시 누적 적용, 최대 30일)</td></tr></tbody></table><p><strong>즉시 제한 적용 행위 (사전 경고 없음)</strong></p><ul><li>외모·신체 부위를 이용한 욕설·폭언</li><li>사적인 만남 요구 또는 음란한 언행</li><li>가족 구성원을 대상으로 한 성적 표현·욕설</li><li>성적 수치심을 유발하는 이미지 전송</li><li>기타 성적 혐오감을 유발하는 일체의 언행</li></ul><h2>10. 이의신청</h2><p><strong>[10-1]</strong>게임 이용 제한에 이의가 있는 경우, <strong>제재일로부터 15일 이내</strong>에 고객센터를 통해 이의신청을 할 수 있습니다.</p><p><strong>[10-2]</strong>이의신청은 본인 명의의 계정에 한하여 가능하며, 타인을 대신한 이의신청은 접수되지 않습니다.</p><p><strong>[10-3]</strong>관련 게임 데이터의 보유 기간이 경과한 경우에는 이의신청이 불가능할 수 있습니다.</p><p>[10-4] 이의신청이 접수되지 않는 경우:</p><ul><li><strong>비인가 프로그램</strong> 사용으로 인한 영구 이용제한</li><li>타인의 개인정보 직접 유포로 인한 영구 이용제한</li><li>계정 도용으로 인한 영구 이용제한</li></ul><p>[10-5] 이의신청 시 필요 정보:</p><ul><li>이메일 주소</li><li>계정 ID 또는 고유번호</li><li>캐릭터 닉네임</li><li>제재 관련 상세 내용 및 소명 자료</li></ul><h2>부칙</h2><ul><li>본 운영정책은 2026년 9월 18일 오픈 시점부터 효력이 발생합니다.</li><li>정책 변경 시 공식 홈페이지 및 디스코드를 통해 사전 안내합니다.</li><li>긴급한 경우 사후 안내가 이루어질 수 있습니다.</li></ul>$legal$,
  '운영정책 1차 수정본 반영(2026-09-18)',
  true,
  now()
from public.legal_documents d
where d.slug = 'operating'
on conflict (document_id, version) do nothing;
-- <<< SEED <<<
