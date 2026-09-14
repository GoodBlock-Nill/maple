# 감사 로그 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 감사 로그 메뉴. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식을 따른다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/audit` (하위 라우트 없음) |
| 권한 모듈 | `audit` — read 하나 |
| 주요 테이블 | `audit_logs`(추가 전용) |
| 클라이언트 영향 | 없음(관리자 전용 데이터) |
| 페이지 크기 | `AUDIT_PAGE_SIZE` = 50 |

**한눈에 상세**

- **경로** 상세는 별도 라우트가 아니라 표 안의 `<details>` 펼침이다.
- **권한** 가드는 `requirePermission('audit','read')` 이고 쓰기 등급을 요구하는 컨트롤이 없다.
- **테이블** 컬럼: `actor_id`, `action`, `target_table`, `target_id text`, `before jsonb`, `after jsonb`, `created_at`.
- **테이블** INSERT/SELECT 정책만 있고 UPDATE/DELETE 정책 자체가 없다.
- **클라이언트** 사용자 사이트가 읽지 않는 테이블이라 `revalidateClient()` 를 부르지 않는다.

**관련 파일**

- 페이지 `admin/app/(admin)/audit/page.tsx`
- 컴포넌트 `admin/components/audit/{AuditFilters,AuditTable,audit-labels,audit-diff}.tsx|ts`
- 데이터 `admin/lib/data/audit.ts`, 기록 헬퍼 `admin/lib/audit.ts`
- 마이그레이션 `supabase/migrations/20260908001700_admin_foundation.sql` §6

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-list.md](01-list.md) | `/audit` | 필터 6종 · 표 5열 · 50건 페이지 |
| 02 | [02-detail-diff.md](02-detail-diff.md) | 표 행의 `<details>` | 변경 요약 · 전후 JSON · 라벨 규칙 |

## 2. 메뉴 전체 규칙

**기록 경로는 둘**

1. 각 모듈의 서버 액션이 `writeAuditLog(actorId, entry)`(`admin/lib/audit.ts`)를 부른다.
2. 회원 탈퇴·복구만 DB 트리거가 직접 남긴다(행위자 = 본인).

- 어느 쪽이든 `actor_id` 는 `auth.uid()` 다.
- 1번은 서비스 롤이 아니라 세션 클라이언트로 insert 한다. RLS `audit_logs_insert_admin` 이 `is_admin() and actor_id = auth.uid()` 를 강제하므로 남의 이름으로 로그를 위조할 수 없다 — 위조 불가능성이 DB 에서 보장된다.

**기록 실패는 본 작업을 되돌리지 않는다** `console.error('[audit] 기록 실패', action, message)` 만 남긴다. 로그를 못 남겼다고 이미 끝난 제재를 취소하면 상태가 더 어긋나기 때문이다. 즉 감사 로그에 없는 조치가 존재할 수 있다.

**추가 전용** 테이블에 UPDATE/DELETE 정책이 없고 화면에도 수정·삭제 경로를 만들지 않는다. `authenticated` 롤에는 `select, insert` 만 grant 돼 있다.

**`target_id` 는 uuid 가 아니라 text** 대상이 uuid 인 테이블만 있는 게 아니다. `site_settings` 는 `'1'`, 랭킹 스냅샷은 `'total@2026-09-14T…'` 같은 복합 키다.

**행위자 표시** `actor_id` FK 가 `on delete set null` 이라 계정이 지워져도 로그 행은 남고 행위자만 `(삭제된 계정)` 이 된다.

**렌더링** `dynamic = 'force-dynamic'` 이다.

## 3. 이 콘솔이 남기는 action

영역별 action 과 기록 위치다(표 대신 목록으로 둔다 — 한 영역의 action 이 최대 다섯 개라 셀에 넣으면 줄바꿈이 심하다).

- **뉴스** `news.create`, `news.update`, `news.publish`, `news.hide`, `news.unhide`, `news.delete`, `news.restore`. 파일 `news-actions.ts`, 대상 `posts`.
- **뉴스 템플릿** `news_template.update`, `news_template.reset`. 파일 `news-template-actions.ts`, 대상 `news_category_templates`.
- **커뮤니티** 게시글·댓글의 숨김·삭제·복구. 파일 `community-*-actions.ts`, 대상 `posts` 와 `comments`.
- **신고** `report.resolve`, `report.dismiss`. 파일 `reports-actions.ts`, 대상 `reports`.
- **회원(관리자 조치)** `member.suspend`, `member.unsuspend`, `member.nickname.force_change`. 파일 `members-actions.ts`, 대상 `profiles`.
- **회원(관리자 조치)** `member.purge`, `member.force_withdraw`. 파일 `member-lifecycle-actions.ts`, 대상 `profiles`.
- **회원(본인 행위)** `member.withdraw`, `member.restore`. DB 트리거가 남기며 대상은 `profiles` 다.
- **회원(본인 행위)** 트리거는 `profiles.deleted_at` 이 채워지면 withdraw, 비워지면 restore 를 남기고 행위자는 `auth.uid()` 다.
- **회원(본인 행위)** 정의 위치는 `supabase/migrations/20260909000400_account_withdrawal.sql` §6 이다.
- **쿠폰** `coupon.create`, `coupon.update`, `coupon.delete`, `coupon.activate`, `coupon.deactivate`. 파일 `coupon*-actions.ts`, 대상 `coupons`.
- **쿠폰 등록** `coupon_redemption.status`. 대상 `coupon_redemptions`.
- **문의** `inquiry.status`, `inquiry.reply`, `inquiry.email.reply`, `inquiry.email.resend`. 파일 `inquir*-actions.ts`, 대상 `inquiries`.
- **문의** `inquiry.assign`, `inquiry.unassign`, `inquiry.edit_lock`. 대상 `inquiries`.
- **문의 메모** `inquiry_note.create`, `inquiry_note.delete`. 대상 `inquiry_notes`.
- **FAQ** `faq.create`, `faq.update`, `faq.delete`, `faq.publish`, `faq.reorder`. 파일 `faqs-actions.ts`, 대상 `faqs`.
- **가이드** `gacha.create`, `gacha.update`, `gacha.delete`. 파일 `gacha-actions.ts`, 대상 `gacha_items`.
- **랭킹** `rankings.snapshot.rollback`. 파일 `rankings-actions.ts`, 대상 `rankings`.
- **사이트 설정** `settings.update`. 파일 `settings-actions.ts`, 대상 `site_settings`.
- **히어로 배너** `banner.create`, `banner.update`, `banner.delete`, `banner.toggle`, `banner.reorder`. 대상 `hero_banners`.
- **약관** `legal.create`, `legal.update`, `legal.publish`, `legal.delete_draft`. 파일 `legal-actions.ts`, 대상 `legal_document_versions`.
- **관리자 초대** `admin.invite`, `admin.invite.resend`, `admin.invite.revoke`. 파일 `admin-invite-actions.ts`, 대상 `admin_invites`.
- **관리자 계정** `admin.role.change`, `admin.delete`. 파일 `admin-actions.ts`, 대상 `profiles`.
- **관리자 역할** `admin.role.create`, `admin.role.update`, `admin.role.delete`. 파일 `admin-role-actions.ts`, 대상 `admin_roles`.

**남기지 않는 것**

- 인증 액션 전체(`signInAction`·`signOutAction`·`requestPasswordResetAction`·`setPasswordAction`·`establishSessionAction`) — 로그인 이력은 `audit_logs` 에 없다.
- 문의 작성 잠금의 정상 획득·하트비트(가로채기만 기록한다).
- 모든 조회.
