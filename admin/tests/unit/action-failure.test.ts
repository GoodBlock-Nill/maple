import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { actionFailure, logFailure } from '@/lib/actions/action-failure'

/**
 * 실패 처리의 계약: **원문은 로그로만, 화면에는 고정 문장만.**
 *
 * 이 함수가 원문을 한 번이라도 되돌려 주면 모든 액션이 함께 새 나가므로,
 * 반환값에 원문이 섞이지 않는다는 것을 여기서 못박는다.
 */

const RAW = 'duplicate key value violates unique constraint "profiles_nickname_key"'
const MESSAGE = '닉네임을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('actionFailure', () => {
  it('should return only the fixed sentence as formError', () => {
    const state = actionFailure('members', MESSAGE, { message: RAW })

    expect(state).toEqual({ formError: MESSAGE })
    expect(state.formError).not.toContain(RAW)
  })

  it('should log the scope, the sentence and the raw cause', () => {
    actionFailure('members', MESSAGE, { message: RAW })

    expect(errorSpy).toHaveBeenCalledWith(`[members] ${MESSAGE}`, RAW)
  })

  it('should accept a bare string cause', () => {
    actionFailure('reports', MESSAGE, RAW)

    expect(errorSpy).toHaveBeenCalledWith(`[reports] ${MESSAGE}`, RAW)
  })

  it('should still log when the cause is missing', () => {
    actionFailure('reports', MESSAGE, null)
    actionFailure('reports', MESSAGE, {})

    expect(errorSpy).toHaveBeenNthCalledWith(1, `[reports] ${MESSAGE}`, '(원인 미상)')
    expect(errorSpy).toHaveBeenNthCalledWith(2, `[reports] ${MESSAGE}`, '(메시지 없음)')
  })
})

describe('logFailure', () => {
  it('should return the sentence unchanged for helpers that hand back a string', () => {
    expect(logFailure('inquiries', MESSAGE, { message: RAW })).toBe(MESSAGE)
    expect(errorSpy).toHaveBeenCalledOnce()
  })
})
