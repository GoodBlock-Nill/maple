# 가이드 · 랭킹 · 고객지원 · 소개 구현 스펙 (Figma → 코드)

공용 서브 페이지 레이아웃(PageShell: 상단 배경 밴드 + 1200 컨테이너 + 제목 64px + 툴바 + `#ededed` 시트 + 더보기 + 페이지별 푸터)과 칩·검색·정렬·더보기·메타 토큰은 `news-community-spec.md`를 그대로 따른다. 여기에는 페이지별 차이만 적는다.

## 페이지별 배경 · 마스코트

| 페이지 | 상단 배경 (`public/images/…`) | 제목 옆 장식 (x, y, w×h · 1440 기준) | 푸터 배경 / 패널 위치 | 푸터 마스코트 |
|---|---|---|---|---|
| 가이드 `/guide` | `guide/top-bg.png` 1440×420 (단풍, 투명) | `guide/mascot-top.gif` 170×100 at (1085, 330) — 버섯 캐릭터 | `guide/footer-bg.png` 1440×631, 패널 bottom 70 (=top 208) | `guide/mascot-footer.gif` 182×235 at (center+614−91 → x 1243, bottom 153) 토끼 |
| 랭킹 `/ranking` | `ranking/top-bg.png` 1440×296 (판다 바위·사당, 투명) | `ranking/mascot-panda.gif` 214.38×177.1 at (1059.31, 349.4) 책 읽는 판다(애니메이션) · `ranking/deco-right.png` 277×256 at (1280, 224) · `ranking/deco-left.png` 108×104 at (0, 244) | `ranking/footer-bg.png` 1440×631, 패널 bottom 70. 패널 그라데이션 `rgba(140,151,137,.55)` | `ranking/mascot-footer.gif` 248×200 at (1180, 246) 판다 |
| 고객지원 `/support` | `support/top-bg.png` 1440×282 (눈 덮인 숲, 투명) | `support/mascot-top.gif` 271.19×198.07 at (979.87, 264.93) 눈사람(애니메이션) · `support/deco-484.png` 60×84 at (161, 268) · `deco-485.png` 60×64 at (1261, 275) · `deco-479.png` 124×60 at (1271, 287) · `deco-508.png` 162×77 at (273, 298) | `support/footer-bg.png` 1440×631, 패널 bottom 70 | `support/mascot-footer.gif` 216×198 at (1154, 236) |
| 소개 `/about` | 아래 별도 | | `about/footer-bg-v2.png`(재수출, 선명도 개선) 1440×703, 패널 top 280 (inset 39.83% ~ 9.96%) | `about/mascot-footer.gif` 214×169 at (1202, 339) |

- 서브 페이지 푸터 높이: 뉴스/커뮤니티/소개 703, 가이드/랭킹/고객지원 631. `SiteFooter variant`로 배경·높이·마스코트만 분기.

## 가이드 — 확률형 아이템 정보 (496:12103, 상세 496:14385)

- 제목 "확률형 아이템 정보". 툴바 1행: 탭 칩(프리미엄 부화기 / 큐브 / 등급업 / 주문서 부화기 → `?tab=premium|cube|scroll`). 2행: 좌 정렬 드롭다운("최신순"), 우 검색 300.
  - 정렬 3종: 최신순(`?sort=` 생략, `published_at desc, id`) / 확률 높은순(`prob_desc`, `probability desc, published_at desc, id`) / 확률 낮은순(`prob_asc`, `probability asc, published_at desc, id`). 알 수 없는 `?sort=` 값은 최신순으로 폴백한다(레거시 `probability`/`name` 포함).
- 시트 안 **3열 grid** gap 16 (내부 폭 1168). 카드: white, border `#cdd3db`, radius 20, p 24, gap 24, h 189, shadow-chip.
  - 1행: 좌 아이콘 박스 48×48 (p 5, radius 10, 아이콘 이미지 52×48 object-cover) / 우 확률 27px medium `#2a2a2a` tracking −0.2 ("0.01%").
  - 2행: 아이템명 27px medium.
  - 3행: 메타(시계 + 날짜).
  - 클릭 → 상세 모달(`?item=id`, URL 동기화, ESC/딤 클릭 닫기). 아이콘 샘플: `guide/icon-item-1~3.png`.
