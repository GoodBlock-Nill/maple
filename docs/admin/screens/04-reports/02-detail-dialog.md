# 신고 상세 다이얼로그 (목록의 "처리" / "상세" 버튼)

**목적** 신고 내용·대상 전문·같은 대상의 신고 이력을 한 화면에서 확인하고, 조치(숨김·삭제·정지·조치 없음)와 종결을 **한 번의 액션**으로 처리하거나 사유를 적어 기각한다. 별도 라우트가 없고 목록 행에서 열린다.

**데이터 출처** 추가 요청이 없다. 목록(`getReports()`)이 이미 대상 전문(`target.content`), 대상 상태, 작성자, 원 게시글 제목, 같은 대상의 전체 신고 이력(`history`), 미처리 건수(`openCountForTarget`)를 함께 실어 두었다 — 판단에 필요한 정보가 한 화면에 있어야 운영자가 탭을 오가며 맥락을 잃지 않는다.

**열기 버튼**
| 조건 | 라벨 |
|---|---|
| `reports:write` 이고 `status === 'open'` | `처리` |
| 그 밖(읽기 전용 · 이미 종결된 신고) | `상세` |

**다이얼로그 헤더** 제목 `신고 상세`, 설명 `{게시글|댓글} · {사유 라벨} · {YYYY-MM-DD HH:mm}`. 본문 영역은 `max-h-[70vh]` 세로 스크롤.

## 1.1 대상 카드
| 필드/컨트롤 | 종류 | 값의 출처 | 표시 규칙 |
|---|---|---|---|
| 유형 뱃지 | `Badge`(accent) | `targetType` | 게시글/댓글. 목록과 달리 **여기서는 톤이 항상 accent** 다(아이콘 없음) |
| 대상 없음 | `Badge`(danger) | `target === null` | 대상을 못 찾았을 때 다른 뱃지 대신 표시 |
| 숨김 / 삭제 | `Badge`(warn / danger) | `target.isHidden` / `target.deletedAt` | 대상이 있을 때만 |
| 작성자 | 텍스트(muted) | `target.authorName` | `작성자 {닉네임}` |
| 제목 줄 | 굵은 텍스트 | 게시글이면 `target.excerpt`(=제목), 댓글이면 `게시글: {원 글 제목}` | 표시 이유·빈 경우(아래) |
| 본문 전문 | `whitespace-pre-wrap`, `max-h-40` 스크롤 | `target.content` | HTML/평문 구분·빈 경우(아래) |
| 원문 보기 | 링크 버튼(ghost sm, 새 탭) | `previewHref` | 목록과 같은 규칙(아래) |
| 작성자 보기 | 링크 버튼(ghost sm) | `authorHref` | `target.authorId` 가 `null`·빈 문자열이면 버튼 없음(탈퇴 계정). 있으면 `/members/{authorId}` |

