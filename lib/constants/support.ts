import type { BoardOption } from '@/lib/constants/board'
import type { FaqCategory } from '@/types/domain'

export type SupportMenuItem = {
  href: string
  label: string
  icon: string
  /** SVG 가 48×48 흰 박스와 그림자를 직접 그리는지 여부. */
  hasOwnPlate: boolean
  /** SVG 원본 크기. 박스를 직접 그리는 자산은 62×62(박스 offset 7,5)다. */
  width: number
  height: number
}

export const SUPPORT_MENU: readonly SupportMenuItem[] = [
  {
    href: '/support',
    label: '1:1 문의하기',
    icon: '/images/support/icon-inquiry.svg',
    hasOwnPlate: true,
    width: 62,
    height: 62,
  },
  {
    href: '/support/faq',
    label: '자주 묻는 질문',
    icon: '/images/support/icon-faq.svg',
    hasOwnPlate: false,
    width: 27,
    height: 26,
  },
]

export const SUPPORT_HEADING = '1:1 문의하기'

export const SUPPORT_DESCRIPTION =
  '이용 중 궁금한 사항이나 불편한 점을 자세히 기재하여 문의해 주세요.'

export const INQUIRY_CATEGORIES: readonly string[] = ['계정', '결제', '버그', '신고', '기타']

export const INQUIRY_TYPES: readonly string[] = ['문의', '신고', '제안']

export const ATTACHMENT_NOTICE = '최대 3개, 각 200MB 이하. (확장자: jpg, png, gif, pdf)'

export const PRIVACY_CONSENT_LABEL = '개인정보 수집 및 이용에 동의합니다.'

export const PRIVACY_CONSENT_LINK_LABEL = '내용 보기'

export const PRIVACY_POLICY_PATH = '/policy/privacy'

/** 인증 연동 전까지 문의 등록 버튼에 붙는 안내 문구. */
export const LOGIN_REQUIRED_INQUIRY_NOTICE = '로그인 후 문의할 수 있습니다'

export const FAQ_CATEGORIES = [
  { value: 'notice', label: '공지사항' },
  { value: 'account', label: '계정' },
  { value: 'payment', label: '결제' },
  { value: 'bug', label: '버그' },
  { value: 'etc', label: '기타' },
] as const satisfies readonly BoardOption<FaqCategory>[]

export const FAQ_CATEGORY_VALUES = FAQ_CATEGORIES.map((category) => category.value)
