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