- **상세 모달 (Frame 7986, 1200×417)**: white, radius 20, p 24, gap 24. 딤 `rgba(0,0,0,.5)` 전체.
  - 헤더: 아이콘 48 + 확률 24px medium(우측) / 아이템명 24px medium.
  - 표(white, radius 20, shadow-chip): 헤더 행 h 48 bg `#f3f3f3` 16px medium `#9b9b9b`, 4열 275/327/275/275 = 등급 / 획득 아이템명 / 확률(%) / 비고. 본문 행 h 52, 하단 dashed 1px `#e0e4e9`, 16px medium `#505865`, 아이템 셀은 아이콘 32 + 이름(gap 5).
  - 등급 글자색: `[SS등급]` `#ac75e6` · `[S등급]` `#ee473f` · `[A등급]` `#ee9513` (semibold 16px). 확장: B `#3b82f6`, C `#727272`.
  - 하단 메타: 시계 + 갱신일.
  - 상세 아이콘 샘플: `guide/detail-icon-*.png`.
- 인라인 확장 시안(493:7143)도 있으나 **모달 채택**. 페이지당 15건, `더보기(15/100)`.
- 데이터: `lib/mock/gacha.ts` — 탭별 아이템(name, icon, probability, updatedAt, rows[{grade, itemName, itemIcon, probability, note}]).

> **오너 요청(2026-09-08)**: 9/18 오픈 시점에는 가이드를 서비스하지 않는다.
> `FEATURES.guideOpen`(`NEXT_PUBLIC_FEATURE_GUIDE_OPEN`, 기본 false)이 꺼져
> 있으면 위 목록·모달 대신 `components/layout/ComingSoon.tsx` 카드를
> `PageShell` 안(제목 아래)에 그리고 Supabase 조회를 건너뛴다. 밴드·제목·
> 마스코트는 그대로 유지된다. 실제 오픈 시 배포 환경 변수만 `true` 로 바꾸면
> 코드 변경 없이 전환된다.

## 랭킹 (493:6646, 2안 496:12818)

- 제목 "랭킹". 툴바(세로 gap 24): 1행 랭킹 종류 칩(종합 랭킹 / 직업 랭킹 / 길드 랭킹 → `?type=total|job|guild`). 2행: 좌 직업 칩(전체 직업 / 모험가 / 시그너스 / 레지스탕스 / 영웅 / 데몬(마족) → `?job=`), 우 검색 300(캐릭터명).
- **TOP3 카드 영역**: 1200×489. 카드 3장 각 390×395, white, border `#cdd3db`, radius 20, shadow `0 .33px .73px rgba(0,0,0,.12), 0 1.5px 2.9px rgba(0,0,0,.07), 0 4px 9px rgba(0,0,0,.05)`.
  - 1위: 가운데(x 407), 상단 정렬(top 0, bottom 60 → 다른 카드보다 60px 위). 배경 패널 244px 높이 `#fffaa9` + 월계관 `ranking/top3-laurel.png`(opacity .3 장식). 캐릭터 이미지 332×243 중앙. 이름 앞 👑 아이콘 31×30 (`ranking/top3-medal-1.png` 계열). 
  - 2위: 좌(x 0), bottom 0. 패널 `#cde3ed` opacity .5. 3위: 우(x 810), 패널 `#e3d3b2` opacity .5.
  - 메달 리본 60×80 카드 좌상단(x +22, y −1) — `ranking/top3-medal-2.png`(은) / `-3.png`(동). 1위는 금 리본 `top3-medal-1.png`.
  - 하단 정보 블록(px 24, py 15, gap 24): 1행 이름 27px medium `#2a2a2a` | 길드 아이콘 32×35 + 길드명 16px `#505865`(없으면 "-"). 2행 3열: 레이블 17px `#727272`(레벨/직업/경험치) + 값 17px `#2a2a2a`(Lv. 211 / 비숍 / 98.7B).
  - 캐릭터 샘플: `ranking/top3-char-1~3.png`.
