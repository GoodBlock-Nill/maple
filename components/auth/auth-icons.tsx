/**
 * 로그인 시안(Figma 2UmKcpmy55IqMZ7Sg6vTeW)과 마이페이지가 쓰는 아이콘.
 *
 * `public/images/auth-v2/*.svg`(구글·네이버·notice)와 `public/images/auth/icons/*.svg`
 * (눈·지우기)로 내보낸 원본을 그대로 인라인 컴포넌트로 옮겼다. 파일로 두고
 * `<img>` 로 부르면 처음 그려질 때 아이콘 자리가 비어 깜빡이고, 버튼 안에서
 * 색을 바꿀 수도 없다(같은 이유로 `social-icons.tsx` 도 인라인이다).
 *
 * 색은 시안 원본값을 그대로 박는다 — 브랜드 마크(구글·네이버)는 임의로 바꾸면
 * 각 제공자 심사에서 반려된다.
 */

type IconProps = {
  className?: string
}

/**
 * 구글 G 마크 — 시안 `auth-v2/google.svg`(18×18).
 *
 * 시안은 24 아이콘 상자 안에 18 로고를 넣는다. 상자를 24 로 두고 로고만
 * 18/24 로 그리면 다른 버튼(네이버 24)과 글자 사이 간격이 어긋나지 않는다.
 */
export function GoogleGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className={className}>
      <g transform="translate(3 3)">
        <path
          fill="#FAB409"
          d="M17.825 7.23492H17.1005V7.19893H9.00026V10.7984H14.0854C13.3429 12.895 11.3493 14.3978 9.00026 14.3978C6.01667 14.3978 3.6001 11.9817 3.6001 8.99864C3.6001 6.01561 6.01667 3.59949 9.00026 3.59949C10.3773 3.59949 11.6283 4.11691 12.5824 4.96728L15.1294 2.42068C13.5229 0.922414 11.3718 5.84127e-05 9.00026 5.84127e-05C4.02762 5.84127e-05 0 4.02693 0 8.99864C0 13.9704 4.02762 17.9972 9.00026 17.9972C13.9729 17.9972 18.0005 13.9659 18.0005 8.99864C18.0005 8.39574 17.9375 7.80633 17.825 7.23492Z"
        />
        <path
          fill="#E73B2F"
          d="M1.04313 4.8098L3.99971 6.97846C4.80074 4.99877 6.73579 3.59949 9.00386 3.59949C10.3809 3.59949 11.6319 4.11691 12.586 4.96728L15.133 2.42068C13.5265 0.922414 11.3754 5.84127e-05 9.00386 5.84127e-05C5.54776 5.84127e-05 2.55067 1.95275 1.04313 4.8098Z"
        />
        <path
          fill="#2E9E49"
          d="M9.00062 18.0001C11.3272 18.0001 13.4377 17.1092 15.0353 15.665L12.2497 13.3073C11.3452 13.9912 10.2247 14.4007 9.00062 14.4007C6.66055 14.4007 4.67149 12.9069 3.92447 10.8237L0.990387 13.0869C2.47993 16.0024 5.50402 18.0001 9.00062 18.0001Z"
        />
        <path
          fill="#3A7AF2"
          d="M17.8203 7.23425H17.0958V7.19825H8.99553V10.7977H14.0807C13.7252 11.8055 13.0771 12.6739 12.2401 13.3038L15.0257 15.6614C14.8277 15.8414 17.9913 13.4973 17.9913 8.99797C17.9913 8.39506 17.9283 7.80566 17.8158 7.23425H17.8203Z"
        />
      </g>
    </svg>
  )
}

/** 네이버 N 마크 24 — 시안 `auth-v2/naver.svg`. 초록 버튼 위에 얹는 흰 N 이다. */
export function NaverGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className={className}>
      <path
        fill="#fff"
        d="M8.9547 20.25H3.75V3.75H8.9547L14.8127 12.6483V3.75H20.25V20.25H14.8127L8.9547 12.6483V20.25Z"
      />
    </svg>
  )
}

