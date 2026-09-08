'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { EMPTY_FORM_STATE, readField, toFieldErrors } from '@/lib/actions/form-state'
import { createClient } from '@/lib/supabase/server'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  sanitizeNextPath,
} from '@/lib/validation/auth'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 인증 서버 액션.
 *
 * 어떤 액션도 Supabase 의 원문 오류를 그대로 노출하지 않는다. "이 이메일은
 * 등록되지 않았습니다" 같은 응답은 가입 여부를 알려 주는 계정 열거(enumeration)
 * 취약점이 되므로, 로그인 실패와 재설정 요청은 항상 같은 문구로 답한다.
 */

const RESET_PATH = '/auth/confirm'
const RESET_NEXT = '/login'

/** 이메일 링크에 실을 절대 URL. 프록시 뒤에서도 실제 호스트를 쓰도록 헤더를 본다. */
async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL

  if (configured !== undefined && configured.trim() !== '') {
    return configured.replace(/\/$/, '')
  }

  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const protocol = headerList.get('x-forwarded-proto') ?? 'http'

  return `${protocol}://${host}`
}

export async function signIn(_prevState: FormState, formData: FormData): Promise<FormState> {
  const nextPath = sanitizeNextPath(readField(formData, 'next'))
  const parsed = loginSchema.safeParse({
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error !== null) {
    return { formError: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  // redirect() 는 예외를 던진다. try/catch 바깥에서 호출해야 한다(Next 16 문서).
  redirect(nextPath)
}

export async function signUp(_prevState: FormState, formData: FormData): Promise<FormState> {
  const nextPath = sanitizeNextPath(readField(formData, 'next'))
  const parsed = registerSchema.safeParse({
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
    nickname: readField(formData, 'nickname'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const origin = await getSiteOrigin()

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      /* 닉네임은 handle_new_user() 트리거가 읽어 profiles 를 만든다. 중복이면
         트리거가 접미 숫자를 붙여 해소하므로 가입 자체는 실패하지 않는다.
         role 은 절대 싣지 않는다 — 실으면 스스로 관리자가 될 수 있다. */
      data: { nickname: parsed.data.nickname },
      emailRedirectTo: `${origin}${RESET_PATH}?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error !== null) {
    return { formError: '가입에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  // 메일 확인이 켜져 있으면 세션 없이 사용자만 만들어진다.
  if (data.session === null) {
    return { message: '가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 인증을 완료해 주세요.' }
  }

  redirect(nextPath)
}

export async function requestPasswordReset(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: readField(formData, 'email') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const origin = await getSiteOrigin()

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}${RESET_PATH}?next=${encodeURIComponent(RESET_NEXT)}`,
  })

  // 성공·실패를 구분해 알리지 않는다(계정 열거 방지).
  return {
    ...EMPTY_FORM_STATE,
    message: '입력하신 주소로 가입 내역이 있으면 재설정 메일을 보냈습니다.',
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()

  redirect('/')
}