- **테이블(4위~)**: 시트 `#ededed` radius 20 p 16, gap 12. 헤더 행(h 45, 폭 1176): 순위 / 캐릭터 정보 / 레벨 / 직업 / 길드, 17px medium `#727272`, 각 셀 px 12. 컬럼 폭 비율 ≈ 순위 120 / 캐릭터 400 / 레벨 200 / 직업 220 / 길드 236.
  - 행: white, border `#cdd3db`, radius 20, px 24, h ≈ 96, 26px medium `#2a2a2a`. 캐릭터 셀: 아바타 80×80 (radius 15, p 3, drop-shadow `0 2px 3.5px rgba(0,0,0,.25)`) + 닉네임 마스킹 `cin***`. 길드 셀: 아이콘 40×41 + 길드명 17px.
  - 페이지당 10행(4~13위), `더보기(10/100)`. 2안(496:12818)은 더보기 후 11~20위 상태 → 구현은 TOP3 유지 + 행 누적.
- 데이터: `lib/mock/rankings.ts` 100건(type×job 필터 가능). 출처 미정 → 관리자 CSV 업로드 전제.
- 모바일: TOP3 세로 스택(1위 먼저), 테이블은 카드형 행(순위·아바타·이름 / 레벨·직업·길드 2줄).

> **오너 요청(2026-09-08)**: 9/18 오픈 시점에는 랭킹을 서비스하지 않는다.
> `FEATURES.rankingOpen`(`NEXT_PUBLIC_FEATURE_RANKING_OPEN`, 기본 false)이
> 꺼져 있으면 위 TOP3·테이블 대신 `components/layout/ComingSoon.tsx` 카드를
> `PageShell` 안(제목 아래)에 그리고 Supabase 조회를 건너뛴다. 밴드·제목·
> 마스코트는 그대로 유지된다. 실제 오픈 시 배포 환경 변수만 `true` 로 바꾸면
> 코드 변경 없이 전환된다.

## 고객지원 (461:15245)

- 제목 "고객지원". 시트 대신 **단일 흰 카드**(border `#cdd3db`, radius 20, pl 32 pr 24 py 32, shadow-chip) 폭 1200.
  - 좌 컬럼(폭 525, gap 32): 제목 "1:1 문의하기" 30px medium `#2a2a2a` + 설명 17px `#727272` "이용 중 궁금한 사항이나 불편한 점을 자세히 기재하여 문의해 주세요." → 메뉴 2개(gap 10): 각 p 10, radius 10, gap 10, 아이콘 박스 48×48(white, border `#cdd3db`, radius 5, shadow `0 2px 7px rgba(0,0,0,.25)`) + 라벨 20px medium. 활성 항목 bg `#fafafa` border `#cdd3db` shadow-chip. 항목: `1:1 문의하기`(`support/icon-inquiry.svg`) → `/support`, `자주 묻는 질문`(`support/icon-faq.svg`) → `/support/faq`.
  - 세로 구분선 1px `#e5e8ef` h 667.
  - 우 폼(폭 561, gap 20): 레이블 17px medium `#2a2a2a` (gap 8~10) + 필드. 필드 공통: bg `#fafafa`, border `#d5d9df`, shadow-chip, 17px `#727272` placeholder.
    - 글자월드 계정 ID: h 40, pill(50), px 16. placeholder "예: 123456789000000".
    - 카테고리 및 유형 선택: 2열 gap 8, h 40, radius 20, pl 14, 우측 caret 40×40 (`brand/icon-select-caret.svg`). 옵션: 카테고리(계정/결제/버그/신고/기타), 유형(문의/신고/제안).
    - 제목: h 40 radius 20 px 16. 문의 내용: h 150 radius 20 textarea.
    - 첨부파일: 레이블 옆 안내 17px `#727272` "최대 3개, 각 200MB 이하. (확장자: jpg, png, gif, pdf)" + 버튼 "파일 선택"(bg `#e7e7e7`, border `#d5d9df`, radius 5, h 40, px 16, 17px `#2a2a2a`).
    - 동의: 체크박스 30×30 (border 1.5 `#d5d9df`, radius 5) + "개인정보 수집 및 이용에 동의합니다." 17px `#1e2938` + 링크 "내용 보기" `#0067ff` underline.
    - 제출: 전폭 h 48 pill, bg `#2a2a2a`, border `#505967`, 17px medium `#edeef0` "문의 등록하기".
  - 컴포넌트 모음(`layout-components.png`)에 "문의 & 신고하기" 제목이 붙은 카드형 변형도 있음 → 모바일에서 좌 메뉴를 상단 탭으로 접고 폼만 카드로.