**동작 상세**
- **제목 줄** — 게시글은 제목이 판단의 절반이고, 댓글은 어느 글에 달렸는지가 맥락이다. 원 글이 사라졌으면 `게시글: (삭제됨)`.
- **본문 전문** — 게시글은 **저장된 HTML 원문 그대로**(렌더하지 않는다 — 태그가 그대로 보인다), 댓글은 평문. 대상이 없으면 `대상을 찾을 수 없습니다(이미 완전히 삭제되었을 수 있습니다).`
- **원문 보기** — 목록과 같은 규칙 — 대상이 없거나 **삭제된 대상이면 버튼 자체가 없다** → [01-list.md §원문 링크 규칙](01-list.md#13-표).

## 1.2 신고 메타 (`<dl>`)
| 항목 | 값 | 비고 |
|---|---|---|
| 신고자 | `reporterNickname` | 프로필이 없으면 `(탈퇴)` |
| 사유 | `REPORT_REASON_LABEL[reason]` | |
| 상세 | `reports.detail` | `whitespace-pre-wrap`, 비어 있으면 `-` |
| 누적 신고 | `history.length` + `건` | 같은 대상의 **모든 상태** 신고 수 |

## 1.3 같은 대상의 신고 이력
`history.length > 1` 일 때만 보인다(제목 "같은 대상의 신고 이력"). 최신순 목록.

| 요소 | 값 |
|---|---|
| 좌측 | `{YYYY-MM-DD HH:mm} · {신고자 닉네임}` |
| 우측 | 사유 라벨 + 상태 뱃지 — `open` 이면 `미처리`(warn), 그 외에는 `처리 완료`/`기각`(neutral) |

## 1.4 처리 / 기각 탭
`reports:write` 일 때만 렌더된다. `aria-pressed` 로 선택 상태를 알리는 버튼 2개이고, **기본 선택은 "처리"** 다. 이미 종결된 신고에도 폼이 뜬다(재처리·상태 변경이 가능하다).

## 1.5 처리 폼 (`ReportResolveForm`)
조치와 종결을 한 액션으로 묶는다 — 숨김과 상태 변경을 따로 누르게 두면 둘 중 하나만 된 상태가 남고, 그 상태를 화면에서 구분할 방법이 없다.

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| `reportId` | hidden input | `resolveReportSchema.reportId = z.uuid('대상을 찾을 수 없습니다.')` | 현재 신고 id | — |
| 폼 배너 | `FormBanner` | — | 숨김 | `state.formError` |
| 조치: 대상 숨김 | 라디오 `name="action" value="hide"` | `z.enum(REPORT_ACTIONS)`, 실패 문구 "조치를 선택해 주세요." | **기본 선택** | 설명·액션(아래) |
| 조치: 대상 삭제 | 라디오 `value="delete"` | 〃 | — | 설명 "대상에 삭제 표시를 남깁니다. 복구할 수 있습니다." → `deleted_at = now()` |
| 조치: 작성자 정지 | 라디오 `value="suspend"` | 〃 | — | 설명·부가 UI(아래) |
| 조치: 조치 없이 처리 | 라디오 `value="none"` | 〃 | — | 설명 "기록만 남기고 대상은 그대로 둡니다." 조치 단계를 건너뛴다 |
| 정지 기간 | 라디오 `name="period"` 5개 (`1`·`3`·`7`·`30`·`permanent` / 라벨 1일·3일·7일·30일·영구) | `action === 'suspend'` 일 때 필수(`superRefine`) — 없으면 "정지 기간을 선택해 주세요." | **`3일`**(`defaultChecked={index === 1}`) | `suspensionUntil()` 계산 규칙(아래) |
| 정지 사유 | `Input` `name="suspensionReason"` | 필수·최대 200자(아래) | 빈 값, placeholder "예: 반복적인 욕설" | 사용자 노출 여부(아래) |
| 처리 메모 | `Textarea` `name="note"` rows=3 | 선택, 최대 500자(아래) | 빈 값, placeholder "판단 근거를 남겨 주세요." | 저장 위치·힌트 오차(아래) |
| 함께 처리 | 체크박스 `name="applyToTarget" value="1"` | `z.enum(['0','1'])`. 체크 안 하면 액션이 `'0'` 으로 읽는다 | **`openCountForTarget > 1` 일 때만 렌더되고 기본 체크됨** | 라벨·동작(아래) |
| 닫기 | 버튼(secondary) | — | — | 다이얼로그를 닫는다(제출하지 않는다) |
| 처리 완료 | submit 버튼 | — | — | `resolveReportAction` 실행(아래) |

**동작 상세**
- **조치: 대상 숨김** — 설명 "대상을 숨깁니다. 작성자에게도 보이지 않습니다." → `moderateTarget(table,id,'hide')` → `is_hidden = true`.
- **조치: 작성자 정지** — 설명 "작성자의 글·댓글·신고·좋아요 작성을 기간 동안 막습니다." 고르면 아래 "정지 설정" 묶음이 나타난다.
- **정지 기간** — `suspensionUntil()` → `now + N일`(영구는 `9999-12-31T00:00:00.000Z`). **"지금부터 N일"** 이다(자정 기준으로 끊으면 23:59 에 받은 1일 정지가 1분 만에 풀린다).
- **정지 사유(필수·제한)** — `action === 'suspend'` 일 때 필수 — 비면 "정지 사유를 입력해 주세요." 최대 `SUSPENSION_REASON_MAX = 200`자.
- **정지 사유(동작)** — **사용자 화면에 그대로 노출된다.** 힌트: "사용자 화면의 정지 안내 배너에 “사유: …” 로 그대로 붙습니다. 40자 이내를 권합니다." → `profiles.suspension_reason`.
- **처리 메모(필수·제한)** — 선택. 최대 `MODERATION_NOTE_MAX = 500`자("메모는 500자 이하로 입력해 주세요."). 빈 문자열은 `null` 로 변환. DB CHECK `reports_note_length (<= 500)`.
- **처리 메모(동작)** — `reports.note` + `audit_logs.after.note` 양쪽에 저장된다. **화면 힌트는 "감사 로그에만 저장됩니다(신고 테이블에 메모 컬럼이 없습니다)" 라고 적혀 있으나, `20260908002100` 이 `note` 컬럼을 추가한 뒤로는 신고 행에도 저장된다**(힌트·모듈 주석이 코드보다 뒤처져 있다).
- **함께 처리** — 라벨 `같은 대상의 미처리 신고 {n}건을 함께 처리`. 켜면 그 대상의 **`status='open'` 신고 전부**(현재 건 포함)가 한 번에 종결된다.
- **처리 완료** — `resolveReportAction`. 처리 중 라벨 `완료 처리 중…` + `disabled`. 성공 시 토스트 `"신고 {n}건을 처리했습니다."` + 다이얼로그 닫힘.

## 1.6 기각 폼 (`ReportDismissForm`)
| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| `reportId` | hidden input | `z.uuid()` | 현재 신고 id | — |
| 폼 배너 | `FormBanner` | — | 숨김 | `state.formError` |
| 기각 사유 | `Textarea` `name="note"` rows=3 `required` | **필수**(아래) | 빈 값, placeholder "예: 신고 사유에 해당하지 않는 정상 게시물" | 힌트·저장 위치(아래) |
| 함께 기각 | 체크박스 `name="applyToTarget" value="1"` | — | `openCountForTarget > 1` 일 때만, 기본 체크 | 라벨 `같은 대상의 미처리 신고 {n}건을 함께 기각` |
| 닫기 / 기각 | 버튼(secondary / danger submit) | — | — | `dismissReportAction`. 처리 중 `기각 중…`. 성공 토스트 `"신고 {n}건을 기각했습니다."` + 닫힘 |

**동작 상세**
- **기각 사유(필수·제한)** — `trim().max(500)` 후 `min(1, '사유를 입력해 주세요.')` — 근거 없이 닫힌 신고는 같은 대상이 다시 올라왔을 때 "지난번에 왜 넘겼는지"를 재구성할 수 없다.
- **기각 사유(동작)** — 힌트 "신고자·작성자에게는 보이지 않습니다. 감사 로그에만 남습니다." → `reports.note` + `audit_logs.after.note`.

## 1.7 서버 액션 계약
| 동작 | 액션 | 검증 | DB 변경 | 감사 로그 | 클라이언트 영향 |
|---|---|---|---|---|---|
| 처리(대상 숨김) | `resolveReportAction` → `moderateTarget('posts'\|'comments', id, 'hide')` | `resolveReportSchema` | DB 변경 상세(아래) | `community.{post\|comment}.hide` + `report.resolve` (**2행**) | 태그 `community-list` |
| 처리(대상 삭제) | 〃, 모드 `delete` | 〃 | `deleted_at = now()` + 위 `reports` 갱신 | `community.*.delete` + `report.resolve` | 태그 `community-list` |
| 처리(작성자 정지) | 〃 → `suspendMember(authorId, period, reason)` (`admin/lib/actions/members-actions.ts`) | 〃 + `superRefine`(기간·사유 필수) | `profiles.suspended_until`·`suspension_reason` + 위 `reports` 갱신 | `member.suspend` + `report.resolve` | 없음. 관리자 화면 `/members/{authorId}` 만 `revalidatePath` |
| 처리(조치 없음) | 〃, 조치 단계 생략 | 〃 | `reports` 갱신만 | `report.resolve` | 없음 |
| 기각 | `dismissReportAction` | `dismissReportSchema` | `reports` `status='dismissed'`·`note`·`resolved_by`·`resolved_at` | `report.dismiss` | 없음 |

**동작 상세**
- **처리(대상 숨김) DB 변경** — `posts`/`comments`.`is_hidden = true`, 그리고 `reports` `status='resolved'`·`note`·`resolved_by`·`resolved_at=now()`.

**실행 순서와 실패 처리**
1. `requirePermission('reports','write')` → zod 파싱 → `readReport(reportId)`(없으면 `formError` "신고를 찾을 수 없습니다.")
2. `applyReportAction()` — 조치를 **먼저** 실행한다. 실패하면 문구를 그대로 `formError` 로 돌려주고 **신고 상태를 바꾸지 않는다**(조치 없이 종결되는 것을 막는다).
3. 종결 대상 id 확정 — `applyToTarget` 이면 `openReportIdsForTarget()`(같은 `target_type`+`target_id` 의 `status='open'` 전부 + 현재 건, 중복 제거), 아니면 현재 건 하나.
4. `setReportStatus(ids, …)` — 실패하면 이미 적용된 조치를 **되돌리지 않고** 안내만 한다: "조치는 적용됐지만 신고 상태를 바꾸지 못했습니다. 목록에서 신고가 미처리로 남아 있는지 확인해 주세요."
5. 감사 로그 → `revalidatePath('/reports')`.

**정지 규칙**(회원 모듈과 공유, `suspendMember()`)
| 금지 조건 | 문구 |
|---|---|
| 자기 자신 | "자기 자신을 정지할 수는 없습니다." |
| 대상 회원 없음 | "회원을 찾을 수 없습니다." |
| 관리자 계정 | "관리자 계정은 정지할 수 없습니다. 먼저 관리자 권한을 회수해 주세요."(아래) |
| 개인정보 파기된 계정 | "개인정보가 파기된 계정입니다. 제재를 적용할 대상이 없습니다." |
| 작성자를 못 찾음(탈퇴·삭제) | "대상의 작성자를 찾을 수 없습니다(탈퇴했거나 삭제된 글입니다)."(아래) |
| 기간·사유 누락(스키마를 우회한 직접 POST) | "정지 기간과 사유가 필요합니다." |
| UPDATE 실패 | "회원을 정지하지 못했습니다. 정지는 적용되지 않았습니다. 잠시 후 다시 시도해 주세요." |

- **관리자 계정** — "관리자 계정은 정지할 수 없습니다. 먼저 관리자 권한을 회수해 주세요." (관리자에게는 `not is_suspended()` 를 보는 쓰기 정책이 없어 제재가 실효를 갖지 않는다.)
- **작성자를 못 찾음(탈퇴·삭제)** — "대상의 작성자를 찾을 수 없습니다(탈퇴했거나 삭제된 글입니다)." — `applyReportAction` 이 낸다.

**상태·뱃지 의미** → [README 의 상태 3종](README.md#상태-3종-report_statuses) · 이력 목록의 뱃지는 `open` 만 warn, 나머지는 neutral.

**클라이언트와의 상호작용**
- **대상 숨김·삭제만** 사용자 사이트를 바꾼다. `moderateTarget()` 이 `community-list` 태그를 태워 `/community` 목록에서 즉시 사라지고, 상세 `/community/[id]` 는 세션 조회라 이미 404 다. 숨긴 글의 댓글도 함께 보이지 않는다(`comments_select_public` 이 부모 글 상태를 본다). 숨김은 **작성자 본인에게도** 적용된다.
- **작성자 정지**는 캐시와 무관하다. 정지 여부는 로그인 세션에서 매 요청 확인한다. 사용자 화면에는 `describeSuspension()` 이 만든 한 줄이 붙는다: `정지된 계정입니다 (2026-09-11까지 · 사유: {정지 사유})`, 영구면 `(영구 정지 · 사유: …)`, 사유가 비어 있으면 기간만. 이 배너는 글쓰기·댓글·좋아요·**신고 접수** 폼에 뜨고 제출을 막는다(`SuspensionNotice`). DB 쪽에서도 `posts_insert_community`·`comments_insert_own`·`reports_insert_own`·`post_likes_insert_own` 정책의 `not public.is_suspended()` 가 막는다.
- **"조치 없이 처리"와 기각은 사용자 사이트에 아무 변화를 만들지 않는다.** 신고자에게 결과를 알리는 경로도 없다.
- 처리·기각 뒤에도 사용자는 자기 신고 행을 `reports_select_own` 으로 읽을 수 있지만, 화면이 그 목록을 그리지 않으므로 실질적으로 노출되지 않는다. `note`(처리 메모·기각 사유)는 컬럼 주석에 "사용자에게 노출하지 않는다"고 못 박혀 있고, 사용자 사이트 코드는 `reports` 를 읽지 않는다.

**오류·예외**
| 상황 | 결과 |
|---|---|
| 신고를 못 찾음 | `formError` "신고를 찾을 수 없습니다." |
| 조치 실패(대상 없음) | `moderateTarget()` 문구(아래) |
| 조치 실패(DB) | "게시글 처리를 하지 못했습니다…"(아래) |
| 상태 변경 실패 | 조치는 유지된 채 "조치는 적용됐지만 신고 상태를 바꾸지 못했습니다…" |
| 기각 실패 | "신고를 기각하지 못했습니다. 신고 상태는 그대로입니다. 다시 시도해 주세요." |
| 이미 종결된 신고 | 다시 제출하면 상태·메모·처리자·처리 시각이 **덮인다**(아래) |
| 삭제된 대상에 "대상 숨김" | 막지 않는다. `is_hidden = true` 가 추가로 서고 표시 상태는 그대로 `삭제`(삭제 우선) |
| 읽기 전용 관리자 | 처리·기각 탭이 렌더되지 않는다. 직접 POST 는 `requirePermission('reports','write')` 이 막는다 |
| 동시 처리 | 잠금·버전 검사가 없다. 두 운영자가 같은 신고를 처리하면 나중 쪽이 이긴다 |

- **조치 실패(대상 없음)** — `moderateTarget()` 이 "게시글을 찾을 수 없습니다." / "댓글을 찾을 수 없습니다." → 상태 변경 없음.
- **조치 실패(DB)** — "게시글 처리를 하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." → 상태 변경 없음.
- **이미 종결된 신고** — 다이얼로그는 열리고 write 권한자에게는 폼도 뜬다. 다시 제출하면 상태·메모·처리자·처리 시각이 **덮인다**(막지 않는다). `applyToTarget` 은 `open` 만 모으므로 이미 종결된 다른 건은 함께 바뀌지 않는다.