/** 오류 안내 앞의 느낌표 원 24 — 시안 `auth-v2/notice.svg`. */
export function NoticeGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className={className}>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="#B3261E"
        stroke="#B3261E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 8V12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 16V16.0001" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** 비밀번호 표시 토글 24 — 시안 `icons/eye.svg`(#666 60%). */
export function EyeGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className={className}>
      <path
        fill="#666"
        fillOpacity="0.6"
        d="M22.0828 11.3953C19.8609 6.71484 16.5023 4.35938 12 4.35938C7.49531 4.35938 4.13906 6.71484 1.91719 11.3977C1.82807 11.5864 1.78185 11.7925 1.78185 12.0012C1.78185 12.2099 1.82807 12.416 1.91719 12.6047C4.13906 17.2852 7.49766 19.6406 12 19.6406C16.5047 19.6406 19.8609 17.2852 22.0828 12.6023C22.2633 12.2227 22.2633 11.782 22.0828 11.3953ZM12 17.9531C8.21953 17.9531 5.45156 16.0359 3.49922 12C5.45156 7.96406 8.21953 6.04688 12 6.04688C15.7805 6.04688 18.5484 7.96406 20.5008 12C18.5508 16.0359 15.7828 17.9531 12 17.9531ZM11.9062 7.875C9.62812 7.875 7.78125 9.72188 7.78125 12C7.78125 14.2781 9.62812 16.125 11.9062 16.125C14.1844 16.125 16.0313 14.2781 16.0313 12C16.0313 9.72188 14.1844 7.875 11.9062 7.875ZM11.9062 14.625C10.4555 14.625 9.28125 13.4508 9.28125 12C9.28125 10.5492 10.4555 9.375 11.9062 9.375C13.357 9.375 14.5313 10.5492 14.5313 12C14.5313 13.4508 13.357 14.625 11.9062 14.625Z"
      />
    </svg>
  )
}

/** 입력값 지우기 24 — 시안 `icons/cancel.svg`(#666 60%). */
export function CancelGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className={className}>
      <path
        fill="#666"
        fillOpacity="0.6"
        d="M12 2C6.47 2 2 6.47 2 12C2 17.53 6.47 22 12 22C17.53 22 22 17.53 22 12C22 6.47 17.53 2 12 2ZM16.3 16.3C16.2075 16.3927 16.0976 16.4663 15.9766 16.5164C15.8557 16.5666 15.726 16.5924 15.595 16.5924C15.464 16.5924 15.3343 16.5666 15.2134 16.5164C15.0924 16.4663 14.9825 16.3927 14.89 16.3L12 13.41L9.11 16.3C8.92302 16.487 8.66943 16.592 8.405 16.592C8.14057 16.592 7.88698 16.487 7.7 16.3C7.51302 16.113 7.40798 15.8594 7.40798 15.595C7.40798 15.4641 7.43377 15.3344 7.48387 15.2135C7.53398 15.0925 7.60742 14.9826 7.7 14.89L10.59 12L7.7 9.11C7.51302 8.92302 7.40798 8.66943 7.40798 8.405C7.40798 8.14057 7.51302 7.88698 7.7 7.7C7.88698 7.51302 8.14057 7.40798 8.405 7.40798C8.66943 7.40798 8.92302 7.51302 9.11 7.7L12 10.59L14.89 7.7C14.9826 7.60742 15.0925 7.53398 15.2135 7.48387C15.3344 7.43377 15.4641 7.40798 15.595 7.40798C15.7259 7.40798 15.8556 7.43377 15.9765 7.48387C16.0975 7.53398 16.2074 7.60742 16.3 7.7C16.3926 7.79258 16.466 7.90249 16.5161 8.02346C16.5662 8.14442 16.592 8.27407 16.592 8.405C16.592 8.53593 16.5662 8.66558 16.5161 8.78654C16.466 8.90751 16.3926 9.01742 16.3 9.11L13.41 12L16.3 14.89C16.68 15.27 16.68 15.91 16.3 16.3Z"
      />
    </svg>
  )
}

/**
 * 약관 상세 보기 화살표 24 — 시안 `auth-v2/arrow.svg`.
 * 폰에서는 20 으로 줄여 쓴다(행 높이가 20 이다).
 */
export function ChevronRightGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className={className}>
      <path
        d="M9 6L15 12L9 18"
        stroke="#2A2A37"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 닉네임 지우기 20 — 시안 `auth-v2/clear.svg`(회색 원 안 흰 ×).
 * 마이페이지의 `CancelGlyph`(#666 60% 원)와 표면이 달라 따로 둔다.
 */
export function ClearGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden focusable="false" className={className}>
      <circle cx="10" cy="10" r="8.33333" fill="#545461" stroke="#545461" strokeLinejoin="round" />
      <path d="M12.5 7.5L7.5 12.5" stroke="#fff" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M12.5 12.5L7.5 7.5" stroke="#fff" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 체크박스 On 22 — 시안 `auth-v2/check-on.svg`(검정 채움 + 흰 체크).
 *
 * CSS `:checked` + `background-image` 로도 같은 그림이 나오지만, 그 방식은 체크
 * 상태를 **브라우저의 의사 클래스**와 **파일 요청**에 맡긴다. 리액트 상태로
 * 그리면(전체 동의가 네 칸을 한꺼번에 켜는 화면이다) 상태와 그림이 갈라질 여지가
 * 없고, 자산을 못 받아도 체크가 사라지지 않는다.
 */
export function CheckOnGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden focusable="false" className={className}>
      <rect width="22" height="22" rx="4" fill="#2A2A2A" />
      <path
        d="M6 10.5L9.33333 14L16 7"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
