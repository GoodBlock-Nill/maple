import { MARKETING_CONSENT_HEADING } from '@/lib/content/marketing-consent'
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@/lib/validation/auth'

/**
 * 회원가입(온보딩) 화면 문안 — 시안 `docs/reference/figma/auth-v2-spec.md`
 * "회원가입(온보딩) v2 시안" 그대로다.
 *
 * 서버 액션(중복 닉네임 안내)과 클라이언트 폼(즉시 검증)이 **같은 문장**을 써야
 * 해서 화면 밖으로 뺐다. 마이페이지의 닉네임 문구(`NICKNAME_TAKEN_MESSAGE`,
 * "…입니다")와 어미가 다르다 — 회원가입 시안은 "…이에요" 체다.
 */
export const ONBOARDING_COPY = {
  title: '회원가입',
  subtitle: '글자월드 이용을 위해 약관에 동의해 주세요.',
  nicknameLabel: '닉네임',
  nicknamePlaceholder: '닉네임을 입력해주세요',
  /** 비어 있을 때의 도움말. 규칙 전체를 알려 준다. */
  nicknameHint: `${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자의 한글·영문·숫자·밑줄만 사용할 수 있어요.`,
  /** 한 글자라도 입력한 뒤의 도움말(시안 Input_Typing). */
  nicknameHintTyping: '한글·영문·숫자·밑줄만 쓸 수 있습니다',
  nicknameInvalid: '한글·영문·숫자·밑줄만 사용할 수 있어요.',
  nicknameTaken: '이미 사용 중인 닉네임이에요.',
  nicknameClear: '닉네임 지우기',
  agreeAll: '전체 동의',
  agreeAllDescription: '선택 항목을 포함하여 모든 약관에 동의합니다.',
  ageConfirm: '만 14세 이상입니다',
  submit: '동의하고 시작하기',
  submitPending: '저장 중…',
  failureTitle: '회원가입에 실패했어요.',
  failureBody: ['일시적인 오류로 회원가입을 완료하지 못했어요.', '잠시 후 다시 시도해 주세요.'],
  retry: '다시 시도하기',
  backToLogin: '로그인으로 돌아가기',
} as const

/** 동의 체크박스의 FormData 이름. 서버 액션(`completeOnboarding`)과 짝이다. */
export type ConsentName = 'termsAgreed' | 'privacyAgreed' | 'marketingAgreed'

export type ConsentItem = {
  name: ConsentName
  /** false 면 [선택] 항목이다. 버튼 활성 조건에 들어가지 않는다. */
  required: boolean
  label: string
  /** 오른쪽 화살표의 접근성 이름. */
  detailLabel: string
  /**
   * 상세 보기 방식.
   *  - `href`: 발행된 정책 문서를 새 탭으로 연다(입력 중인 값을 잃지 않는다).
   *  - `dialog`: 발행 문서가 없는 마케팅 안내. 같은 화면의 모달로 연다.
   */
  href: string | null
}

/**
 * "서비스 이용약관"의 목적지는 `/policy/operating`(글자월드 운영정책)이다.
 * 이 사이트에는 이용약관이라는 별도 발행 문서가 없고, 온보딩의
 * `terms_agreed_at` 이 가리키는 문서가 원래 이 운영정책이다 — 시안 문구만
 * "서비스 이용약관"으로 바뀌었을 뿐 동의 대상은 그대로다.
 */
export const CONSENT_ITEMS: readonly ConsentItem[] = [
  {
    name: 'termsAgreed',
    required: true,
    label: '서비스 이용약관',
    detailLabel: '이용약관 보기',
    href: '/policy/operating',
  },
  {
    name: 'privacyAgreed',
    required: true,
    label: '개인정보 수집・이용 동의',
    detailLabel: '개인정보처리방침 보기',
    href: '/policy/privacy',
  },
  {
    name: 'marketingAgreed',
    required: false,
    label: MARKETING_CONSENT_HEADING,
    detailLabel: '마케팅 수신 안내 보기',
    href: null,
  },
]