- `/support/faq`: 같은 카드, 우측에 아코디언(Section 7 흑백 시안의 아코디언 참고: 행 `공지사항` 소카테고리 라벨 + 질문 + 우측 ˅, 펼치면 회색 답변 영역).
- `/support/inquiries` · `/support/inquiries/[id]` (**시안에 없는 추가 화면**): 문의를 남긴 사람이 스스로 답변을 확인할 수 있어야 해서 붙였다. 같은 `SupportCard` 를 쓰되 좌 컬럼 제목·설명만 "내 문의 내역"으로 갈아 끼우고(`heading`/`description` prop), 메뉴 3번째 항목(`support/icon-my-inquiries.svg`, FAQ 아이콘과 같은 48×48 흰 박스)으로 들어간다. 비로그인은 페이지에서 `/login?next=…` 로 보낸다(프록시로 접두사를 잠그면 문의 폼까지 닫힌다).
  - 목록: 흰 카드 행(radius 12, border `#cdd3db`) — 제목 + 상태 뱃지 / 카테고리·유형 · 등록일 · 답변 수. 상태 색은 `접수 대기` 회색(`bg-tray`), `처리 중` `tag-blue`(#2e6eff/#e5efff), `답변 완료` `tag-green`(#00b894/#e5fff1), `종료` 아웃라인 muted. 10건 누적 "더보기". 비어 있으면 "아직 남긴 문의가 없습니다" + `문의하기` 버튼.
  - 상세: 제목·상태·메타(등록일/카테고리·유형/마스킹한 계정 ID) → 평문 본문(줄바꿈 유지) → 첨부(비공개 버킷 서명 URL, 이미지면 48 썸네일) → "답변" 스레드(운영자 카드) → `목록으로`. 답변 전에는 "운영자가 확인 중입니다…" 안내.
  - 접수 직후에는 `?submitted=1` 로 상세에 도착해 완료 모달(`DialogShell`)이 뜬다. `확인` 을 누르면 `router.replace` 로 파라미터를 떼어 새로고침에도 다시 뜨지 않는다.
  - 모바일 390: 좌 메뉴가 위로 접히고(기존 동작), 목록 행은 뱃지 → 제목 → 메타 순으로 세로 스택.
  - **소유자 동작(시안에 없는 추가 사양, 2026-09-08)**: 상세 헤더의 상태 뱃지 아래에 액션 줄이 붙는다 — 접수 대기면 `수정`(→ `/support/inquiries/[id]/edit`)과 `접수 취소`, 처리 중이면 `접수 취소`만, 그 밖(답변 완료·종료·이미 취소)에는 없음. 버튼 규격은 게시판 상세 액션(`BOARD_ACTION_CLASS`, h32 pill)과 같다.
    - 접수 취소: 확인 모달(`ConfirmDialog`, "문의 접수를 취소할까요? / 취소한 문의는 되돌릴 수 없습니다.") → `cancelInquiry` → `status=closed` + `cancelled_at`. 이후 목록·상세 뱃지는 `종료` 대신 **`접수 취소`(회색 `bg-tray text-ink-muted`)** 로 그린다(라벨 판정은 `resolveInquiryStatus()`).
    - 수정: 같은 `SupportCard` 안에 접수 폼을 그대로 재사용하되 제목·설명이 "문의 수정"이고 동의 체크박스가 빠진다. 기존 첨부는 `삭제` 체크박스로 빼고 새 파일을 더한다(합쳐서 최대 3개). 저장 후 상세로 돌아가며 `?updated=1` 1회성 안내("문의가 수정되었습니다")를 띄운다(모달이 아니라 `FlashNotice`). 접수 대기가 아닌 문의의 수정 주소로 직접 들어오면 상세로 돌려보내고 `?locked=1` 안내를 띄운다.
- 데이터: FAQ 는 `faqs` 테이블, 문의 접수는 `lib/actions/inquiry-actions.ts`(첨부는 `inquiry-attachments` 비공개 버킷), 수정·접수 취소는 `lib/actions/inquiry-edit-actions.ts`, 조회는 `lib/data/inquiries.ts`. 소유자 권한 판정은 `lib/utils/inquiry-permissions.ts` 한곳에 모아 화면과 서버가 같은 문장을 쓴다(DB 가드는 `guard_inquiry_owner_update()`).

## 소개 (509:2958, 1440×2609)

세로 구조(페이지 y): 0–763 영상 히어로 → 517–1017 나무 단상·풀숲(히어로 위에 겹침) → 940–2268 보라→시안 그라데이션 밴드(돌 질감) → 1128–1867 양피지 패널 → 1906–2609 푸터.

- **영상 히어로**(`영상_플레이 버튼` 1440×763): 배경 = 유튜브 썸네일(`site_settings.youtube_url`에서 videoId → `https://i.ytimg.com/vi/{id}/maxresdefault.jpg`; 없으면 `about/video-still.png`) + 검정 50% 오버레이. 중앙 유튜브 플레이 버튼 141×100 (`about/youtube-play.svg`). 클릭 시 iframe 임베드로 교체(lite-youtube 방식).
  - 캐릭터 행 + 나무 단상 + 풀숲은 합성 오버레이 `about/hero-overlay.png` 1440×1017 (투명, 히어로 위·아래로 이어짐, pointer-events none).
- **그라데이션 밴드** `about/band-bg.png` 1440×1328 (page y 940부터). CSS 대체: `linear-gradient(180deg,#bfb9ff 0%,#bfb9ff 50%,#76eaff 100%)` + 상단 덩굴 이미지.
- **양피지 패널**(`유튜버 소개` 1341×739, page x 59, y 1128): 배경 합성 `about/creator-panel.png`(지도 프레임·질감·덩굴·사진 타원 포함, 텍스트 제외). 그 위 텍스트 블록(패널 기준 x 499+56, 세로 중앙, 폭 663, gap 40):
  - 이름 "세글자" 100px **Maplestory Bold**(`font-maple`), 그라데이션 텍스트 `#ffd200 → #ff6c00`.
  - 슬로건 25px **Maplestory Bold**(`font-maple`) `#f7601b` "메이플스토리의 역사를 함께해 온 2세대 최초 만렙 크리에이터!"
  - 본문 22px **Noto Sans KR Bold**(`font-intro`) `#381f1e` lh 30, 단락 4개(시안 텍스트 그대로, 뒤 2단락은 플레이스홀더).
  - 이 세 줄이 사이트에서 Maplestory·Noto Sans KR 을 쓰는 **유일한** 자리다. 나머지는 전부 Switzer(+Pretendard 한글) 또는 Inter — `docs/reference/figma/about-gif-spec.md` 의 폰트 표 참고.
  - 우측 도트 아바타 `about/avatar-dot.png` 206×285 at 패널 (1151, 357) + 그림자 svg. 작은 나무 `about/tree-small.png` 184×127 at page (1256, 1285).
- 모바일: 히어로 16:9, 패널은 세로 스택(사진 → 이름 → 본문), 양피지 배경은 `background-size: cover`.
- 데이터: `site_settings.creator_*` (목업 `lib/mock/site.ts`).
