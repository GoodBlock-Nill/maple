# 사이트 설정 — 히어로 배너 목록 (`/settings` 히어로 배너 카드)

**목적** 사용자 사이트 **소개 화면(`/about`) 상단 영상 영역**에 걸 배너를 관리한다. 노출 중인 배너 중 **첫 장 한 개만** 실제로 걸리므로, 이 목록의 순서가 곧 "무엇이 보이는가"다(아직 슬라이더는 없다 — 두 번째부터는 대기 상태).

**데이터 출처** `getHeroBanners()`(`admin/lib/data/settings.ts`) — `hero_banners` 전체를 `order('sort_order', asc).order('created_at', asc)` 로 읽는다(정렬값이 같아도 목록이 흔들리지 않게 만든 순으로 고정). 관리자에게는 **예약·종료·숨김 배너까지 전부** 보인다(RLS `hero_banners_admin_all`). 실패 시 `console.error('[settings] 배너 조회 실패')` + 빈 배열.
`video_url` 은 읽는 시점에 `parseYoutubeId()` 로 영상 id 를 뽑아 `youtubeId` 에 담는다(알아볼 수 없는 주소면 `null`).

## 1.1 카드 머리

| 필드/컨트롤 | 종류 | 값 | 동작 / 상호작용 |
|---|---|---|---|
| 제목 | 텍스트 + 뱃지 | `히어로 배너` + `사이트 반영`(success) | — |
| 설명 | 고정 문구 | "소개 화면(/about) 상단 영상 영역에 노출 중인 첫 번째 배너 한 장이 걸립니다. 배너가 없으면 위 기본 정보의 유튜브 주소 영상이 나옵니다. 저장 즉시 사용자 사이트에 반영됩니다." | — |
| 배너 추가 | 버튼(헤더 action) | write 권한 **且 배너가 1개 이상**일 때만 헤더에 뜬다 | 다이얼로그를 연다(`nextSortOrder = banners.length`) → [03-banner-dialog.md](03-banner-dialog.md) |

## 1.2 빈 상태 (`EmptyState`)

| 요소 | 내용 |
|---|---|
| 제목 | `등록된 배너가 없습니다.` |
| 설명 | "이미지 한 장 또는 유튜브 영상을 등록할 수 있습니다. 맨 위의 노출 중인 배너가 소개 화면 상단(영상 영역)에 걸립니다. 없으면 사이트 설정의 유튜브 영상이 나옵니다." |
| 액션 | write 권한자에게만 `배너 추가`(`nextSortOrder = 0`) |

## 1.3 목록 행 (`HeroBannerList`)

| 필드/컨트롤 | 종류 | 값의 출처 | 동작 / 상호작용 |
|---|---|---|---|
| 썸네일 | 이미지 80×48(`BannerThumb`) | 유튜브 배너면 `youtubeThumbnailUrl(youtubeId)`, 그 외(또는 id 파싱 실패)는 `siteAssetSrc(image_url)` | 주소가 비면 회색 자리 상자. 유튜브 배너에는 좌하단에 `영상` 뱃지(accent) |
| 제목 | 텍스트(굵게) | `title` | 화면에는 안 나가는 관리용 이름(→ 다이얼로그 힌트) |
| 노출 / 숨김 | 뱃지 | `is_active` | `true` → success `노출`, `false` → neutral `숨김` |
| 부제 | 텍스트(작게) | `subtitle` | `null` 이면 줄 자체가 없다 |
| 기간 | 텍스트(작게) | `starts_at` ~ `ends_at` | 각각 `null` 이면 `제한 없음`. `formatDateTime`(KST) |
| ↑ | 버튼(`BannerActionButton`) | — | `moveHeroBannerAction(direction='up')`. **첫 행에서 비활성**. `aria-label="{제목} 위로"` |
| ↓ | 버튼 | — | `moveHeroBannerAction(direction='down')`. **마지막 행에서 비활성**. `aria-label="{제목} 아래로"` |
| 숨기기 / 노출 | 버튼 | 현재 `is_active` 의 반대 값을 보낸다 | `toggleHeroBannerAction`. 확인 다이얼로그 없음(되돌릴 수 있는 조작) |
| 수정 | 버튼(secondary) | — | 같은 다이얼로그를 이 배너 값으로 연다 |
| 삭제 | 버튼(danger) | — | 확인 다이얼로그(`BannerDeleteButton`) |

**조작 버튼 묶음 전체가 write 권한자에게만 렌더된다**(읽기 전용에게는 썸네일·제목·기간만 보인다).

