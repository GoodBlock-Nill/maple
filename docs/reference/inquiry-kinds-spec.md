# 고객지원 접수 종류(kind) 확장 — 1:1 문의 · 버그제보 · 불법이용제보 (2026-09-14 설계)

오너 요청: 고객지원에 **1:1 문의하기와 동일한 레이아웃·로직**으로 버그제보·불법이용제보를 추가한다.
메뉴 순서 = 1:1 문의하기 · 버그 신고하기 · 이용자 신고하기 · 자주 묻는 질문 · 내 문의 내역(메뉴 문구는 2026-09-15 오너 결정으로 변경. 종류 라벨 "버그제보"·"불법이용제보"는 알약·관리자에서 그대로).
내 문의 내역에는 세 종류가 모두 표시된다. 1:1 문의의 카테고리·유형 중 버그/불법이용에 맞는 것은 그쪽으로 옮긴다.
클라이언트와 관리자가 어긋나지 않아야 한다.

## 1. 데이터 모델 — `kind` 한 축 추가 (마이그레이션 `20260914000100_inquiry_kind.sql`)

값: `'inquiry' | 'bug' | 'report'` (text + check). 라벨: 1:1 문의 / 버그제보 / 불법이용제보.

1. `inquiry_categories.kind text not null default 'inquiry'` + check + 인덱스 `(kind, sort_order, created_at) where is_active`.
   - `sort_order` 는 **kind 안에서의 순서**다(관리자 목록이 kind 별로 나뉜다).
   - label 전역 유니크는 유지(종류가 달라도 같은 라벨 금지 — 관리자 필터·과거 문의 재라벨링이 라벨 기준이라서).
2. `inquiries.kind text not null default 'inquiry'` + check + 인덱스 `(user_id, kind)` 및 `(kind, status)`.
3. **트리거** `inquiries_set_kind_from_category` (before insert or update of category): `inquiries.kind := (select kind from inquiry_categories where label = new.category)`; 매칭 카테고리가 없으면 값을 건드리지 않는다(기본 'inquiry'). — 클라이언트·관리자·이메일 인바운드 어느 경로로 넣어도 kind 가 카테고리를 따라간다.
4. 백필: 기존 `inquiries` 를 카테고리 라벨로 조인해 kind 갱신.
5. 카테고리 이동(기존 8종):
   | key | label | kind |
   |---|---|---|
   | connection | 접속·서버 | **bug** |
   | character | 캐릭터·게임 진행 | **bug** |
   | save-data | 저장·데이터 | **bug** |
   | feature-ui | 기능·UI | **bug** |
   | currency | 재화·아이템 | inquiry (운영자 복구가 필요한 문의라 1:1 유지) |
   | content-balance | 콘텐츠·밸런스 | inquiry |
   | account-environment | 계정·이용환경 | inquiry |
   | etc | 기타·건의 | inquiry |
   - `currency.subtypes` 에서 `'비정상 재화/아이템 획득'` 을 **빼고**, 아래 report 카테고리 `bug-abuse` 로 옮긴다(과거 문의의 type 문자열은 그대로 남고, 수정 화면은 기존 legacy 처리로 고를 수 있다).
   - bug 카테고리의 sort_order 는 0..3 으로 재부여, inquiry 는 0..3(currency, content-balance, account-environment, etc).
6. 불법이용제보(report) 카테고리 신규 시드(sort_order 순, 프리필은 기존 양식 문체 — 첫 줄 "글자월드 캐릭터 닉네임:" 뒤 빈 줄):
   | key | label | description | subtypes | prefill |
   |---|---|---|---|---|
   | illegal-program | 불법 프로그램 | 핵·치트·매크로·오토 등 불법 프로그램 사용 제보. | 핵/치트 프로그램, 매크로/오토, 기타 불법 프로그램 | 글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n발생 일시:\n발생 장소(맵/채널):\n상세 내용:\n첨부 자료(사진, 영상 등): |
   | bug-abuse | 버그 악용·비정상 획득 | 버그를 이용한 이득 취득, 비정상 재화·아이템 획득 제보. | 버그 악용, 비정상 재화/아이템 획득 | 위와 동일 |
   | account-trade | 계정·현금 거래 | 계정 공유·거래, 현금 거래, 사기 제보. | 계정 공유/거래, 현금 거래, 사기/먹튀 | 글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n발생 일시:\n거래 내용/금액:\n상세 내용:\n첨부 자료(사진, 영상 등): |
   | abuse-chat | 욕설·비매너 | 욕설·비방, 성희롱, 도배·광고, 사칭 제보. | 욕설/비방, 성희롱/음란, 도배/광고, 사칭 | 글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n발생 일시:\n발생 장소(맵/채널):\n상세 내용:\n첨부 자료(사진, 영상 등): |
   | report-etc | 기타 제보 | 위 분류에 없는 불법·부정 이용 제보. | (없음) | 글자월드 캐릭터 닉네임:\n\n제보 대상 닉네임:\n상세 내용:\n첨부 자료(사진, 영상 등): |
   `on conflict (key) do nothing`.
7. RPC `update_inquiry_category(...)`: 인자 `p_kind text` 추가(9인자, 옛 8인자 함수 drop). kind 가 바뀌면 같은 트랜잭션에서 `update inquiries set kind = p_kind where category = old_label` (라벨 변경 캐스케이드와 같은 방식). 반환값(옮긴 문의 수)은 라벨·kind 중 하나라도 바뀌면 센다.
8. `inquiry_category_usage()` / `inquiry_type_usage()` 는 그대로(라벨 기준).
9. 답변 템플릿(`inquiry_reply_templates.category_id`)은 카테고리를 따라가므로 변경 없음.
10. `pnpm gen:types` 로 `types/database.types.ts` + `admin/types/database.types.ts` 재생성.

