import Link from 'next/link'

import { AuthCard } from '@/components/auth/AuthCard'
import { SetPasswordForm } from '@/components/auth/SetPasswordForm'
import { createClient } from '@/lib/supabase/server'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '관리자 초대 수락',
}

/**
 * 초대 메일 링크의 최종 착지점.
 *
 * `/auth/callback` 이 초대 토큰을 세션으로 바꾼 뒤 여기로 보낸다. 그 시점에 계정은
 * 이미 관리자다 — `handle_new_user()` 트리거가 초대 행을 보고 role 과 역할을 함께
 * 넣기 때문이다. 그래서 이 화면이 하는 일은 **비밀번호를 정하는 것 하나뿐**이다.
 *
 * 세션 유무를 여기서 검사하지 않는다. 링크를 막 통과한 직후에는 프록시가 세션을
 * 세운 뒤라 결과가 흔들린다. 세션이 없으면 `setPasswordAction` 이 "링크가
 * 만료되었습니다"로 정확히 안내한다.
 */
/**
 * 초대 링크가 세션을 만들어 준 상태에서만 폼을 그린다. 링크가 만료됐거나 이미 쓰인
 * 경우(세션 없음) 비밀번호 폼을 보여 주면 제출 뒤에야 실패를 알게 되므로, 먼저
 * 재발송을 요청하라는 안내로 바꿔 보여 준다.
 */
export default async function InviteAcceptPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return (
      <AuthCard
        title="초대 링크를 확인할 수 없습니다"
        description="링크가 만료되었거나 이미 사용되었습니다. 슈퍼어드민에게 초대 재발송을 요청해 주세요."
      >
        <Link
          href="/login"
          className="text-accent-strong focus-visible:outline-focus self-center text-[13px] font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          이미 비밀번호를 정했다면 로그인
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="관리자 초대 수락"
      description="사용할 비밀번호를 정하면 관리자 콘솔에 들어갑니다."
    >
      <SetPasswordForm submitLabel="비밀번호 설정하고 시작하기" />
    </AuthCard>
  )
}
