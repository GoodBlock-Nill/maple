import { LoginForm } from '@/components/auth/LoginForm'

import type { LoginPrefill } from '@/components/auth/LoginForm'

/**
 * 접혀 있는 이메일 로그인 섹션.
 *
 * `<details>` 를 쓰는 이유: 자바스크립트 없이도 열리고, 닫혀 있는 동안 안쪽 폼이
 * 접근성 트리에서 빠져 스크린 리더가 "로그인 방법이 둘"이라고 읽지 않는다.
 * 기본 로그인 수단은 위쪽 간편로그인이므로 이 섹션은 닫힌 채로 시작한다.
 * 단, 미리 채움 값(로컬 개발용 env)이 있으면 바로 쓸 수 있게 펼쳐 둔다.
 */
export function PasswordLoginSection({
  nextPath,
  prefill,
}: {
  nextPath: string
  prefill?: LoginPrefill
}) {
  const hasPrefill = prefill !== undefined && prefill.email !== ''

  return (
    <details className="border-line mt-5 border-t pt-4" open={hasPrefill}>
      <summary className="text-muted hover:text-ink focus-visible:outline-focus marker:text-muted cursor-pointer list-inside text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
        운영 계정 로그인(이메일)
      </summary>

      <p className="text-muted mt-2 text-[12px] leading-[1.6]">
        간편로그인 연동 전까지 쓰는 부트스트랩 관리자 전용 통로입니다.
      </p>

      <div className="mt-4">
        <LoginForm nextPath={nextPath} prefill={prefill} />
      </div>
    </details>
  )
}
