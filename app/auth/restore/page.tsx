import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/AuthCard'
import { RestoreAccountForm } from '@/components/auth/RestoreAccountForm'
import {
  canRestoreProfile,
  isWithdrawnProfile,
  PURGED_ACCOUNT_MESSAGE,
  restoreNotice,
} from '@/lib/auth/lifecycle'
import { createClient } from '@/lib/supabase/server'
import { firstValue } from '@/lib/utils/list-query'
import { RESTORE_PATH, sanitizePostAuthPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '계정 복구',
  description: '탈퇴 대기 중인 계정을 복구합니다.',
  robots: { index: false, follow: false },
}

/**
 * 탈퇴 대기 계정의 재로그인 안내.
 *
 * 프록시·로그인 경로가 `deleted_at` 있는 계정을 여기로 보낸다. "계정 복구"를 누르면
 * `deleted_at` 만 비워지고(상태값만 변경), 닉네임·월드 계정·제재는 그대로다.
 * 파기가 끝난 계정(purged_at)은 복구할 수 없다는 사유와 로그아웃만 보인다.
 */
export default async function RestorePage(props: PageProps<'/auth/restore'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizePostAuthPath(firstValue(searchParams.next))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(RESTORE_PATH)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('deleted_at, purged_at')
    .eq('id', user.id)
    .maybeSingle()

  // 정상 회원이 주소로 직접 들어온 경우. 물을 것이 없다.
  if (!isWithdrawnProfile(profile)) {
    redirect(nextPath)
  }

  const canRestore = canRestoreProfile(profile)

  return (
    <AuthCard
      title="계정 복구"
      description={canRestore ? restoreNotice(profile?.deleted_at) : PURGED_ACCOUNT_MESSAGE}
    >
      <RestoreAccountForm nextPath={nextPath} canRestore={canRestore} />
    </AuthCard>
  )
}
