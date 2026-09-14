# 사이트 설정 — 배너 추가 · 수정 다이얼로그 (`HeroBannerDialog`)

**목적** 히어로 배너 한 장을 등록하거나 고친다. `banner` prop 이 `null` 이면 추가, 아니면 수정이며 숨은 `id` 하나로 서버 액션이 갈린다. 다이얼로그 설명: "이미지 또는 유튜브 영상과 노출 기간을 지정합니다. 기간을 비우면 항상 노출됩니다."

**데이터 출처** 목록이 이미 읽어 둔 `HeroBannerRecord` 를 그대로 프리필한다(추가 열기면 전부 빈 값 + `sortOrder = nextSortOrder`). 폼 본문은 `max-h-[60vh] overflow-y-auto`.

## 1.1 공통 필드

| 필드 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| id | hidden | — | `banner?.id ?? ''` | 빈 값이면 insert, 아니면 update |
| 제목 | 텍스트(`maxLength` 100) | **필수** 1~100자(`heroBannerFieldsSchema.title`). 오류 "제목을 입력해 주세요." | `banner.title` | `hero_banners.title`(DB `not null`). 힌트 "화면에는 표시되지 않습니다. 관리 목록 식별용이며 이미지 대체 텍스트·접근성 라벨로 쓰입니다." |
| 부제 | 텍스트(`maxLength` 200) | 선택 ≤200자, 빈 값은 `null` | `banner.subtitle` | `subtitle`. 힌트 "화면에는 표시되지 않습니다. 관리용 메모로만 남습니다." |
| 링크 | 텍스트(`maxLength` 500) | 선택. `optionalLinkSchema` — `/` 로 시작하거나 `http(s)://`. 오류 "http(s) 주소이거나 `/` 로 시작하는 경로여야 합니다." | `banner.linkUrl` | `link_url`. 힌트 "이미지 배너에서만 쓰입니다. 소개 화면 상단 이미지 전체가 이 주소로 이동합니다. 유튜브 배너는 재생만 합니다." |
| 버튼 문구 | 텍스트(`maxLength` 30) | 선택 ≤30자 | `banner.ctaLabel` | `cta_label`. 힌트 "현재 화면에는 표시되지 않습니다(관리용). 버튼이 필요해지면 그때 노출합니다." — **예비 필드** |
| 정렬 순서 | 텍스트(`inputMode="numeric"`) | 필수 형태 `^-?\d+$`(음수 허용). 오류 "정렬 순서는 정수로 입력해 주세요." | 수정: `banner.sortOrder` / 추가: `nextSortOrder`(목록 길이 = 맨 뒤) | `sort_order`. 오름차순이 노출 우선순위이고, 목록의 ↑↓ 버튼도 이 값을 0..n-1 로 다시 쓴다 |
| 노출 시작 | `datetime-local` | 선택. `kstLocalToIso` 로 변환(형식이 틀리면 `null` = 제한 없음) | `kstDateTimeLocal(banner.startsAt)` | `starts_at`. **KST 벽시계로 해석**한다 |
| 노출 종료 | `datetime-local` | 선택. 둘 다 값이 있으면 `startsAt < endsAt` 필수 — 오류는 `endsAt` 필드에 "종료 시각은 시작 시각보다 뒤여야 합니다."(DB `hero_banners_period` 와 같은 규칙을 zod 가 먼저 검사) | `kstDateTimeLocal(banner.endsAt)` | `ends_at`. 사용자 사이트 판정은 `ends_at > now` 라 **종료 시각 당시에는 이미 내려간다** |
| 노출 | 체크박스 | — (`isActive`: 체크 여부) | 수정: `banner.isActive` / 추가: **체크됨** | `is_active` |

## 1.2 미디어 유형 (`HeroBannerMediaFields`, `<fieldset>` legend `미디어 유형`)

**고르지 않은 쪽 입력은 마운트하지 않는다** — 숨기기만 하면 폼이 값을 계속 보내, 이미지로 되돌린 배너에 옛 영상 주소가 따라붙는다.

