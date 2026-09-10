import { WithdrawAccountButton } from '@/components/auth/WithdrawAccountButton'
import { WITHDRAWAL_RETENTION_DAYS } from '@/lib/auth/lifecycle'

const TRIGGER_CLASS =
  'focus-visible:outline-focus self-start rounded-[4px] text-label-lg leading-[24px] font-medium ' +
  'text-[#c84545] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2'

const BULLETS = [
  `회원 탈퇴 시 ${WITHDRAWAL_RETENTION_DAYS}일 동안 데이터가 보관되며, 이후 영구 삭제됩니다.`,
  '글자월드는 정상적으로 플레이할 수 있습니다.',
] as const

/**
 * 마지막 카드 아래의 "홈페이지 회원 탈퇴" 블록(시안 §3, 폭 478).
 *
 * 시안에서는 제목 자체가 탈퇴 확인 모달의 트리거다 — 별도 버튼을 두면 시안에 없는
 * 요소가 생기고, 제목을 장식으로만 두면 탈퇴 경로가 사라진다. 문구를 빨강(#c84545)
 * 으로만 구분하지 않도록 실제 동작(모달)까지 제목에 붙인다.
 */
export function WithdrawBlock() {
  return (
    <section aria-labelledby="withdraw-heading" className="flex max-w-[478px] flex-col gap-[10px]">
      {/* 제목이 곧 트리거다. 헤딩은 레이아웃에 아무 여백도 더하지 않는다(preflight). */}
      <h2 id="withdraw-heading" className="flex">
        <WithdrawAccountButton label="홈페이지 회원 탈퇴" className={TRIGGER_CLASS} />
      </h2>

      <ul className="text-ui ms-[25.5px] list-disc leading-[22px] font-medium text-[rgba(102,102,102,0.6)]">
        {BULLETS.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  )
}
