/**
 * 마이페이지 v2 시안(Figma 2UmKcpmy55IqMZ7Sg6vTeW · 166:13113 · 166:13195)의 표면값.
 *
 * 1440 기준 실측값을 그대로 박는다. 근거는 `docs/reference/figma/mypage-v2-spec.md`
 * 이고, 숫자는 시안 PNG 를 1440 으로 되돌려 픽셀로 다시 잰 값이다.
 *
 *   카드 상단 461 → (border 1 + padding 32) → 라벨 박스(line 26) → gap 10 →
 *   입력 54 → gap 24 → 다음 필드 → padding 32 → 카드 하단 730
 *   → gap 32 → "마케팅 수신 설정" 제목(26) → gap 24 → 박스 56
 *   → gap 32 → 구분선 → gap 32 → 회원 탈퇴 블록
 *
 * 폰(375)은 시안 §6 값이다 — 카드 패딩 12, 입력 42, 버튼 48, 체크박스 18.
 */

/** 1440 기준 골격 — 컨테이너 1200 = 사이드바 268 + gap 32 + 콘텐츠 900. */
export const MYPAGE_SIDEBAR_WIDTH = 268
export const MYPAGE_CONTENT_WIDTH = 900

/* -------------------------------------------------------------------------- */
/* 카드                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 콘텐츠 카드 900 — bg white · border #cdd3db · radius 20 · padding 32/24.
 * 폰에서는 패딩 12(시안 §6) 이고 세그먼트 탭이 카드 맨 위에 붙으므로 상단 패딩은
 * 탭 줄이 직접 만든다 — 카드 자체는 패딩을 주지 않고 내부 블록이 나눠 갖는다.
 */
export const MYPAGE_CARD_CLASS =
  'shadow-chip border-line-soft w-full overflow-hidden rounded-[20px] border bg-white'

/**
 * 카드 안쪽 여백 — 폰 12 / 1440 24·32.
 *
 * 좌우는 23 이다. 시안의 24 는 테두리를 포함한 값이라 border 1 을 빼야 입력 왼쪽
 * 모서리가 시안(x=444)과 같은 자리에 선다. 아래는 30 인데, 한글 라벨의 실제 줄
 * 상자가 시안보다 1.5px 높아 그대로 두면 카드가 269 대신 270.5 가 되고 그 아래
 * (마케팅 박스 · 구분선 · 탈퇴 행 · 푸터)가 전부 밀린다 — 시안 실측 보정값이다.
 */
export const MYPAGE_CARD_BODY_CLASS = 'p-3 sm:px-[23px] sm:pt-8 sm:pb-[30px]'

/* -------------------------------------------------------------------------- */
/* 필드                                                                        */
/* -------------------------------------------------------------------------- */

/** 라벨 — Medium 18/26 tracking −0.45(폰 16/22). */
export const MYPAGE_LABEL_CLASS =
  'text-ink block text-[16px] leading-[22px] font-medium tracking-[-0.4px] sm:text-[18px] sm:leading-[26px] sm:tracking-[-0.45px]'

/** 입력 413×54 — white · border #e5e5ec · radius 10 · padding 16 (폰 h42). */
export const MYPAGE_INPUT_CLASS =
  'h-[42px] w-full rounded-[10px] border border-[#e5e5ec] bg-white px-4 text-[15px] font-medium text-ink ' +
  'placeholder:text-[#a5adb8] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:bg-[#f1f1f5] disabled:text-[#999] sm:h-[54px] sm:text-[16px]'

/** 읽기 전용(이메일) — bg #f1f1f5 · 텍스트 #999. */
export const MYPAGE_INPUT_READONLY_CLASS = 'bg-[#f1f1f5] text-[#999] read-only:text-[#999]'

/** 입력 폭 — 1440 에서 413 고정, 폰에서는 카드 안쪽 폭을 채운다. */
export const MYPAGE_FIELD_WIDTH_CLASS = 'w-full sm:w-[413px]'

/** 입력 아래 도움말 — Medium 12 / line 1.45 / #727272. */
export const MYPAGE_HINT_CLASS = 'text-[12px] leading-[1.45] font-medium text-[#727272]'

/** 필드 오류 — 인증 화면과 같은 색. */
export const MYPAGE_ERROR_CLASS = 'mt-[6px] text-[13px] leading-[20px] text-[#ee1d52]'

/** 저장 성공 안내(닉네임 변경 등). */
export const MYPAGE_NOTICE_CLASS = 'mt-[6px] text-[13px] leading-[20px] text-[#0067ff]'

/* -------------------------------------------------------------------------- */
/* 버튼                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 알약 버튼 — h54 · radius 100 · bg #2a2a2a · Semibold 18(폰 h48 · 16).
 * 폭은 쓰는 쪽이 정한다("변경하기" 99 · "계정 연동하기" 183).
 */
export const MYPAGE_PILL_BUTTON_CLASS =
  'inline-flex h-12 shrink-0 items-center justify-center rounded-[100px] bg-ink text-[16px] font-semibold ' +
  'text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40 sm:h-[54px] sm:text-[18px]'

