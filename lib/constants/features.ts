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
} as const
