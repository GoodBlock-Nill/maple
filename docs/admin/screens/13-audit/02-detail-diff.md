# 감사 로그 — 변경 요약 · 상세 펼침 (`/audit` 표 안 `<details>`)

**목적** 로그 한 건의 `before`/`after` 를 사람이 읽는 형태로 보여 준다. 요약은 표 한 칸에, 전체 JSON 은 펼친 영역에 그린다. 별도 상세 라우트는 없다.

**데이터 출처** 목록 조회가 이미 실어 온 `before`·`after`(jsonb)뿐이다. 추가 조회는 하지 않으며 표시 규칙은 순수 함수 `admin/components/audit/audit-diff.ts` 와 `audit-labels.ts` 가 소유한다. 조회 계층은 `server-only` 라 단위 테스트에서 import 조차 되지 않아 화면 옆에 두고 테스트한다.

## 1.1 펼침 컨트롤

| 필드/컨트롤 | 종류 | 값의 출처 | 표시 규칙 |
|---|---|---|---|
| 요약 줄 | `<summary>` | `summarizeAuditDiff()` | 접힘 상태에 `자세히` |
| 변경 전 | `<pre>` 블록 | `formatAuditJson(before)` | 2열 중 왼쪽 |
| 변경 후 | `<pre>` 블록 | `formatAuditJson(after)` | 2열 중 오른쪽 |

**동작 상세**

- **요약 줄** 커서는 포인터이고 접힌 상태에서만 회색 `자세히` 가 보인다.
- **요약 줄** `<details>` 를 쓰는 이유는 상태를 클라이언트로 내리지 않아도 되고, 자바스크립트 없이 동작하며, 스크린 리더가 열림/닫힘을 그대로 읽기 때문이다.
- **변경 전·후** 마스킹 후 `JSON.stringify(…, null, 2)` 로 들여쓴다. 값이 `null` 이면 `-` 다.
- **변경 전·후** 블록은 `max-h-72` 스크롤에 `whitespace-pre-wrap` 이다.
- **펼침 상태** 행마다 독립이고 URL 에 남지 않는다(공유·새로고침 시 다시 접힌다).

## 1.2 변경 요약 규칙 (`summarizeAuditDiff` → `diffAuditRecords`)

| 단계 | 규칙 |
|---|---|
| 1. 마스킹 | `redactSensitive()` 로 먼저 깎는다 |
| 2. 객체화 | 객체가 아닌 값은 `null` 취급 |
| 3. 키 합집합 | 한쪽만 객체면 그쪽 키를 전부 변화로 본다 |
| 4. 값 축약 | 40자 초과 시 `…` 로 자른다 |
| 5. 변화만 | 축약값이 다른 키만 남긴다 |
| 6. 표기 | 최대 3개 + `외 {N}건` |

**동작 상세**

- **2. 객체화** 배열·스칼라는 객체가 아니므로 제외되고, 양쪽 다 객체가 아니면 요약은 `-` 다.
- **3. 키 합집합** 생성·삭제 로그는 한쪽이 통째로 비어 있다. "무엇이 생겼는가"가 그 로그의 내용이다.
- **4. 값 축약** 객체는 `{…}`, 배열은 `[N건]`, 그 외는 문자열로 바꾼다. 상한 상수는 `MAX_VALUE_LENGTH`(40)다.
- **6. 표기** 상한 상수는 `MAX_SUMMARY_KEYS`(3)이고 나머지는 건수로 줄인다.

**한 항목의 모양**

| 경우 | 표기 |
|---|---|
| before 가 없음(생성) | `{필드}: {after}` |
| after 가 없음(삭제) | `{필드}: {before} → (없음)` |
| 둘 다 있음(수정) | `{필드}: {before} → {after}` |

**필드 이름 표기**(`auditFieldLabel` → `FIELD_LABELS`)

| 키 | 표기 | 키 | 표기 |
|---|---|---|---|
| `kind` | 종류 | `sort_order` | 순서 |
| `key` | 식별자 | `is_active` | 노출 |
| `label` · `name` | 이름 | `ids` | 순서(id) |
| `description` | 설명 | `subtypes` | 세부 유형 |
| `prefill` | 프리필 | `relabelled_inquiries` | 함께 옮긴 문의 수 |

