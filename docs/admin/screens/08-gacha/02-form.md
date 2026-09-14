# 가이드 — 등록 · 수정 폼 (`/gacha/new`, `/gacha/[id]`)

**목적** 확률형 아이템 공시 한 건을 만들거나 고친다. 두 경로가 같은 컴포넌트(`GachaForm`)를 쓰고, 숨은 `id` 값 하나로 생성/수정이 갈린다(빈 값이면 생성). 필드를 나누면 한쪽에만 필드를 추가하는 사고가 반드시 나기 때문에 일부러 한 컴포넌트다.

**데이터 출처**
- `/gacha/new` — 읽는 행이 없다. `requirePermission('gacha','write')` 후 `?tab=` 을 기본 탭으로, 게시일 기본값은 `kstDateTimeLocal(new Date().toISOString())`(지금, KST).
- `/gacha/[id]` — `getGachaItem(id)`(`maybeSingle`). 없거나 조회 실패면 `notFound()` → 404. 헤더는 `title = item.name`, `description = "${gachaTabLabel(item.tab)} · 최종 수정 ${formatDateTime(item.updatedAt)}"`.
- 두 화면 모두 `dynamic = 'force-dynamic'`.

## 1.1 기본 정보 (2열 그리드)

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 탭 | 셀렉트(`GACHA_TABS` 3개) | 필수. `gachaTabSchema = z.enum(['premium','cube','scroll'])`, DB enum `gacha_tab` | 수정: `item.tab` / 등록: `?tab=` 또는 `premium` | `gacha_items.tab`. 저장 후 이 탭의 목록(`/gacha?tab=…`)으로 이동한다. 사용자 사이트 `/guide` 의 같은 이름 칩과 1:1 |
| 이름 | 텍스트 입력(제어) | 필수 1~120자(`gachaItemSchema.name`, `GACHA_ITEM_NAME_MAX`). 오류: "이름을 입력해 주세요." / "이름은 120자를 넘을 수 없습니다." | `item.name` 또는 빈 값 | `gacha_items.name`. 미리보기 카드 제목에 즉시 반영. 힌트: 카드에 두 줄까지(PC 약 14자·폰 약 17자/줄 → 28자 안쪽 권장). placeholder `프리미엄 부화기 12차` |
| 대표 확률 (%) | 텍스트 입력(`inputMode="decimal"`, `maxLength=7`) | 필수. `probabilitySchema`: 공백 제거 → `^\d+(\.\d+)?$` → 소수 3자리 이하 → 0~100. DB `gacha_items_probability_range` + `numeric(6,3)`. 오류: "확률을 입력해 주세요." / "확률은 숫자로 입력해 주세요. (예: 1.234)" / "확률은 소수점 3자리까지 입력할 수 있습니다." / "확률은 0 이상 100 이하여야 합니다." | 수정: `probability.toFixed(3)` / 등록: `0` | `gacha_items.probability`. `z.coerce.number()` 를 쓰지 않는다 — 빈 문자열이 0 으로, `1e3` 이 1000 으로 조용히 바뀌는 것을 막기 위해 표기부터 검사한다. 사용자 사이트 카드에는 둘째 자리로 반올림돼 보인다 |
| 게시일 | `datetime-local` | 선택. 형식 오류는 `kstLocalToIso` 가 `null` 로 흘리고 저장 시각으로 대체된다(반려하지 않음) | 수정: `kstDateTimeLocal(item.publishedAt)` / 등록: 지금(KST) | `published_at = kstLocalToIso(입력) ?? new Date().toISOString()`. **입력은 KST 벽시계로 해석**한다(서버가 UTC 배포여도 9시간 밀리지 않는다). 사용자 사이트 카드의 "갱신일"이자 기본 정렬(최신순) 기준 |
| 아이콘 주소 | 텍스트 입력(제어) | 선택. `assetPathSchema`: ≤500자(`URL_MAX_LENGTH`) + `''` 이거나 `/` 로 시작하거나 `http(s)://`. 오류: "http(s) URL 이거나 `/` 로 시작하는 경로여야 합니다." | `item.iconUrl` | `icon_url`(빈 값이면 `null`). 비우면 사용자 사이트는 **확률표 첫 행 아이콘 → 그것도 없으면 `/images/guide/icon-item-1.png`** 순으로 대신 쓴다(`toGachaItem`) |
| 아이콘 파일 | 파일 입력 | 선택. `accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"`. 서버는 MIME 을 `PUBLIC_ASSET_EXTENSIONS` 로 검사 — 밖이면 "PNG · JPG · WEBP · GIF · SVG 만 올릴 수 있습니다." | 없음 | 파일이 있으면 **위 주소를 덮어쓴다.** `public-assets` 버킷에 `gacha/<crypto.randomUUID()>.<ext>` 로 업로드(세션 클라이언트 → Storage 정책이 다시 검사, `upsert:false`). 경로에 매번 UUID 를 쓰는 이유는 같은 파일명이 이미 공시된 다른 아이템의 아이콘을 조용히 덮어쓰는 사고를 막기 위함. 실패 시 `iconFile` 필드 오류 "아이콘을 올리지 못했습니다. 파일 크기를 줄이거나 잠시 후 다시 시도해 주세요." |
| 사용자 사이트에 공개 | 체크박스 | — (`isPublished: z.boolean()`, 체크 여부로 판정) | 수정: `item.isPublished` / 등록: **체크됨** | `is_published`. 해제하면 사용자 사이트 질의에서 빠진다(삭제 대신 쓰는 되돌릴 수 있는 수단) |
| id | hidden | — | 수정: `item.id` / 등록: `''` | 서버 액션의 생성/수정 분기 기준 |
| rows | hidden | 아래 확률표 편집기의 상태를 `JSON.stringify` 한 값 | `item.rows ?? []` | `gachaRowsJsonSchema` 가 파싱 → `gachaRowsSchema` 검증 |

