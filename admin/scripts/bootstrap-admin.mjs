#!/usr/bin/env node
/**
 * 첫 관리자 계정 생성 (PLAN.md §2 "첫 관리자: 시드 스크립트").
 *
 * 초대 흐름은 "이미 있는 관리자"를 전제한다. 그 첫 사람은 어디선가 와야 하고,
 * 화면에서 만들 수 있게 하면 그것이 곧 누구나 관리자가 되는 창구가 된다.
 * 그래서 서비스 롤 키를 쥔 사람만 실행할 수 있는 스크립트로 분리한다.
 *
 * 사용법:
 *   ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=... pnpm --filter @maple/admin bootstrap:admin
 *   (값을 admin/.env.local 에 적어 두고 인자 없이 실행해도 된다)
 *
 * 하는 일
 *   1) admin_roles 에서 super_admin 역할 id 를 읽는다(마이그레이션이 시드한 시스템 역할).
 *   2) admin_invites 에 그 역할을 실은 초대 행을 만든다 — handle_new_user() 트리거가
 *      이 행을 보고 role='admin' + admin_role_id 를 준다. **계정 생성보다 먼저** 넣어야 한다.
 *   3) auth 사용자를 만든다(email_confirm: true — 메일 확인 없이 바로 로그인).
 *   4) 이미 있는 계정이면 비밀번호만 재설정하고 권한을 보정한다.
 *   5) profiles 의 role·admin_role_id 가 실제로 슈퍼어드민인지 확인하고, 아니면 고친다.
 *
 * 비밀번호는 절대 표준 출력에 찍지 않는다.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const adminRoot = join(scriptDir, '..')

loadEnvFile(join(adminRoot, '.env.local'))

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const email = requireEnv('ADMIN_BOOTSTRAP_EMAIL').trim().toLowerCase()
const password = requireEnv('ADMIN_BOOTSTRAP_PASSWORD')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

await main()

async function main() {
  const superAdminRoleId = await readSuperAdminRoleId()
  const inviteId = await ensureInvite(email, superAdminRoleId)
  const userId = await ensureUser(email, password)

  await supabase
    .from('admin_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inviteId)

  const role = await ensureSuperAdmin(userId, superAdminRoleId)

  console.log('[bootstrap] 완료')
  console.log(`  이메일 : ${email}`)
  console.log(`  user id: ${userId}`)
  console.log(`  role   : ${role}`)
  console.log('  비밀번호는 출력하지 않습니다. 실행에 사용한 값을 그대로 쓰세요.')
}

/** 시스템 역할 super_admin. 마이그레이션 20260909000200 이 시드한다. */
async function readSuperAdminRoleId() {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('key', 'super_admin')
    .maybeSingle()

  if (error) {
    fail(`역할 조회 실패: ${error.message}`)
  }

  if (!data) {
    fail('super_admin 역할이 없습니다. supabase db push 로 마이그레이션을 먼저 적용하세요.')
  }

  return data.id
}

/** 초대 행이 있으면 pending 으로 되살리고, 없으면 만든다. */
async function ensureInvite(targetEmail, roleId) {
  const { data: existing, error: selectError } = await supabase
    .from('admin_invites')
    .select('id')
    .ilike('email', targetEmail)
    .maybeSingle()

  if (selectError) {
    fail(`초대 조회 실패: ${selectError.message}`)
  }

  if (existing) {
    const { error } = await supabase
      .from('admin_invites')
      .update({ status: 'pending', accepted_at: null, role_id: roleId, expires_at: null })
      .eq('id', existing.id)

    if (error) {
      fail(`초대 갱신 실패: ${error.message}`)
    }

    return existing.id
  }

  const { data, error } = await supabase
    .from('admin_invites')
    .insert({ email: targetEmail, status: 'pending', role_id: roleId })
    .select('id')
    .single()

  if (error) {
    fail(`초대 생성 실패: ${error.message}`)
  }

  return data.id
}

/** 계정을 만들거나, 이미 있으면 비밀번호를 재설정한다. */
async function ensureUser(targetEmail, targetPassword) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: targetEmail,
    password: targetPassword,
    email_confirm: true,
  })

  if (!error && data.user) {
    console.log('[bootstrap] 새 계정을 만들었습니다.')

    return data.user.id
  }

  const existingId = await findUserIdByEmail(targetEmail)

  if (!existingId) {
    fail(`계정 생성 실패: ${error?.message ?? '알 수 없는 오류'}`)
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existingId, {
    password: targetPassword,
    email_confirm: true,
  })

  if (updateError) {
    fail(`비밀번호 재설정 실패: ${updateError.message}`)
  }

  console.log('[bootstrap] 이미 있는 계정의 비밀번호를 재설정했습니다.')

  return existingId
}

/** listUsers 는 페이지네이션이 있다. 첫 몇 페이지만 훑어도 시드 단계에서는 충분하다. */
async function findUserIdByEmail(targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })

    if (error) {
      fail(`사용자 조회 실패: ${error.message}`)
    }

    const match = data.users.find((user) => (user.email ?? '').toLowerCase() === targetEmail)

    if (match) {
      return match.id
    }

    if (data.users.length < 200) {
      return null
    }
  }

  return null
}

/** 트리거가 이미 admin + super_admin 을 줬어야 정상이다. 아니면 여기서 마지막으로 고친다. */
async function ensureSuperAdmin(userId, roleId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, admin_role_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    fail(`프로필 조회 실패: ${error.message}`)
  }

  if (data?.role === 'admin' && data?.admin_role_id === roleId) {
    return 'admin / super_admin'
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin', admin_role_id: roleId })
    .eq('id', userId)

  if (updateError) {
    fail(`권한 부여 실패: ${updateError.message}`)
  }

  console.log('[bootstrap] 트리거가 권한을 주지 않아 직접 슈퍼어드민으로 올렸습니다.')

  return 'admin / super_admin'
}

/** 의존성 없이 .env 를 읽는다(dotenv 를 넣자고 패키지를 늘리지 않는다). */
function loadEnvFile(path) {
  let raw

  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }

  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)

    if (!match) {
      continue
    }

    const [, key, rawValue] = match

    if (process.env[key] !== undefined) {
      continue
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

function requireEnv(name) {
  const value = process.env[name]

  if (!value || value.trim() === '') {
    fail(`환경 변수 ${name} 가 필요합니다.`)
  }

  return value
}

function fail(message) {
  console.error(`[bootstrap] ${message}`)
  process.exit(1)
}