- **표에 없는 키** DB 컬럼명을 원문 그대로 둔다. 모든 모듈의 필드를 미리 적어 둘 수 없고, 잘못 번역하는 것보다 원문이 낫다.
- **영향** 가이드·설정·약관의 컬럼(`probability`·`ip_notice`·`effectiveDate` 등)은 표에 없어 원문 컬럼명으로 보인다.

## 1.3 민감 정보 마스킹 (`redactSensitive`)

| 항목 | 내용 |
|---|---|
| 판정 기준 | 키 이름 정규식 |
| 치환 값 | `REDACTED = '***'` |
| 적용 범위 | 재귀(중첩 객체·배열 포함) |
| 적용 지점 | 요약과 펼침 JSON 둘 다 |
| 한계 | DB 저장 값은 마스킹되지 않는다 |

**동작 상세**

- **판정 기준** 정규식은 `/pass(word)?|token|secret|api[-_]?key/i` 다.
- **판정 기준** 값으로 판단하려 들면(예: JWT 처럼 생긴 문자열) 새 형식이 생길 때마다 규칙이 새고, 한 번 새면 로그에 영구히 남는다.
- **치환 값** 값 자체를 통째로 바꾼다. 길이도 앞자리도 남기지 않는다.
- **적용 지점** `diffAuditRecords` 와 `formatAuditJson` 이 각각 거치므로 화면에 나가는 모든 경로가 마스킹된다.
- **한계** 화면 표시 규칙일 뿐이라 액션이 비밀번호류를 `before`/`after` 에 담으면 원문이 `audit_logs` 에 남는다. 현재 인증 액션은 감사 로그를 남기지 않는다(→ [README](README.md) §3).

## 1.4 행동(action) 라벨 조합 규칙 (`auditActionLabel`)

`action` 은 모듈마다 자유롭게 늘어나므로 고정 표 대신 영역 + (중간 마디) + 동작으로 조합한다.

| 단계 | 규칙 |
|---|---|
| 1 | `ACTION_LABELS` 예외에 있으면 그 값을 쓴다 |
| 2 | `.` 으로 쪼개 각 마디를 라벨로 옮긴다 |
| 3 | 못 찾으면 `action` 원문을 그대로 보여 준다 |

- **2단계** 첫 마디는 `DOMAIN_LABELS`, 마지막 마디는 `VERB_LABELS`(없으면 `SEGMENT_LABELS`), 중간 마디는 `SEGMENT_LABELS`(없으면 원문)다.
- **3단계** 잘못 번역하는 것보다 원문이 낫다는 원칙이다.

**영역(`DOMAIN_LABELS`)**

| 키 | 표기 | 키 | 표기 |
|---|---|---|---|
| `gacha` | 확률형 아이템 | `inquiry` | 홈페이지 문의 |
| `rankings` · `ranking` | 랭킹 | `inquiry_note` | 문의 내부 메모 |
| `settings` | 사이트 설정 | `inquiry_category` | 문의 카테고리 |
| `banner` | 히어로 배너 | `inquiry_reply_template` | 답변 템플릿 |
| `admin` | 관리자 | `coupon` | 쿠폰 |
| `member` · `profile` | 회원 | `coupon_redemption` | 쿠폰 등록 |
| `news` | 뉴스 | `faq` | FAQ |
| `news_template` | 뉴스 카테고리 템플릿 | `report` | 신고 |
| `post` | 게시글 | `legal` | 약관 |
| `comment` | 댓글 | — | — |

**동작(`VERB_LABELS`)**