## 1.2 확률표 편집기 (`GachaRowsEditor`)

머리글 `확률표 (N행)` + 안내 "아이템명·비고는 상세 모달 표에서 한 칸에 약 8~15자마다 줄이 바뀝니다." 값은 **상위 폼 상태**가 들고 hidden JSON 하나로 전송된다(`rows[0][grade]` 식 이름 규칙은 중간 행을 지우는 순간 인덱스가 어긋나므로 쓰지 않는다).

| 필드/컨트롤 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 행 추가 | 버튼 | — | — | `EMPTY_ROW`(`grade:'A'`, `itemName:''`, `itemIcon:''`, `probability:'0'`, `note:'-'`)를 맨 뒤에 추가 |
| 등급 | 셀렉트(`GACHA_GRADES` = SS·S·A·B·C) | `z.enum(GACHA_GRADES)`. 목록 밖 값은 `toGrade` 가 `A` 로 되돌린다 | `A` | 사용자 사이트 표의 `[X등급]` 칸. 색: SS `#ac75e6` · S `#ee473f` · A `#ee9513` · B `#3b82f6` · C `#727272`(`GACHA_GRADE_CLASS` 와 미리보기가 같은 리터럴) |
| 아이템명 | 텍스트(`maxLength` 100) | 필수 1~100자(`GACHA_ROW_ITEM_NAME_MAX`). 오류: "아이템 이름을 입력해 주세요." | 빈 값 | 표의 "획득 아이템명". 셀 아래 `현재/100` 표시, 상한 도달 시 빨간 굵게 |
| 아이콘 주소 | 텍스트(`maxLength` 500) | `assetPathSchema` 와 같은 규칙 | 빈 값 | 표 아이템명 앞 24px 아이콘. 비면 아이콘 없이 이름만 |
| 확률 | 텍스트(`inputMode="decimal"`, `maxLength` 7) | `^\d+(\.\d+)?$` 만 검사(범위·소수 자릿수 제한 없음). 오류: "확률표의 확률은 숫자여야 합니다." | `0` | **문자열 그대로 보관**한다 — 사용자 사이트가 `0.05` 를 입력한 그대로 그린다. 반올림하지 않는다 |
| 비고 | 텍스트(`maxLength` 200) | ≤200자(`GACHA_ROW_NOTE_MAX`), 비면 `'-'`(`.default('-')`) | `-` | 표 마지막 칸 |
| 삭제 | 버튼(행마다) | — | — | 그 행만 제거(확인 다이얼로그 없음, 저장 전이라 되돌릴 수 있다) |
| (빈 상태) | 안내 문구 | — | — | 행이 0개면 "확률표가 비어 있습니다. 필요하면 행을 추가해 주세요." — **확률표 없이도 저장된다** |

**합계 규칙 없음** 행 확률의 합을 검사하는 코드는 관리자·DB 어디에도 없다. 100% 를 넘거나 못 미쳐도 저장·공시된다.

## 1.3 사용자 사이트 미리보기 (`GachaPreview`)

저장 전 값으로 사용자 사이트 `components/guide/GachaItemCard.tsx` · `GachaGradeTable.tsx` 의 결과를 재현한다(원본이 바뀌면 함께 고쳐야 하는 사본).

