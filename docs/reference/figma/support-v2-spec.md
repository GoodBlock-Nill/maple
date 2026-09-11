# 고객지원 v2 시안 스펙 (Figma 2UmKcpmy55IqMZ7Sg6vTeW, 2026-09-11)

새 파일 "메이플 글자월드". 고객지원 카드 안쪽(좌측 메뉴 · 내 문의 내역 목록 · 문의 상세 ·
문의 수정 폼)과 헤더 바 폭·활성색, 푸터 패널이 바뀌었다. **로직·데이터 흐름은 그대로**
(카테고리/세부 유형/계정 ID/첨부 3+2/동의/프리필/접수번호/수정·취소 권한).

스크린샷 `docs/reference/figma/support-v2/{pc-1..4,m-1..4}.png` (긴 변 1440 축소본).
아이콘 `public/images/support/v2/*.svg`(시안 원본 SVG). 좌측 메뉴 아이콘은 기존
`public/images/support/icon-*.svg` 그대로.

| 프레임 | 노드 | 크기 | 내용 |
|---|---|---|---|
| pc-1 | 166:13584 | 1440×1792 | 내 문의 내역 목록 + 페이지네이션 |
| pc-2 | 166:14869 | 1440×1792 | 문의 상세 — 접수대기(수정·접수 취소 · 답변 없음) |
| pc-3 | 166:15002 | 1440×1792 | 문의 상세 — 답변 완료 |
| pc-4 | 166:15141 | 1440×1792 | 문의 수정 폼 |
| m-1 | 166:13911 | 375×1680 | 모바일 목록 |
| m-2 | 166:14121 | 375×1629 | 모바일 상세(접수대기) |
| m-3 | 166:14296 | 375×1775 | 모바일 상세(답변 완료) |
| m-4 | 166:14655 | 375×1976 | 모바일 수정 폼(동의 줄 포함 = 접수 폼 모양) |

상단 밴드·장식·마스코트·제목 위치(`PAGE_HERO.support`, contentTop 334)는 현행과 같다
(제목 y≈352, 카드 top 462). 폰트: 시안은 Inter Medium/Semibold — 본문 서체 규칙은
기존 컴포넌트(`font-ui` = Inter)를 따른다.

## 1. 헤더 (Menu_PC 166:13606 — 전 페이지 공통, 사용자 지시 "헤더 바 폭도 조정")
- 바: **1200×66 @ x=120**(현행은 내용 폭만큼 hug). `.glass` 그대로(border 1 white,
  rgba(255,255,255,.4), blur 7.5, inset 0 0 33 rgba(255,255,255,.4)), radius **10**, padding 15/24.
- 로고 99×36 → gap **32** → 나머지 영역 flex-1: 좌측 GNB(gap 50) · 우측 계정 메뉴.
- GNB Inter Semibold 16/22 tracking −0.4 #2a2a2a. 준비중(가이드·랭킹) #727272 — 기존 플래그 동작 유지.
- **활성 항목: 텍스트 #e8308a + 하단 2px #e8308a 밑줄**(현행의 검은 밑줄 대체). 밑줄은
  텍스트 상자 바로 아래(border-bottom, 시안 실측 텍스트 22 + 2).
- 우측: 제공자 아이콘 24 + gap 4 + 닉네임 16/22 + gap 8 + 삼각형 12×6(기존 `AccountMenu`).
  미로그인은 기존 흰 "로그인" 알약.
- 모바일 Top_nav: 343×60 @ (16,60) 로고 + 햄버거 — 현행 유지.
- 1200 바는 `lg` 이상에서 `w-full max-w-[1200px]`. 1200 미만 화면에서는 현행처럼 좌우 16 여백.

## 2. 카드 골격 (Frame 8111, 1200)
- white · border #cdd3db · radius 20 · **padding 32**(4방향 동일) · drop-shadow
  (0 .326 .367 rgba(0,0,0,.12), 0 1.541 1.433 rgba(0,0,0,.07)) — `SUPPORT_CARD_CLASS` 패딩을 32 로.
- 안쪽: 좌측 메뉴 열 **374** → gap 16 → 세로 구분선 1px #cdd3db(높이 667, 카드 안 콘텐츠 높이에
  맞춰 stretch) → gap 48 → 우측 콘텐츠 **698**. (32+374+16+1+48+698+32 = 1201 ≈ 1200)
