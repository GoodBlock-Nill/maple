import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 회원 화면에는 **관리자 권한을 주는 길이 없어야 한다**(2026-09-09 제품 결정).
 *
 * 관리자는 `/admins` 의 이메일 초대로만 만들어진다. 회원 상세에 승격 버튼이 되살아나면
 * 권한이 생기는 경로가 둘이 되고, 그때 부여되는 역할(`admin_role_id`)이 비어 있어
 * "관리자인데 아무 화면도 못 보는" 계정이 만들어진다.
 *
 * 소스를 읽어 확인하는 이유: 렌더 테스트는 컴포넌트를 지웠을 때가 아니라 **되살렸을
 * 때** 통과해 버린다(빈 화면도 통과한다). 파일이 존재하는지가 곧 계약이다.
 */

const adminRoot = path.join(__dirname, '..', '..')

function read(relative: string): string {
  return readFileSync(path.join(adminRoot, relative), 'utf8')
}

describe('회원 모듈 — 관리자 승격 제거', () => {
  it('should not ship a member role action module', () => {
    expect(existsSync(path.join(adminRoot, 'lib/actions/member-role-actions.ts'))).toBe(false)
  })

  it('should not define a role change schema on the member validation module', () => {
    expect(read('lib/validation/members.ts')).not.toContain('changeRoleSchema')
  })

  it('should keep suspension and nickname but drop the role buttons', () => {
    const source = read('components/members/MemberActions.tsx')

    expect(source).toContain('MemberSuspendDialog')
    expect(source).toContain('MemberNicknameDialog')
    expect(source).not.toContain('관리자 권한 부여')
    expect(source).not.toContain('관리자 권한 회수')
    expect(source).not.toContain('changeMemberRoleAction')
  })

  it('should not pass a role into the member detail actions', () => {
    expect(read('app/(admin)/members/[id]/page.tsx')).not.toContain('role={member.role}')
  })
})

/**
 * 탈퇴·파기 조작은 **삭제 버튼이 아니다**. 계정 행은 남고 글·댓글도 남는다.
 *
 * 소스를 읽어 확인하는 이유는 위와 같다 — 렌더 테스트는 컨트롤이 사라졌을 때가
 * 아니라 **되살아났을 때** 통과해 버린다. 특히 즉시 파기는 되돌릴 수 없으므로
 * "슈퍼어드민 · 탈퇴 대기 · 본인 아님" 세 조건이 화면에서 빠지면 안 된다.
 */
describe('회원 모듈 — 탈퇴 · 파기 컨트롤', () => {
  it('should gate the purge button behind super admin, withdrawn and not-self', () => {
    const source = read('components/members/MemberActions.tsx')

    expect(source).toContain('MemberPurgeDialog')
    expect(source).toContain("lifecycle === 'withdrawn' && isSuperAdmin && !isSelf")
  })

  it('should offer force withdrawal only for active members other than yourself', () => {
    const source = read('components/members/MemberActions.tsx')

    expect(source).toContain('MemberForceWithdrawDialog')
    expect(source).toContain("lifecycle === 'active' && !isSelf")
  })

  it('should drop every write control once the account is purged', () => {
    const source = read('components/members/MemberActions.tsx')

    expect(source).toContain("if (lifecycle === 'purged')")
  })

  it('should spell out what actually happens in the confirm dialogs', () => {
    const purge = read('components/members/MemberPurgeDialog.tsx')
    const withdraw = read('components/members/MemberForceWithdrawDialog.tsx')

    expect(purge).toContain('개인정보 즉시 파기')
    expect(purge).toContain('되돌릴 수 없습니다')
    expect(purge).toContain('작성한 글과 댓글은 남고')
    expect(purge).toContain('파기 중…')

    expect(withdraw).toContain('90일 후 개인정보가 파기되며')
    expect(withdraw).toContain('진행 중인 이용 제한은 유지됩니다')
    expect(withdraw).toContain('탈퇴 처리 중…')
  })

  it('should hide personal information for purged members', () => {
    const source = read('components/members/MemberProfileCard.tsx')

    expect(source).toContain('isPurged')
    expect(source).toContain('{!isPurged && (')
  })
})

describe('로그인 — 간편로그인 제거', () => {
  it('should not ship social sign-in components', () => {
    for (const file of [
      'components/auth/SocialSignInButtons.tsx',
      'components/auth/social-icons.tsx',
      'components/auth/social-providers.tsx',
      'components/auth/PasswordLoginSection.tsx',
    ]) {
      expect(existsSync(path.join(adminRoot, file)), file).toBe(false)
    }
  })

  it('should not export social sign-in actions', () => {
    const source = read('lib/actions/auth-actions.ts')

    expect(source).not.toContain('socialSignInAction')
    expect(source).not.toContain('socialSignInFormAction')
  })

  it('should render the plain password form on the login page', () => {
    const source = read('app/(auth)/login/page.tsx')

    expect(source).toContain('LoginForm')
    expect(source).toContain('초대받은 관리자 계정으로 로그인하세요.')
    expect(source).toContain('ADMIN_LOGIN_PREFILL_EMAIL')
    expect(source).not.toContain('SOCIAL_LOGIN_MODE')
    expect(source).not.toContain('ADMIN_PASSWORD_LOGIN')
  })

  it('should keep the password reset link on the form', () => {
    expect(read('components/auth/LoginForm.tsx')).toContain('/forgot-password')
  })
})