## 1.4 서버 액션

| 동작 | 액션 | 검증 | DB 변경 | 감사 | 결과 문구 |
|---|---|---|---|---|---|
| 노출 토글 | `toggleHeroBannerAction` | 없음(`isActive === 'true'` 문자열 비교만) | `hero_banners.is_active` | `banner.toggle`(before `{is_active: !값}` / after `{is_active: 값}`) | 토스트 `배너를 노출합니다.` / `배너를 숨겼습니다.` · 실패 시 에러 토스트 "배너 노출 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 순서 이동 | `moveHeroBannerAction` | `direction` 은 `'up'` 이 아니면 `'down'` 취급 | `movedOrder()` 로 배열을 재배열한 뒤 **자리가 바뀐 행만** `sort_order = 배열 인덱스` 로 하나씩 update | `banner.reorder`(after `{ order: [id…] }`) | 토스트 `배너 순서를 변경했습니다.` · 경계 밖이면 "더 이상 이동할 수 없습니다." |
| 삭제 | `deleteHeroBannerAction` | `id` 빈 값이면 "대상을 찾을 수 없습니다." · 행 없으면 "이미 삭제된 배너입니다." | `hero_banners` **하드 삭제** | `banner.delete`(before = 행 전체) | 토스트 `{제목} 배너를 삭제했습니다.` · 실패 "배너를 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요." |

모두 `requirePermission('settings','write')` → 성공 후 `revalidatePath('/settings')` + `revalidateClient(['site'])`.

**삭제 다이얼로그**(`BannerDeleteButton`): 제목 `배너 삭제`, 설명 `"{제목}" 배너를 삭제합니다. 되돌릴 수 없습니다. 잠시 내리려는 것이라면 숨기기를 눌러 주세요.` / 버튼 `취소`·`삭제`(진행 중 `삭제 중…`). 다른 조작(↑↓·노출 전환)은 되돌릴 수 있어 한 번에 실행하지만 삭제만 한 단계를 세운다.

**상태·뱃지 의미**

| 뱃지/표시 | 색 | 뜻 |
|---|---|---|
| 노출 | success | `is_active = true`. 기간 조건까지 맞으면 후보가 된다 |
| 숨김 | neutral | 사용자 사이트 질의(`.eq('is_active', true)`)에서 제외 |
| 영상 | accent | `media_type = 'youtube'` |
| 기간 `제한 없음` | — | `starts_at`/`ends_at` 가 `null` |

**클라이언트와의 상호작용**

- 선택 규칙(`pickActiveHeroBanner`, `lib/data/hero-banner.ts`): `sort_order asc, created_at asc` 로 읽은 행을 위에서부터 훑어 ① `is_active` ② 기간 안(`starts_at <= now`, `ends_at > now` — **종료 시각은 포함하지 않는다**) ③ 그릴 수 있음(`youtube` 면 `youtubeId !== null`, `image` 면 `image_url !== null`) 을 모두 만족하는 **첫 장**을 고른다. 조건을 못 채우면 다음 행으로 넘어간다.
- 하나도 없으면 `/about` 상단은 기본 정보의 `youtube_url` 영상으로 대체된다(→ [01-basic-info.md](01-basic-info.md)).
- 기간 판정은 **캐시 시점 기준**이다. 태그 `site`(300초) 캐시 안에서는 시작·종료 시각이 지나도 최대 5분간 옛 판정이 유지된다.
- **`FEATURES.aboutDisabled` 기본값이 ON 이라 기본 배포에서 `/about` 자체가 홈으로 302 된다** — 배너를 아무리 올려도 사용자에게 보이지 않는다(→ README §2).

**오류·예외**

- 순서 이동은 바뀐 행을 하나씩 update 한다. 도중 실패하면 **일부만 반영된 상태로 멈추고** "배너 순서를 바꾸지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요."가 뜬다(트랜잭션이 아니다).
- 이웃과 `sort_order` 를 맞바꾸지 않고 배열을 다시 배열하는 이유: 초기 데이터는 `sort_order` 가 모두 0(기본값)이라 맞바꾸기로는 아무 일도 일어나지 않는다.
- 업로드한 배너 이미지(`public-assets/banners/<uuid>.<ext>`)는 배너를 지워도 Storage 에 남는다.
- 노출 토글·순서 이동에는 낙관적 잠금이 없다 — 두 운영자가 동시에 조작하면 나중 쪽이 이긴다.