| 키 | 표기 | 키 | 표기 |
|---|---|---|---|
| `create` | 등록 | `resolve` | 처리 |
| `update` | 수정 | `dismiss` | 기각 |
| `delete` | 삭제 | `suspend` | 정지 |
| `import` | CSV 적용 | `unsuspend` | 정지 해제 |
| `export` | 내보내기 | `invite` | 초대 |
| `apply` | 적용 | `assign` | 담당자 배정 |
| `rollback` | 되돌리기 | `unassign` | 담당자 배정 해제 |
| `toggle` | 노출 전환 | `edit_lock` | 작성 잠금 가로채기 |
| `reorder` | 순서 변경 | `revoke` | 권한 회수 |
| `publish` | 발행 | `rename` | 닉네임 변경 |
| `unpublish` | 발행 취소 | `activate` | 활성화 |
| `hide` | 숨김 | `deactivate` | 비활성화 |
| `restore` | 복구 | `status` | 상태 변경 |
| `answer` · `reply` | 답변 | `reset` | 기본값 복원 |
| `resend` | 재발송 | — | — |

**중간 마디(`SEGMENT_LABELS`)**

| 키 | 표기 |
|---|---|
| `snapshot` | 스냅샷 |
| `promote_existing` | 기존 계정 승격 |
| `email` | 이메일 |

**조합 예시**

- `rankings.snapshot.rollback` → 랭킹 스냅샷 되돌리기
- `admin.invite.resend` → 관리자 초대 재발송
- `legal.publish` → 약관 발행

**예외 표(`ACTION_LABELS`)** 조합으로는 뜻이 갈리는 것들이다.

| action | 라벨 |
|---|---|
| `member.withdraw` | 회원 탈퇴(본인) |
| `member.restore` | 탈퇴 복구(본인) |
| `member.purge` | 개인정보 파기 |
| `member.force_withdraw` | 강제 탈퇴 |
| `coupon.create` | 쿠폰 생성 |
| `coupon_redemption.status` | 쿠폰 등록 처리 |

**예외 상세**

- **`member.withdraw`·`member.restore`** 행위자가 관리자가 아니라 본인이다. 관리자 조치(강제 탈퇴)와 구분해야 한다.
- **`coupon.create`** 조합하면 `coupon_redemption.*`(쿠폰 등록 …)과 같은 말이 되어 목록에서 구분되지 않는다.

## 1.5 대상 테이블 표기 (`auditTableLabel` → `TABLE_LABELS`)

| 테이블 | 표기 | 테이블 | 표기 |
|---|---|---|---|
| `gacha_items` | 확률형 아이템 | `inquiry_replies` | 문의 답변 |
| `rankings` | 랭킹 | `inquiry_notes` | 문의 내부 메모 |
| `site_settings` | 사이트 설정 | `inquiry_reply_templates` | 답변 템플릿 |
| `hero_banners` | 히어로 배너 | `coupons` | 쿠폰 |
| `profiles` | 회원 | `coupon_redemptions` | 쿠폰 등록 |
| `posts` | 게시글 | `faqs` | FAQ |
| `comments` | 댓글 | `reports` | 신고 |
| `inquiries` | 홈페이지 문의 | `admin_invites` | 관리자 초대 |
| `legal_documents` | 약관 | `news_category_templates` | 뉴스 카테고리 템플릿 |

- 표에 없으면 원문을 그대로 쓰고, `null` 이면 `-` 를 그린다.

**클라이언트와의 상호작용** 없다.

**오류·예외**

- `news.unhide` 는 `VERB_LABELS` 에 `unhide` 매핑이 없어 라벨 대신 `news.unhide` 원문이 그대로 보인다(3단계 폴백).
- `legal_document_versions` 는 `TABLE_LABELS` 에도 `auditTargetHref` 에도 없다. 약관 로그는 대상이 원문 테이블명과 링크 없는 ID 로 보인다.
- 액션마다 `before`/`after` 에 담는 모양이 다르다. 전체 행(`select('*')`)을 담는 것(가이드·배너·설정), 요약 스냅샷만 담는 것(약관·관리자), 한 컬럼만 담는 것(배너 노출 토글)이 섞여 있어 요약 칸의 상세도가 균일하지 않다.
- 생성 로그는 `before` 가 `null` 이라 모든 키가 "새로 생긴 값"으로 나열된다.
- 삭제 로그는 `after` 가 `null` 이라 전부 `→ (없음)` 이 된다.