| 영역 | 표시 | 규칙 |
|---|---|---|
| 카드 아이콘 | 아이콘 주소 → 없으면 확률표 첫 행 아이콘 | `siteAssetSrc()` 로 사용자 사이트 정적 경로를 보정 |
| 카드 확률 | `숫자.toFixed(2)%` | 숫자가 아니거나 비어 있으면 `-%`. DB 는 셋째 자리까지 보관하므로 `1.234` → 카드엔 `1.23%` |
| 카드 제목 | 이름(비면 `(이름 없음)`) | 2줄 말줄임(`line-clamp-2`) |
| 갱신일 | 게시일의 `YYYY-MM-DD` 부분 | 입력값 앞 10자를 그대로 자른 값 |
| 상세 표 | 등급 · 획득 아이템명 · 확률(%) · 비고 4열 | 행이 없으면 "확률표가 비어 있습니다." |

## 1.4 저장 · 취소

| 컨트롤 | 종류 | 필수·제한 | 동작 / 상호작용 |
|---|---|---|---|
| 취소 | 버튼(링크) | — | `/gacha` 로 이동(작성 중 내용 경고 없음) |
| 저장 | 제출 버튼 | write 권한. 전송 중 `저장 중…` 으로 바뀌고 비활성화 | `saveGachaItemAction`(`admin/lib/actions/gacha-actions.ts`) |

**`saveGachaItemAction` 처리 순서**
1. `requirePermission('gacha','write')` → 2. 아이콘 파일 업로드(있으면 `iconUrl` 덮어쓰기) → 3. `gachaRowsJsonSchema` 로 확률표 파싱 → 4. `gachaItemSchema` 전체 검증 → 5. 수정이면 `before` 행 전체 조회 → 6. `insert` / `update(id)` → 7. 감사 로그 → 8. 재검증 → 9. `redirect('/gacha?tab=<tab>')`.

| 결과 | 화면 |
|---|---|
| 성공 | 목록으로 이동(토스트 없음 — `redirect` 가 흐름을 끊는다) |
| 확률표 파싱 실패 | 폼 상단 배너 "확률표에 잘못된 값이 있습니다. 등급·아이템명·확률을 확인해 주세요." (어느 행인지는 알려 주지 않는다) |
| 필드 검증 실패 | 각 입력 아래 zod 메시지(`toFieldErrors` — 필드당 첫 오류 하나만) |
| DB 실패 | 배너 "확률형 아이템을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." + 서버 로그 `[gacha] …` |

**감사 로그**

| 경우 | action | target | before / after |
|---|---|---|---|
| 등록(`id` 빈 값) | `gacha.create` | `gacha_items` / 새 id | after = 저장 payload |
| 수정 | `gacha.update` | `gacha_items` / `id` | before = 수정 전 행 전체(`select('*')`), after = payload |

**클라이언트와의 상호작용**

- 저장 성공 즉시 `revalidatePath('/gacha')` + 태그 `gacha` 재검증 → 공개 상태면 사용자 사이트 `/guide` 목록·상세 모달(`?item=<id>`)에 바로 반영된다. 확률 공시는 법적 고지라 캐시가 늦게 비워지지 않도록 저장 직후에 태운다.
- 사용자 사이트 상세 모달은 같은 `rows` 를 4열 표로 그린다. 단 `lib/constants/guide.ts` 의 `gachaDetailIcon()` 이 **이름이 일치하는 목업 항목**(예: `[캐시] 전설의 펫 랜덤 상자`)에 한해 시안 전용 아이콘으로 바꿔 그린다 — 그 이름을 쓰면 여기서 지정한 아이콘이 상세 표에서 무시된다(코드 주석의 TODO: 아이템별 아이콘이 DB 에 들어오면 제거).
- `FEATURES.guideOpen` 이 꺼져 있으면 저장 결과가 사용자 사이트에 전혀 보이지 않는다(플래그 우선, → [README](README.md) §2).

**오류·예외**

- 존재하지 않는 `/gacha/[id]` 는 404(`notFound()`). 수정 화면을 열어 둔 사이 다른 운영자가 삭제하면 저장은 `update … .single()` 이 행을 못 찾아 실패하고 위 DB 실패 문구가 뜬다(낙관적 잠금은 없다 — 동시에 같은 아이템을 고치면 **나중에 저장한 값이 이긴다**).
- 아이콘 파일과 아이콘 주소를 함께 넣으면 **파일이 이긴다**(업로드 URL 로 덮어씀).
- SVG 도 허용 목록에 있다(`public-assets` 버킷 `allowed_mime_types` 와 같은 목록). 외부에서 받은 SVG 는 스크립트를 품을 수 있으므로 신뢰 가능한 파일만 올린다.
- 폼은 `noValidate` 라 브라우저 기본 말풍선 대신 서버 zod 메시지만 보여 준다 — 필수 항목을 비우고 저장하면 왕복 한 번이 돈다.
