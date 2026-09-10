/**
 * 기능 플래그.
 *
 * `NEXT_PUBLIC_` 접두사가 붙은 값은 Next.js 가 빌드 타임에 클라이언트·서버 번들
 * 양쪽 모두에서 리터럴로 치환한다(node_modules/next/dist/docs 의 환경 변수 문서
 * 참고). 그래서 서버 컴포넌트·서버 액션·클라이언트 컴포넌트가 이 상수 하나를
 * 그대로 같이 써도 되고, 별도의 서버 전용 게터가 필요 없다.
 *
 * 오너 요청: 메이플스토리 월드 UID·프로필 코드 입력은 지우지 말고 "안 보이게
 * 비활성화"만 한다. 컬럼·마이그레이션은 그대로 두고, 이 플래그로 노출 여부만
 * 제어한다. 기본값은 OFF — 추후 요청이 오면 배포 환경 변수만 `true` 로 바꾼다.
 */
export const FEATURES = {
  mswAccountFields: process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS === 'true',
  /**
   * 자유게시판 글쓰기·댓글을 월드 계정(UID)이 연동된 회원에게만 연다
   * (docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md 피드백 7 · 오너 결정 4: 준비만 하고 기본 OFF).
   * 켜는 시점은 오너가 정한다. 켜면 `mswAccountFields` 도 함께 켜야 연동 경로가 열린다.
   */
  postingRequiresMswLink: process.env.NEXT_PUBLIC_FEATURE_POSTING_REQUIRES_MSW === 'true',
  /**
   * 가이드(확률형 아이템 정보)·랭킹의 "서비스 준비 중" 화면. 개발팀이 실제 화면을
   * 보며 개발해야 하므로 기본값은 OPEN(준비 중 화면 OFF)이고, 오픈 전 잠시 막고
   * 싶을 때만 배포 환경 변수 `NEXT_PUBLIC_FEATURE_*_COMING_SOON=true` 로 켠다.
   */
  guideOpen: process.env.NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON !== 'true',
  rankingOpen: process.env.NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON !== 'true',
  /**
   * 소개(About) 메뉴 비활성화(오너 요청 — "버튼이 안 보이게"). 가이드·랭킹과
   * 반대로 기본값이 ON(비활성화)이다 — 오너가 다시 열고 싶을 때 배포 환경
   * 변수를 리터럴 `'false'` 로 명시해야만 켜진다(오탈자·빈 문자열로 실수
   * 노출되지 않도록 화이트리스트 방식). 켜져 있으면 헤더·드로어·푸터 메뉴
   * 목록에서 소개 항목이 통째로 빠지고(자리표시 없음), `proxy.ts` 가
   * `/about`(과 하위 경로)을 `/` 로 돌려보낸다.
   */
  aboutDisabled: process.env.NEXT_PUBLIC_FEATURE_ABOUT_DISABLED !== 'false',
} as const
