'use client'

import { useEffect, useState, useTransition } from 'react'

import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { completeSignup, sendSignupCode, verifySignupCode } from '@/lib/actions/signup-actions'
import { normalizeOtpInput, RESEND_COOLDOWN_SECONDS } from '@/lib/auth/signup-steps'

import type { FormState } from '@/lib/actions/form-state'
import type { SignupGateInput, SignupStep, SignupValues } from '@/lib/auth/signup-steps'

const EMPTY_VALUES: SignupValues = { email: '', code: '', password: '', passwordConfirm: '' }

/** 안내 문구는 그 문구를 만든 단계의 입력 아래에 붙는다. */
export type SignupNotice = { slot: 'email' | 'code'; text: string }

export type SignupFlow = {
  values: SignupValues
  gate: SignupGateInput
  feedback: FormState
  notice: SignupNotice | null
  cooldown: number
  isPending: boolean
  setEmail: (email: string) => void
  setCode: (code: string) => void
  setPasswords: (patch: { password?: string; passwordConfirm?: string }) => void
  send: () => void
  verify: () => void
  submit: (nextPath: string) => void
}

/**
 * 회원가입 화면의 상태 기계.
 *
 * 단계는 **서버 액션이 성공을 돌려줄 때만** 올라간다. 판정 규칙 자체는
 * `lib/auth/signup-steps.ts`(순수 함수)가 갖고, 여기서는 값과 진행 상태만 든다.
 * 폼 컴포넌트가 200줄을 넘지 않도록 분리했다.
 */
export function useSignupFlow(): SignupFlow {
  const [values, setValues] = useState<SignupValues>(EMPTY_VALUES)
  const [step, setStep] = useState<SignupStep>('email')
  const [feedback, setFeedback] = useState<FormState>(EMPTY_FORM_STATE)
  const [notice, setNotice] = useState<SignupNotice | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [isPending, startTransition] = useTransition()

  /* 재전송 대기 카운트다운. Supabase 가 1분 안의 재발송을 거절하므로(config
     `max_frequency`) 눌러 보고 실패하게 두지 않고 남은 시간을 보여 준다. */
  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)

    return () => clearTimeout(timer)
  }, [cooldown])

  const setEmail = (email: string) => {
    // 주소를 고치면 앞서 받은 인증번호는 의미가 없다. 처음 단계로 되돌린다.
    setValues((previous) => ({ ...previous, email, code: '' }))
    setStep('email')
    setNotice(null)
    setFeedback(EMPTY_FORM_STATE)
  }

  const setCode = (code: string) =>
    setValues((previous) => ({ ...previous, code: normalizeOtpInput(code) }))

  const setPasswords = (patch: { password?: string; passwordConfirm?: string }) =>
    setValues((previous) => ({ ...previous, ...patch }))

  const send = () =>
    startTransition(async () => {
      const result = await sendSignupCode(values.email)
      setFeedback(result)

      if (result.message === undefined) return

      setStep('code')
      setNotice({ slot: 'email', text: result.message })
      setCooldown(RESEND_COOLDOWN_SECONDS)
    })

  const verify = () =>
    startTransition(async () => {
      const result = await verifySignupCode(values.email, values.code)
      setFeedback(result)

      if (result.message === undefined) return

      setStep('verified')
      setNotice({ slot: 'code', text: result.message })
    })

  const submit = (nextPath: string) =>
    startTransition(async () => {
      setFeedback(await completeSignup(values.password, values.passwordConfirm, nextPath))
    })

  return {
    values,
    gate: { ...values, step, isPending, cooldown },
    feedback,
    notice,
    cooldown,
    isPending,
    setEmail,
    setCode,
    setPasswords,
    send,
    verify,
    submit,
  }
}
