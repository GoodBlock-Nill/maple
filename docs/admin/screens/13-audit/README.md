# 감사 로그 — 메뉴 개요

> 관리자 콘솔(`admin/`)의 감사 로그 메뉴. 화면 하나당 파일 하나이며, 각 파일은 `_TEMPLATE.md` 형식을 따른다.
> 작성 규칙: 코드에서 확인한 사실만 쓴다. 경로는 저장소 루트 기준. 워딩은 "카테고리".

## 0. 한눈에

| 항목 | 값 |
|---|---|
| 경로 | `/audit` (하위 라우트 없음. 상세는 표 안의 `<details>` 펼침) |
| 권한 모듈 | `audit` — `requirePermission('audit','read')` 하나. **쓰기 등급을 요구하는 컨트롤이 없다**(화면·액션 모두 읽기 전용) |
| 주요 테이블 | `audit_logs`(`actor_id`·`action`·`target_table`·`target_id text`·`before jsonb`·`after jsonb`·`created_at`). **INSERT/SELECT 정책만 있고 UPDATE/DELETE 정책 자체가 없다 — 추가 전용** |
| 클라이언트 영향 | 없음(사용자 사이트가 읽지 않는 관리자 전용 테이블이라 `revalidateClient()` 를 부르지 않는다) |
| 관련 파일 | 페이지 `admin/app/(admin)/audit/page.tsx` · 컴포넌트 `admin/components/audit/{AuditFilters,AuditTable,audit-labels,audit-diff}.tsx|ts` · 데이터 `admin/lib/data/audit.ts` · 기록 헬퍼 `admin/lib/audit.ts` · 마이그레이션 `supabase/migrations/20260908001700_admin_foundation.sql` §6 |

## 1. 화면 목록

| # | 문서 | 경로 | 한 줄 |
|---|---|---|---|
| 01 | [01-list.md](01-list.md) | `/audit` | 필터 6종 · 표 5열 · 50건 페이지네이션 |
| 02 | [02-detail-diff.md](02-detail-diff.md) | 표 행의 `<details>` | 변경 요약 · 변경 전/후 JSON · 라벨·마스킹 규칙 |

## 2. 메뉴 전체 규칙

- **기록 경로는 하나** 각 모듈의 서버 액션이 `writeAuditLog(actorId, entry)`(`admin/lib/audit.ts`)를 부른다. **세션 클라이언트로 insert** 하며 RLS `audit_logs_insert_admin` 이 `is_admin() and actor_id = auth.uid()` 를 강제하므로 **남의 이름으로 로그를 위조할 수 없다**(위조 불가능성이 DB 에서 보장된다).
- **기록 실패는 본 작업을 되돌리지 않는다.** `console.error('[audit] 기록 실패', action, message)` 만 남긴다 — 로그를 못 남겼다고 이미 끝난 제재를 취소하면 상태가 더 어긋난다. 즉 **감사 로그에 없는 조치가 존재할 수 있다.**
- **추가 전용** 테이블에 UPDATE/DELETE 정책이 없고 화면에도 수정·삭제 경로를 만들지 않는다. `authenticated` 롤에는 `select, insert` 만 grant 돼 있다.
- **`target_id` 는 uuid 가 아니라 text** — 대상이 uuid 인 테이블만 있는 게 아니다(`site_settings` 는 `'1'`, 랭킹 스냅샷은 `'total@2026-09-14T…'` 같은 복합 키).
- **행위자 표시** `actor_id` FK 가 `on delete set null` 이라 계정이 지워져도 로그 행은 남고 행위자만 `(삭제된 계정)` 이 된다.
- **`dynamic = 'force-dynamic'`**, 페이지 크기 `AUDIT_PAGE_SIZE` = 50.

## 3. 이 콘솔이 남기는 action 전체

| 영역 | action | 남기는 곳 | target_table |
|---|---|---|---|
| 뉴스 | `news.create` · `news.update` · `news.publish` · `news.hide` · `news.unhide` · `news.delete` · `news.restore` | `news-actions.ts` | `posts` |
| 뉴스 템플릿 | `news_template.update` · `news_template.reset` | `news-template-actions.ts` | `news_category_templates` |
| 커뮤니티 | 게시글·댓글 숨김/삭제/복구 | `community-*-actions.ts` | `posts` · `comments` |
| 신고 | 처리·기각 | `reports-actions.ts` | `reports` |
| 회원 | `member.suspend` · `member.unsuspend` · `member.withdraw` · `member.restore` · `member.purge` · `member.force_withdraw` 등 | `members-*-actions.ts` | `profiles` |
| 쿠폰 | `coupon.create` · `coupon.update` · `coupon.activate` · `coupon.deactivate` · `coupon.delete` · `coupon_redemption.status` | `coupon*-actions.ts` | `coupons` · `coupon_redemptions` |
| 문의 | `inquiry.status` · `inquiry.reply` · `inquiry.email.reply` · `inquiry.email.resend` · `inquiry.assign` · `inquiry.unassign` · `inquiry.edit_lock` · `inquiry_note.create` · `inquiry_note.delete` | `inquir*-actions.ts` | `inquiries` · `inquiry_notes` |
| FAQ | `faq.create` · `faq.update` · `faq.delete` · `faq.publish` · `faq.reorder` | `faqs-actions.ts` | `faqs` |
| 가이드 | `gacha.create` · `gacha.update` · `gacha.delete` | `gacha-actions.ts` | `gacha_items` |
| 랭킹 | `rankings.snapshot.rollback` | `rankings-actions.ts` | `rankings` |
| 사이트 설정 | `settings.update` · `banner.create` · `banner.update` · `banner.delete` · `banner.toggle` · `banner.reorder` | `settings-actions.ts` | `site_settings` · `hero_banners` |
| 약관 | `legal.create` · `legal.update` · `legal.publish` · `legal.delete_draft` | `legal-actions.ts` | `legal_document_versions` |
| 관리자 | `admin.invite` · `admin.invite.resend` · `admin.invite.revoke` · `admin.role.change` · `admin.delete` · `admin.role.create` · `admin.role.update` · `admin.role.delete` | `admin-*-actions.ts` | `admin_invites` · `profiles` · `admin_roles` |

**남기지 않는 것**: 인증 액션 전체(`signInAction`·`signOutAction`·`requestPasswordResetAction`·`setPasswordAction`·`establishSessionAction`) — 로그인 이력은 `audit_logs` 에 없다. 문의 작성 잠금의 정상 획득·하트비트(가로채기만 기록). 모든 조회.