## 2. 공유 상수 (클라이언트 `lib/constants/inquiry-kind.ts`, 관리자 `admin/lib/constants/inquiry-kind.ts` — 별도 패키지라 두 벌, 값·라벨은 동일해야 한다)
```ts
export const INQUIRY_KINDS = [
  { value: 'inquiry', label: '1:1 문의', menuLabel: '1:1 문의하기', path: '/support', submitLabel: '문의하기' },
  { value: 'bug',     label: '버그제보', menuLabel: '버그 신고하기',   path: '/support/bug', submitLabel: '제보하기' },
  { value: 'report',  label: '불법이용제보', menuLabel: '이용자 신고하기', path: '/support/report', submitLabel: '제보하기' },
] as const
export type InquiryKind = 'inquiry' | 'bug' | 'report'
export const DEFAULT_INQUIRY_KIND: InquiryKind = 'inquiry'
```

## 3. 클라이언트
- 라우트: `/support`(inquiry) · `/support/bug` · `/support/report` — 같은 페이지 컴포넌트를 kind 만 바꿔 렌더(`app/(public)/support/page.tsx` 의 본문을 `components/support/InquiryKindPage.tsx` 로 뽑고 두 라우트에서 재사용). 메타데이터 제목: "버그제보", "불법이용제보".
- `SUPPORT_MENU` 5개(아이콘: 버그제보 `icon-bug.svg`, 불법이용제보 `icon-report.svg` — 기존 `icon-faq.svg`(27×26, hasOwnPlate false) 와 같은 선 굵기·크기의 단순 SVG 를 새로 그린다: 버그 = 벌레 실루엣, 제보 = 방패+느낌표). PC 메뉴 5행(374×68 gap 10). 모바일 세그먼트 탭 5개는 343 에 안 들어가므로 **가로 스크롤**(`overflow-x-auto`, 탭 `shrink-0 px-3`, 활성 탭이 보이도록 `scrollIntoView` 불필요 — 첫 화면에 4개 정도 보이면 됨).
- `getInquiryCategories(kind)`: kind 별 조회·캐시 키(`inquiry-categories:<kind>`), 같은 태그 `inquiry-categories`. 폴백도 kind 별(`INQUIRY_CATEGORY_FALLBACK[kind]`; bug/report 폴백 라벨 = 위 표).
- `InquiryForm` props 에 `kind`; `createInquiry` 는 `createInquiry.bind(null, kind)`; 액션은 `getInquiryCategories(kind)` 로 검증하고 insert 에 `kind` 를 넣는다(트리거가 카테고리로 다시 맞추지만 명시). 제출 라벨 `submitLabel`, 접수 완료 모달 문구: inquiry "문의가 접수되었습니다", bug/report "제보가 접수되었습니다"(설명 문장도 "제보"). 필수 항목·첨부·동의·프리필·세부 유형 로직 동일.
- `updateInquiry`: 문의의 `kind` 로 카테고리를 읽는다. 수정 페이지도 kind 전달.
- `InquirySummary`/`InquiryDetail` 에 `kind` 추가. 목록 행 메타 첫 항목에 **종류 라벨**(`1:1 문의 · 버그제보 · 불법이용제보`, 13px pill `bg-[#f1f1f5] text-ink-muted`) 을 두고 그 뒤에 카테고리 › 유형. 상세 메타 줄에도 "종류" 항목. 내 문의 내역은 세 종류 모두(필터 없음, 최신순).
- 상세 뒤로 링크·수정 뒤로 링크는 그대로. 접수 폼 우측 상단 "내 문의 내역 보기" 링크 유지.
- 프록시/리다이렉트 없음. e2e `tests/e2e/support-inquiries.spec.ts` 에 bug/report 접수 1건씩 + 내 문의 내역에 종류 라벨 확인 추가.

## 4. 관리자
- 목록(`/inquiries`): 종류 필터 셀렉트(전체/1:1 문의/버그제보/불법이용제보, `?kind=`) + 표에 종류 뱃지(접수번호 옆). 탭 카운트는 kind 필터를 반영. 카테고리·유형 필터 옵션은 kind 를 고르면 그 kind 의 카테고리만.
- 상세: 메타에 종류. 회원 상세 문의 탭: 종류 라벨.
- 카테고리 관리(`/inquiries/categories`): **kind 별 3개 섹션**(1:1 문의 / 버그제보 / 불법이용제보)으로 나눠 그리고 섹션 안에서 순서 이동·저장(reorder 액션은 같은 kind 의 id 배열). 생성·수정 다이얼로그에 종류 셀렉트(수정 시 kind 를 바꾸면 "이 카테고리로 접수된 문의 N건의 종류도 함께 바뀝니다" 안내). `update_inquiry_category` 9인자 호출. 감사 로그 after 에 kind. 라벨 문구 "카테고리"(말머리 금지).
- 답변 템플릿 카테고리 선택지: `종류 · 라벨` 로 표시(예: `버그제보 · 접속·서버`).
- 감사 라벨(`admin/components/audit/audit-labels.ts`)에 kind 필드 라벨 추가.
- 관리자 e2e(`admin/tests/e2e/inquiry-categories.spec.ts`)·단위 테스트 갱신.

## 5. 문서
`docs/admin/INQUIRY-GUIDE.md|.html`, `INQUIRY-CHANGELOG.md|.html`(+ 아티팩트 본문) 에 kind 모델·라우트·카테고리 이동표·관리자 화면 변경을 추가.
