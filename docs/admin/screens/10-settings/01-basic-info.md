# 사이트 설정 — 기본 정보 (`/settings` 기본 정보 카드)

**목적** 사용자 사이트 전역에 쓰이는 값(서비스 이름·소셜 주소·연락처·법적 문구·크리에이터 소개)을 한 폼으로 저장한다. 여기 한 줄이 푸터·메타데이터·정책 하단·리다이렉트에 동시에 드러난다.

**데이터 출처** `getSiteSettings()`(`admin/lib/data/settings.ts`) — `site_settings` 에서 `select('*').eq('id', 1).maybeSingle()`. 행이 없거나 실패하면 `null` 을 돌려주고(실패 시 `console.error('[settings] 조회 실패')`), 카드 설명이 `아직 설정 행이 없습니다. 저장하면 새로 만듭니다.` 로 바뀐다. 행이 있으면 `최종 수정 {formatDateTime(updated_at)}`.

폼은 `noValidate`(브라우저 말풍선 대신 한국어 zod 메시지) + 비제어 입력(`defaultValue`)이다.

## 1.1 기본 정보 (2열 그리드)

모든 선택 항목은 **빈 문자열을 `null` 로 저장**한다(`optionalTextSchema`/`optionalUrlSchema`/`optionalEmailSchema` 의 `.transform`) — 빈 값을 반려하면 항목 하나를 지우는 방법이 없어지기 때문이다.

| 필드 | 종류 | 필수·제한(검증) | 기본값·프리필 | 동작 / 상호작용 |
|---|---|---|---|---|
| 사이트 이름 | 텍스트(`maxLength` 50) | **필수** 1~50자(`siteSettingsSchema.gameName`). 오류: "사이트 이름을 입력해 주세요." | `settings.gameName ?? '글자월드'` | `site_settings.game_name`. 힌트 "브라우저 탭 제목과 공유(OG) 카드 제목에 들어갑니다." 태그 `사이트 반영` → `app/layout.tsx` 메타데이터 |
| 월드 ID | 텍스트(`maxLength` 50) | 선택 ≤50자 | `world_id` | `world_id`. 힌트 "메이플스토리 월드의 월드 식별자. /play 가 이 값으로 이동합니다." 태그 `사이트 반영` → `app/(public)/play/route.ts` |
| 디스코드 주소 | `type="url"`(`maxLength` 500) | 선택. 값이 있으면 `^https?:\/\/\S+$`. 오류: "http(s) 로 시작하는 주소여야 합니다." / "500자를 넘을 수 없습니다." | `discord_url` | `discord_url`. placeholder `https://discord.gg/...`. 힌트 "푸터 디스코드 버튼과 /discord 이동에 쓰입니다. 표시 제약이 아니라 주소 저장용 상한입니다." |
| 유튜브 주소 | `type="url"`(`maxLength` 500) | 위와 동일 | `youtube_url` | `youtube_url`. placeholder `https://youtube.com/@...`. 힌트 "푸터 유튜브 버튼에 쓰입니다. 소개 화면 상단 영상은 히어로 배너가 없을 때만 이 주소의 영상을 씁니다." |
| 연락 이메일 | `type="email"`(`maxLength` 254) | 선택. 값이 있으면 `z.email()`. 오류: "이메일 형식이 올바르지 않습니다." / "254자를 넘을 수 없습니다."(RFC 5321) | `contact_email` | `contact_email`. placeholder `contact@example.com`. 힌트 "푸터의 이메일 버튼에 그대로 노출됩니다." |
| 저작권 문구 | 텍스트(`maxLength` 200) | 선택 ≤200자 | `copyright` | `copyright`. 힌트 "푸터 하단 한 줄. 30자를 넘으면 폰에서 줄바꿈됩니다." **`Copyright ©` 접두어까지 포함한 완성 문장**을 넣는다(코드가 덧붙이지 않는다) |
| 지식재산권 고지 | textarea(3줄, `maxLength` 500) | 선택 ≤500자 | `ip_notice` | `ip_notice`. 힌트 "개인정보처리방침 하단의 지식재산권 고지 문단으로 노출됩니다." **줄바꿈(`\n`)이 의미를 갖는다** — 아래 §클라이언트 참고 |

