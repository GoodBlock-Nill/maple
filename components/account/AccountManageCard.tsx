import { AccountField } from '@/components/account/AccountField'
import {
  MYPAGE_CARD_BODY_CLASS,
  MYPAGE_CARD_CLASS,
  MYPAGE_FIELD_WIDTH_CLASS,
  MYPAGE_INPUT_CLASS,
  MYPAGE_INPUT_READONLY_CLASS,
} from '@/components/account/mypage-styles'
import { MyPageTabBar } from '@/components/account/MyPageTabBar'
import { NicknameField } from '@/components/account/NicknameField'
import { cn } from '@/lib/utils/cn'

const EMPTY_EMAIL = '-'
const EMAIL_FIELD_ID = 'account-email'

type AccountManageCardProps = {
  activeHref: string
  nickname: string
  /** 간편로그인 계정은 제공자 이메일. 없으면 "-" 로 그린다. */
  email: string | null
}

/**
 * "계정 관리" 카드(시안 §3.1) — 닉네임(변경 가능) · 이메일(읽기 전용).
 *
 * 이메일은 바꿀 수 없다. 로그인 수단 자체라 변경에는 별도 인증 절차(메일 확인)가
 * 필요하고, 시안에도 그 흐름이 없다.
 *
 * v1 에 있던 아바타·이름·비밀번호 카드는 시안 v2 에서 통째로 빠졌다.
 */
export function AccountManageCard({ activeHref, nickname, email }: AccountManageCardProps) {
  return (
    <section aria-label="계정 관리" className={MYPAGE_CARD_CLASS}>
      <MyPageTabBar activeHref={activeHref} />

      <div className={cn(MYPAGE_CARD_BODY_CLASS, 'flex flex-col gap-6')}>
        <NicknameField nickname={nickname} />

        <AccountField label="이메일" htmlFor={EMAIL_FIELD_ID}>
          <input
            id={EMAIL_FIELD_ID}
            type="text"
            readOnly
            aria-readonly
            value={email ?? EMPTY_EMAIL}
            className={cn(
              MYPAGE_INPUT_CLASS,
              MYPAGE_INPUT_READONLY_CLASS,
              MYPAGE_FIELD_WIDTH_CLASS,
            )}
          />
        </AccountField>
      </div>
    </section>
  )
}