- 좌 열 상단의 제목("1:1 문의하기")·설명 문단은 **없다** — `SupportCard` 의 heading/description
  블록 삭제. 메뉴가 카드 상단(padding 12 위 여백 = 메뉴 리스트가 y+12 에서 시작)부터 선다.
- 메뉴 항목 374×68: padding 10, gap 10, 아이콘 48(흰 박스 radius 5 border #cdd3db shadow
  0 2 7 rgba(0,0,0,.25)) + 라벨 Inter Medium 18/26 tracking −0.45 #2a2a2a. 항목 간 gap 10.
  활성 = bg **#fafafa** + border #cdd3db + radius 10 + drop-shadow(위 2단 + 0 4 4.5 rgba(0,0,0,.05)).
- 카드 최소 높이: 콘텐츠 667 + 패딩 = 731(목록은 748).

## 3. 내 문의 내역 목록 (pc-1 / m-1)
- 우측 열 세로: 카드 리스트(gap **16**) → gap 20 → 페이지네이션.
- 행 카드 698: white · border #cdd3db · radius **16** · padding 16/24 · drop-shadow 3단 ·
  세로 gap 8.
  - 1줄: 제목 Inter Medium 18/26 #2a2a2a(한 줄 말줄임) … 우측 `No. 12345` Inter Medium 13/18 #727272.
    → 표기는 `No. ` + 접수번호 숫자(`formatInquiryNo` 는 `#1024` 라 목록·상세에는 **`No. 1024`** 형태의
    새 헬퍼 사용. 기존 `#` 표기는 접수 완료 모달·관리자 등 다른 자리에서 그대로).
  - 2줄(gap 12): `계정 › 신고`(카테고리 14/20 #727272 + chevron-right-16 #cdd3db + 유형) ·
    날짜 `2026-05-19` 14/20 #727272 · 상태.
  - 상태 표기: 접수대기 = pill bg #f1f1f5 text #727272 13/18 px 8 py 4 radius 50 /
    처리중 = 같은 pill, text **#625b71** / **답변완료 = pill 없이 텍스트 #e8308a 14/20** /
    종료 = 접수대기와 같은 회색 pill(시안 없음, 현행 유지 톤) / 접수 취소는 목록에 없음.
  - `답변 N` 카운트 표기는 시안에 없다 → 제거.
- 페이지네이션(Frame 1707488073): chevron-left 24 · gap 16 · 페이지 번호들(gap 8) · gap 16 · chevron-right 24.
  번호 셀 32~35×38, Inter Medium 16/22; **현재 페이지 = bg #2a2a2a radius 6 white 텍스트**, 나머지 #2a2a2a 투명.
  화살표 stroke #727272(끝 페이지에서는 비활성 opacity .4). 
  → **누적 "더보기"를 번호 페이지네이션으로 교체**: `?page=N` 은 N 페이지만 그린다
  (`accumulatedRange` → 단일 페이지 range). 페이지 크기 **6**(시안 카드 6장 = 최소 높이 667 에 맞춤).
  최대 5개 번호를 현재 페이지 중심으로 창을 옮겨 보여 준다.
- 빈 목록: 기존 `EmptyState` 유지(시안 없음).
- 모바일(343 카드, padding 12): 상단 **세그먼트 탭 3개**(각 114.33×47: "1:1 문의하기 / 자주 묻는 질문 /
  내 문의 내역", Body3 14/20, 활성 #e8308a + 하단 2px 인디케이터, 비활성 #49454f) + 아래 1px 구분선.
  탭이 좌측 메뉴를 대체한다(모바일에서 메뉴 리스트·아이콘 숨김). 탭 아래 gap 24, 콘텐츠 319 폭.
  행 카드: padding 16, radius 16, 제목 16/22, `No.` 12/1.45, 2줄 13/18, 상태 pill 12px 우측 정렬(
  답변완료는 텍스트 #e8308a 13/18 인라인). 행 gap 12. 페이지네이션 36 높이.

## 4. 문의 상세 — 접수대기 (pc-2 / m-2)
세로 구조(gap):
1. 뒤로 링크: `arrow-back-24` + gap 4 + "내 문의 내역으로" Inter Medium 18/26 #2a2a2a → `/support/inquiries`.
   (하단의 기존 `BackToListLink` "목록으로" 버튼 **제거**.)
2. gap 16 → 제목 줄: 제목 Inter **Semibold 24/34** tracking −0.7 #2a2a2a + gap 8 + 상태 pill(13/18).
   **답변 완료 상태에서는 pill 을 그리지 않는다**(pc-3) — 답변 블록이 상태를 말한다.
3. gap 12 → 메타 줄(좌·우 justify-between):
   좌(gap 16, 항목 사이 세로선 1×12 #d9d9d9): `등록일` #727272 15/22 + gap 8 + `2026.09.10 12:07`(#2a2a2a, 날짜·시각 gap 8) |
   `카테고리` + `계정 › 신고`(14/20 #2a2a2a, chevron 12) | `계정 ID` + 마스킹값 15/22 #2a2a2a.
   우: `No. 12345` 13/18 #727272.
4. gap 12 → 구분선 1px #d9d9d9 (698).
5. gap 28 → `문의내용` Inter Semibold 16/22 … 우측 액션(gap 12):
   `수정` = white border #cdd3db pill **60×36**, Semibold 16 #727272 /
   `접수 취소` = bg #f1f1f5 pill h36 px 15, Semibold 16 **#852221**. 표시 조건은 기존
   `canEditInquiry`/`canCancelInquiry`(취소 확인 모달 기존 유지).
6. gap 12 → 본문 상자: bg #fafafa radius 16 padding 24, Inter Medium 16/22 #727272, 줄바꿈 유지.
   첨부파일이 있으면 본문 상자 아래(gap 12)에 기존 `InquiryAttachmentList` 를 같은 톤으로 둔다(시안엔 없음).
7. gap 32 → `답변` Semibold 16/22 → gap 12 →
   답변 없음: bg #fafafa **border 1 dashed #d5d9df** radius 16 h72 padding 24: `chat-dots-24` + gap 4 +
   안내 문구 16/22 #727272(문구는 기존 `resolveNoReplyNotice` 상태별 문구).
- 상세 상단의 `FlashNotice`·접수 완료 모달은 뒤로 링크 위에 기존대로.
- 모바일(m-2): 뒤로 링크 15/22 + arrow 20; 제목 Inter Medium 20/28 + pill(12px) 우측 정렬;
  메타는 **세로 4줄**(gap 4): 라벨 60 폭 13/18 #727272 + 값 13/18 #2a2a2a — `접수번호 12345`,
  `등록일 2026.09.10 12:07`, `카테고리 계정 › 신고`, `계정 ID 1234**211`; 구분선; `문의내용` + 액션
  h28 13px(수정 white pill px12 / 접수 취소 #f1f1f5 #852221); 본문 상자 padding 16/12 텍스트 14/20;
  답변 상자 padding 16/12, 아이콘 20, 텍스트 14/20.

## 5. 문의 상세 — 답변 완료 (pc-3 / m-3)
- 제목 옆 pill 없음. 메타 줄·본문 동일(액션 없음).
- 답변 블록: bg **#f3f6fe** radius 16 padding 24, 답변 여러 건이면 상자를 gap 12 로 쌓는다.
  - 머리줄(gap 12): `chat-dots-24` + gap 4 + 작성자(`reply.authorName`, Inter Medium 16/22 #2a2a2a) |
    세로선 1×12 #d9d9d9 | 날짜 `2026.09.10 15:32` 15/22 #727272(`formatDateLong`).
  - 본문: 머리줄 아래 gap 20, **좌측 들여쓰기 = 아이콘 폭 + 4(작성자 텍스트 시작선, x=55−24=31)**,
    Inter Medium 16/22 #727272, 줄바꿈 유지. 상자 **max-height 287 → 넘치면 내부 스크롤**(시안 주석).
- 모바일(m-3): 상자 padding 16/12, 머리줄 아이콘 24 + 작성자 14/20 + 날짜 13/18, 본문 14/20 gap 16.

## 6. 문의 수정 폼 (pc-4 / m-4) — 접수 폼(`/support`)도 같은 컴포넌트라 함께 바뀐다
- 행 간격 **20**, 라벨↔필드 gap 10(카테고리 행은 8). 라벨 Switzer Medium 17(현행 `SUPPORT_LABEL_CLASS`
  유지) — 첨부파일 라벨만 Inter Medium 16/22.
- 필드 공통: h40 bg #fafafa border #d5d9df drop-shadow 3단(현행 `.support-field`), 텍스트 Inter Medium 17/25.
  - 계정 ID: **345 폭 pill(radius 50)**, 값 `123456789000000`. 모바일은 전체 폭.
  - 카테고리·유형: **2열 345/345 gap 8**(현행 grid 유지), radius 20, 우측 40×40 chevron(`select-chevron.svg`
    stroke #1e2938 — 현행 `.support-select` 화살표를 이 모양으로).
  - 제목 698 h40 radius 20. 문의 내용 h150 radius 20 padding 10/16(현행 auto-grow 유지).
- 첨부파일 블록(gap 12): 1줄 = `파일 선택` 버튼(bg **#e7e7e7** border #d5d9df **radius 5** h40 px16,
  Inter Medium 16/22 #2a2a2a, 모바일 15px) + gap 12 + 안내 13/18 #727272 두 줄:
  `이미지·PDF 5MB/개 · 최대 3개 · 총 12MB / 영상 100MB/개 · 최대 2개 · 총 200MB`
  `(JPG, PNG, GIF, WEBP, PDF · MP4, MOV, WEBM, M4V)` — 숫자는 storage 상수에서 조합(`ATTACHMENT_NOTICE` 교체).
  모바일은 안내가 버튼 위에 선다(m-4: 라벨 아래 4px).
- 파일 칩(선택한 파일 · 기존 첨부 · 영상 공통): white border #cdd3db pill(radius 100) px12 py4,
  이름 15/22 #2a2a2a(**확장자 앞부분만 말줄임**, 6자 넘으면 `…`) + gap 8 + 용량 13/18 #727272 + gap 12 +
  `close-20` 버튼(칩 제거 = 선택 해제 / 기존 첨부는 삭제 표시 / 영상은 업로드 취소·제거).
  칩은 wrap, gap 12(모바일 세로 gap 8). 기존 "삭제" 체크박스 UI → 칩 X 로 교체(폼 전송값은 그대로
  `removeAttachments`).
- 동의 줄(접수 폼만, m-4 실측): `check-18`(켜짐 #2a2a2a radius 4 + 흰 체크, 꺼짐 white border #d5d9df)
  + gap 5 + "개인정보 수집 및 이용에 동의합니다." 14/20 #2a2a2a + gap 5 + "내용 보기" **#0067ff** 14/20.
  현행 30px 상자를 18 로.
- 제출 버튼: `수정 완료` / `문의하기` **183×54** bg #2a2a2a pill Inter Semibold 18/26 white(모바일 142×48, 16px).
  잠금·안내 문구 로직 기존 유지.
- 수정 화면 상단의 "문의 수정 #1024" 제목·설명 블록은 **없다**(좌 열 제목 삭제와 동일) — 대신 폼 위에
  뒤로 링크 `← 문의로 돌아가기`(상세와 같은 스타일)를 두어 어느 문의인지 돌아갈 수 있게 한다. 하단
  `BackToListLink` 제거. 접수 폼(`/support`)의 우측 상단 "내 문의 내역 보기" 링크는 유지.

## 7. 푸터 (고객지원_푸터 166:13652, 1440×631)
- 패널 **1200×353 @ x=120**, padding 40/140, 좌측 블록 371(마이페이지 v2 와 동일 구성), 연락처 =
  "문의하기" 제목 + care@gjstory.com 텍스트(`contactStyle: 'text'`).
- 패널 톤: 시안 실측 평균 휘도 100~125(눈 숲 위) — 마이페이지와 같은 `glass-panel-dark`.
- 여우 마스코트 좌표(1094, 235.9) 216×198 — 현행 support 설정(1154, 236)에서 **left 1094 로**.
- 모바일 푸터 343 카드 @16, 524 높이 — 기존 모바일 푸터 구조 유지.

## 8. 자주 묻는 질문(`/support/faq`)
시안 없음. 카드 골격·좌측 메뉴·모바일 탭만 v2 로 바뀌고 아코디언은 그대로.