## 1.2 크리에이터 소개 (`SiteCreatorFields`, `<fieldset>` legend `크리에이터 소개`)

상태 없는 조각이라 값 수집·제출은 부모 폼이 한다(파일 200줄 상한 때문에 분리).

| 필드 | 종류 | 필수·제한(검증) | 기본값 | 동작 / 상호작용 |
|---|---|---|---|---|
| 이름 | 텍스트(`maxLength` 6) | 선택 ≤6자 | `creator_name` | `creator_name`. 힌트 "소개 화면에 100px 크기로 크게 찍힙니다. 7자부터 패널 밖으로 나가 6자로 제한합니다."(실측) |
| 슬로건 | 텍스트(`maxLength` 40) | 선택 ≤40자 | `creator_slogan` | `creator_slogan`. 힌트 "소개 패널의 주황색 한 줄. PC 약 26자 · 폰 약 17자마다 줄이 바뀝니다." (`data-testid="creator-slogan-input"`) |
| 소개글 | textarea(8줄, `maxLength` 4000) | 선택 ≤4000자 | `creator_intro` | `creator_intro`. **문단 구분은 빈 줄 두 개**(`splitParagraphs`), 문단 안 줄바꿈은 그대로 유지된다. zod `trim` 은 앞뒤만 다듬고 내부 공백은 손대지 않는다 |
| 사진 주소 | 텍스트(`maxLength` 500) | 선택. `optionalLinkSchema` — `''`·`/` 로 시작·`http(s)://` 중 하나. 오류: "http(s) 주소이거나 `/` 로 시작하는 경로여야 합니다." | `creator_photo_url` | `creator_photo_url`. 힌트 "아래에서 파일을 올리면 이 값이 업로드 주소로 바뀝니다." |
| 사진 파일 | 파일(`accept` png/jpeg/webp/gif/svg+xml) | MIME 이 `PUBLIC_ASSET_EXTENSIONS` 밖이면 "PNG · JPG · WEBP · GIF · SVG 만 올릴 수 있습니다." | 없음 | **경로가 고정**이다: `public-assets/site/creator-photo.<ext>` 를 `upsert: true` 로 덮어쓰고, 돌려주는 URL 에 `?v=<Date.now()>` 를 붙인다(안 붙이면 CDN 이 옛 이미지를 계속 내려 준다). 성공 시 위 `사진 주소` 값을 덮어쓴다. 실패 시 `creatorPhotoFile` 필드 오류 "이미지를 올리지 못했습니다. 파일 크기를 줄이거나 잠시 후 다시 시도해 주세요." |

## 1.3 저장

| 컨트롤 | 종류 | 필수·제한 | 동작 / 상호작용 |
|---|---|---|---|
| 저장 | 제출 버튼 | **write 권한자에게만 버튼(과 위 구분선)이 렌더된다** | `saveSiteSettingsAction`. 전송 중 `저장 중…` + 비활성. 성공 시 토스트 `사이트 설정을 저장했습니다.`(리다이렉트 없음, 값은 `revalidatePath('/settings')` 로 다시 그려진다) |

**`saveSiteSettingsAction` 처리 순서**
1. `requirePermission('settings','write')` → 2. 사진 파일 업로드(있으면 `creatorPhotoUrl` 덮어쓰기) → 3. `SITE_SETTINGS_TEXT_FIELDS` 10개를 한 번에 읽어 `siteSettingsSchema` 검증 → 4. `before` 행 조회 → 5. `upsert(id=1)` → 6. 감사 `settings.update`(before = 이전 행 전체 또는 `null`, after = `toSiteSettingsRow()` 결과) → 7. `revalidatePath('/settings')` + `revalidateClient(['site'])`.

| 결과 | 화면 |
|---|---|
| 성공 | 초록 토스트 |
| 필드 오류 | 각 입력 아래 zod 메시지(필드당 하나) |
| DB 실패 | 폼 상단 배너 "사이트 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." + 서버 로그 `[settings] …` |

**클라이언트와의 상호작용**