/* -------------------------------------------------------------------------- */
/* 사이드바 · 세그먼트 탭                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 탭 한 칸 — padding 10 · gap 10 · radius 10.
 *
 * 비활성 탭도 **투명 테두리**를 갖는다. 활성 탭에서만 border 를 켜면 1px 만큼
 * 아이콘이 밀려 탭을 옮길 때마다 글자가 흔들린다.
 */
export const MYPAGE_TAB_CLASS =
  'flex items-center gap-[10px] rounded-[10px] border border-transparent p-[10px] transition-colors'

export const MYPAGE_TAB_ACTIVE_CLASS = 'border-line-soft shadow-chip bg-white'

/** 아이콘 박스 48 — white · border #cdd3db · radius 5 · shadow 0 2 7 rgba(0,0,0,.25). */
export const MYPAGE_TAB_ICON_BOX_CLASS =
  'border-line-soft flex size-12 shrink-0 items-center justify-center rounded-[5px] border bg-white ' +
  'shadow-[0_2px_7px_rgba(0,0,0,0.25)]'

/** 탭 라벨 — Medium 20/28 tracking −0.5. */
export const MYPAGE_TAB_LABEL_CLASS =
  'text-ink text-[20px] leading-[28px] font-medium tracking-[-0.5px] whitespace-nowrap'

/**
 * "준비중" 배지 — 사이드바 48×30.
 *
 * 스펙 문서(§2)는 "연핑크 + #e8308a" 라고 적었지만 시안 PNG 실측은 회색이다
 * (바탕 #f1f1f5 · 글자 #727272). 화면은 시안 이미지와 맞춰야 하므로 실측값을 쓴다.
 */
export const MYPAGE_BADGE_CLASS =
  'inline-flex h-[30px] w-[48px] shrink-0 items-center justify-center rounded-[100px] ' +
  'bg-[#f1f1f5] text-[14px] leading-[20px] font-medium text-[#727272]'

/** 같은 배지의 폰 크기(세그먼트 탭 안, 49×25 · 12/18). */
export const MYPAGE_BADGE_SM_CLASS =
  'inline-flex h-[25px] w-[49px] shrink-0 items-center justify-center rounded-[100px] ' +
  'bg-[#f1f1f5] text-[12px] leading-[18px] font-medium text-[#727272]'

/* -------------------------------------------------------------------------- */
/* 블록 구분                                                                   */
/* -------------------------------------------------------------------------- */

/** 카드 아래 구분선(시안 실측 #e3e5e9). */
export const MYPAGE_DIVIDER_CLASS = 'border-line border-0 border-t'

/** 섹션 제목("마케팅 수신 설정" · "회원 탈퇴") — Medium 18/26. */
export const MYPAGE_SECTION_TITLE_CLASS =
  'text-ink text-[16px] leading-[24px] font-medium sm:text-[18px] sm:leading-[26px]'

/** 마케팅 동의 박스 900×56 — white · border #d5d9df · radius 12. */
export const MYPAGE_CONSENT_BOX_CLASS =
  'border-field-line flex h-14 w-full cursor-pointer items-center gap-3 rounded-[12px] border bg-white px-4 ' +
  'focus-within:outline-focus focus-within:outline-2'

/** 회원 탈퇴 트리거 — Medium 16 #b3261e + 화살표 24(폰 15 · 20). */
export const MYPAGE_WITHDRAW_TRIGGER_CLASS =
  'focus-visible:outline-focus inline-flex items-center gap-1 rounded-[4px] text-[15px] leading-[24px] ' +
  'font-medium text-[#b3261e] transition-opacity hover:opacity-80 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 sm:text-[16px]'

/** 회원 탈퇴 설명 2줄 — Medium 14/20 #727272(폰도 같다). */
export const MYPAGE_WITHDRAW_DESC_CLASS = 'text-[14px] leading-[20px] font-medium text-[#727272]'

/* -------------------------------------------------------------------------- */
/* 레거시 — `InquiryTable`(라우트에서 빠진 문의내역 표) 전용                    */
/* -------------------------------------------------------------------------- */

/**
 * v1 시안(2041:2958)의 카드 표면. v2 에서 문의내역 탭이 사라지면서 쓰는 곳이
 * `components/account/InquiryTable.tsx` 하나만 남았다 — 그 컴포넌트는 고객지원
 * 쪽에서 다시 쓸 수 있어 파일을 남기기로 했으므로(오너 지시) 표면값도 함께 남긴다.
 */
export const MYPAGE_LEGACY_CARD_CLASS =
  'shadow-chip border-line-soft flex w-full flex-col gap-8 rounded-[20px] border bg-white px-5 py-8 sm:px-6'

export const MYPAGE_LEGACY_CARD_TITLE_CLASS =
  'text-ink text-[22px] leading-[24px] font-medium tracking-[-0.2px] sm:text-[27px]'

export const MYPAGE_LEGACY_HELP_CLASS = 'text-ui leading-[21px] text-[rgba(102,102,102,0.6)]'