| 필드 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 이미지 / 유튜브 영상 | 라디오 2개(세그먼트 버튼, `HERO_MEDIA_TYPES`) | `heroMediaTypeSchema`: 빈 값이면 `image` 로 보정 후 `z.enum(['image','youtube'])`. 오류 "미디어 유형을 다시 선택해 주세요." | `banner.mediaType ?? 'image'` | `media_type`(DB 체크 `hero_banners_media_type`). 전환은 클라이언트 상태 — 저장 전에는 DB 를 건드리지 않는다 |
| 유튜브 주소 | 텍스트(`maxLength` 300, `required`) | **유튜브 유형일 때만 렌더 & 필수.** ≤300자("주소가 너무 깁니다."), `parseYoutubeId()` 가 id 를 못 뽑으면 오류 — 비었으면 "유튜브 주소를 입력해 주세요.", 값이 있으면 "유튜브 영상 주소를 알아볼 수 없습니다. 주소창의 값을 그대로 붙여 넣어 주세요." | `banner.videoUrl` | `video_url`. placeholder `https://www.youtube.com/watch?v=...`. 힌트 "watch?v= · youtu.be · shorts 주소 모두 가능. 소개 화면 상단 영상 영역에 썸네일과 재생 버튼으로 표시되고, 누르면 그 자리에서 재생됩니다." **이미지 유형으로 저장하면 `video_url` 은 `null` 로 지워진다**(유형만 되돌렸을 때 엉뚱한 영상이 되살아나지 않게) |
| 이미지 주소 / 대체 이미지 주소 | 텍스트(`maxLength` 500) | 두 유형 모두 렌더. **이미지 유형이면 필수** — 비면 `imageUrl` 오류 "이미지를 등록하거나 주소를 입력해 주세요."(DB `hero_banners_media_shape` 와 같은 규칙). 형식은 `/` 시작 또는 `http(s)://` | `banner.imageUrl` | `image_url`(빈 값은 `null`). 라벨·힌트가 유형에 따라 바뀐다 — 유튜브면 "대체 이미지 주소" + "재생 전 썸네일로 쓰입니다. 비우면 유튜브 기본 썸네일을 씁니다." |
| 이미지 파일 / 대체 이미지 파일 | 파일(`accept` png/jpeg/webp/gif/svg+xml) | MIME 이 `PUBLIC_ASSET_EXTENSIONS` 밖이면 `imageFile` 오류 "PNG · JPG · WEBP · GIF · SVG 만 올릴 수 있습니다." | 없음 | `public-assets/banners/<crypto.randomUUID()>.<ext>` 로 업로드(`upsert:false`) 후 **위 주소를 덮어쓴다.** 미디어 유형을 보기 전에 먼저 처리하므로 영상 배너의 포스터로도 쓸 수 있다. 실패 시 "이미지를 올리지 못했습니다. 파일 크기를 줄이거나 잠시 후 다시 시도해 주세요." |

## 1.3 저장 · 취소

| 컨트롤 | 종류 | 동작 |
|---|---|---|
| 취소 | 버튼(secondary) | 다이얼로그만 닫는다(입력 값은 다시 열면 프리필로 되돌아간다) |
| 저장 | 제출 버튼 | `saveHeroBannerAction`. 전송 중 `저장 중…` + 비활성. 성공 시 토스트 `배너를 저장했습니다.` + 다이얼로그 닫힘 |

**`saveHeroBannerAction` 처리 순서**
1. `requirePermission('settings','write')` → 2. 이미지 파일 업로드(있으면 `imageUrl` 덮어쓰기) → 3. `HERO_BANNER_TEXT_FIELDS` 9개 + `imageUrl` + `isActive` 로 `heroBannerSchema` 검증(기간 → 미디어 모양 순서로 refine) → 4. 수정이면 `before` 행 전체 조회 → 5. `insert` / `update(id)` → 6. 감사 `banner.create` 또는 `banner.update` → 7. `revalidatePath('/settings')` + `revalidateClient(['site'])`.

실패 문구: 필드 오류는 각 입력 아래, DB 실패는 폼 상단 배너 "배너를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."

**클라이언트와의 상호작용**

- 저장한 배너가 **노출 중 + 기간 안 + 그릴 수 있음**이고 `sort_order` 가 가장 앞이면, 태그 `site` 재검증 직후 `/about` 상단 영역이 이 배너로 바뀐다(선택 규칙은 [02-hero-banners.md](02-hero-banners.md)).
- 제목·부제·버튼 문구는 사용자 화면에 **표시되지 않는다**(제목은 이미지 `alt`/접근성 라벨로만 쓰인다). 힌트에 그 사실을 적어 "화면에 안 보인다"는 오조작을 막는다.
- 링크는 이미지 배너에서만 동작한다. 유튜브 배너는 그 자리에서 재생만 한다.
- `FEATURES.aboutDisabled` 기본값이 ON 이면 어느 배너도 사용자에게 보이지 않는다.

**오류·예외**

- 영상 배너에서 이미지 칸을 남겨 두는 이유는 포스터로 쓰기 위해서다. 유형을 오가도 입력해 둔 그림이 사라지지 않는다.
- `image_url` 은 원래 `not null` 이었다가 `20260909000100_hero_banner_media.sql` 에서 완화됐다. 대신 `hero_banners_media_shape` 가 "종류에 맞는 주소가 실제로 있는가"를 DB 에서 강제한다 — zod 를 우회한 직접 INSERT 도 막힌다.
- 정렬 순서를 직접 입력해 같은 값이 겹치면 `created_at` 오름차순이 순서를 정한다.
- 동시 편집 보호 없음 — 두 운영자가 같은 배너를 저장하면 나중 쪽이 이긴다.