| 필드 | 사용자 사이트 노출 위치 | 해석 규칙 |
|---|---|---|
| `game_name` | `app/layout.tsx` 메타데이터(제목·OG) | `resolveGameName()` → 비면 `SITE_NAME`(`글자월드`) |
| `world_id` | `/play` 리다이렉트 | — |
| `discord_url` | `/discord` · `/sns/discord` 리다이렉트, 푸터 디스코드 버튼 | — |
| `youtube_url` | `/sns/youtube` 리다이렉트. **히어로 배너가 하나도 없을 때만** `/about` 상단 영상으로도 쓰인다(`resolveAboutVideoUrl`) | 영상 id 를 뽑을 수 없는 채널 주소면 중립 포스터로 폴백한다 |
| `contact_email` | 전 페이지 푸터의 `문의 : <메일 링크>`(`components/layout/SiteFooter.tsx`) | `resolveContactEmail()` → `toEmailLink()`: **표기는 입력한 그대로(한글 도메인 포함), `mailto:` href 는 ASCII(Punycode)**. 비면 `CONTACT_EMAIL`(`care@gjstory.com`) |
| `copyright` | 푸터 하단 회색 한 줄 | `resolveCopyright()` → 비면 `COPYRIGHT`(`Copyright © 글자월드. All rights reserved.`) |
| `ip_notice` | ① **전 페이지 푸터**(`FooterIpNotice`) ② `/policy/privacy` 본문 하단 `지식재산권 고지` 섹션(`PolicyIpNotice`, `hasIpNotice: true` 인 문서는 privacy 하나뿐) | `resolveIpNotice()` → 비면 `IP_NOTICE` 4줄. 아래 별도 항목 참고 |
| `creator_name`·`creator_slogan`·`creator_intro`·`creator_photo_url` | `/about` 양피지 패널(`resolveCreator`) | 사진이 비면 로컬 시안 자산으로 폴백. **`FEATURES.aboutDisabled` 기본값이 ON 이라 기본 배포에서는 보이지 않는다** |

**지식재산권 고지의 줄바꿈·굵은 글씨 처리**
- 저장값은 줄을 `\n` 으로 구분한 한 덩어리다. 푸터는 `splitIpNoticeLines()`(`lib/utils/ip-notice.ts`)로 `\r\n?` 를 정규화하고 줄마다 `trim`, **공백만 있는 줄은 버린 뒤** `<br>` 로 잇는다 → 빈 줄로 문단을 띄울 수 없다.
- 줄 안의 고유명사만 semibold 로 강조한다. 목록은 `BOLD_TERMS` = `'MapleStory Worlds'` · `'MapleStory'` · `NEXON Korea Corp.` · `Toben Studio Inc.` 네 개이며, **작은따옴표까지 포함해 글자 그대로 일치해야** 굵어진다(긴 문자열부터 매칭해 `'MapleStory'` 가 `'MapleStory Worlds'` 안에서 먼저 끊기지 않게 한다).
- 반면 `/policy/privacy` 하단 섹션은 `whitespace-pre-line` 로 줄바꿈만 살리고 **굵게 처리는 하지 않는다** — 같은 문자열이 두 화면에서 다르게 보인다.
- 이 문구는 약관 개정 이력과 분리돼 있다(→ `11-legal/`). 넥슨 IP 정책에 따라 따로 갱신되므로, 문구 한 줄을 고치려고 약관 개정본을 만들 필요가 없다.

**오류·예외**

- 저장은 **전체 덮어쓰기**다. 한 필드만 고쳐도 폼에 실린 10개 값 + 사진 주소가 통째로 upsert 되며, 두 운영자가 동시에 저장하면 나중 쪽이 이긴다(낙관적 잠금 없음). 무엇이 바뀌었는지는 감사 로그의 before/after 로만 추적한다.
- 읽기 전용 관리자에게는 저장 버튼이 없을 뿐 값은 모두 보인다.
- 사진 파일은 경로가 고정이라 **이전 파일을 덮어쓴다**(가챠 아이콘처럼 UUID 를 쓰지 않는다). 되돌리려면 다시 올려야 한다.
- `updated_at` 은 `site_settings` 트리거/기본값이 관리하며 폼에서 직접 만지지 않는다.
