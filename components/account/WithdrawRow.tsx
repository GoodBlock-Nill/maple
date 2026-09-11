import { ArrowRightGlyph } from '@/components/account/mypage-icons'
import {
  MYPAGE_SECTION_TITLE_CLASS,
  MYPAGE_WITHDRAW_DESC_CLASS,
  MYPAGE_WITHDRAW_TRIGGER_CLASS,
} from '@/components/account/mypage-styles'
import { WithdrawAccountButton } from '@/components/auth/WithdrawAccountButton'
import { WITHDRAWAL_RETENTION_DAYS } from '@/lib/auth/lifecycle'
import { cn } from '@/lib/utils/cn'

const TITLE = '회원 탈퇴'
const RETENTION_LINE = `탈퇴 후 개인정보는 ${WITHDRAWAL_RETENTION_DAYS}일간 보관되며, 이후 삭제됩니다.`
const CONTENT_LINE = '작성한 게시글과 댓글은 삭제되지 않습니다.'

/**
 * 구분선 아래 "회원 탈퇴" 행(시안 §3.3).
 *
 * 1440: 좌측에 제목 + 설명 2줄, 우측에 빨간 트리거 + 화살표 24.
 * 폰(§6): 트리거가 맨 위로 올라오고 설명이 그 아래에 눕는다 — 제목은 트리거와
 * 문구가 같아 중복이라 감춘다(섹션 이름은 `aria-label` 이 계속 들고 있다).
 *
 * 트리거는 기존 탈퇴 확인 모달(`WithdrawAccountButton`)을 그대로 연다. 탈퇴가
 * 끝나면 액션이 홈(`/?notice=withdrawn`)으로 보내고, 거기서 완료 모달이 뜬다.
 */
export function WithdrawRow() {
  return (
    <section
      aria-label={TITLE}
      className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-6"
    >
      {/* 1440 에서는 트리거가 설명 첫 줄과 나란히 선다(시안 실측 y=960.7 · 블록
          상단 931.6 기준 +29). 세로 가운데 정렬로는 그 자리에 오지 않는다. */}
      <div className="order-first sm:order-last sm:mt-[28px]">
        <WithdrawAccountButton
          className={MYPAGE_WITHDRAW_TRIGGER_CLASS}
          label={
            <>
              {TITLE}
              <ArrowRightGlyph className="size-5 sm:size-6" />
            </>
          }
        />
      </div>

      <div className="mt-3 flex flex-col gap-1 sm:mt-0">
        <h2 className={cn(MYPAGE_SECTION_TITLE_CLASS, 'hidden sm:block')}>{TITLE}</h2>
        <p className={MYPAGE_WITHDRAW_DESC_CLASS}>
          {RETENTION_LINE}
          <br />
          {CONTENT_LINE}
        </p>
      </div>
    </section>
  )
}
