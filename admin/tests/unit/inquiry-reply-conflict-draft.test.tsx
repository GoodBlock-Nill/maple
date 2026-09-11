import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 충돌이 나도 **쓰던 답변은 사라지지 않는다.**
 *
 * 이것이 이 기능의 신뢰가 걸린 지점이다. "다른 운영자가 먼저 처리했습니다"를 보여
 * 주면서 입력칸까지 비우면, 운영자는 그 뒤로 긴 답변을 콘솔에서 쓰지 않는다(메모장에
 * 쓰고 붙여 넣게 된다). 그래서 스레드는 `router.refresh()` 로만 갱신하고 초안은
 * 클라이언트 상태에 그대로 둔다.
 *
 * 같은 파일에서 "작성 중" 배너와 폼 잠금도 함께 고정한다 — 배너를 그리면서 폼을
 * 열어 두면 경고가 아무 일도 하지 않는 장식이 된다.
 */

const CONFLICT_MESSAGE = '다른 운영자가 먼저 처리했습니다. 최신 내용을 확인해 주세요.'
const DRAFT = '확인 결과를 안내드립니다. 계정 복구는 오늘 중으로 처리됩니다.'
const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const INQUIRY_ID = '33333333-3333-4333-8333-333333333333'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

/* vi.hoisted 는 파일 위로 끌어올려지므로 위의 상수를 볼 수 없다. 문구는 여기서 다시 적는다. */
const replyResult = vi.hoisted(() => ({
  current: {
    code: 'conflict',
    formError: '다른 운영자가 먼저 처리했습니다. 최신 내용을 확인해 주세요.',
  } as Record<string, unknown>,
}))

vi.mock('@/lib/actions/inquiries-actions', () => ({
  replyToInquiryAction: vi.fn(async () => replyResult.current),
}))

const lock = vi.hoisted(() => ({
  claimOk: true,
  holder: { nickname: '다른운영자', at: '2026-09-11T09:58:00.000Z' },
  collab: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/actions/inquiry-lock-actions', () => ({
  claimInquiryEditAction: vi.fn(async () => ({
    ok: lock.claimOk,
    editingBy: lock.claimOk ? ADMIN_ID : 'other',
    editingNickname: lock.claimOk ? '운영자' : lock.holder.nickname,
    editingAt: lock.holder.at,
  })),
  readInquiryCollabAction: vi.fn(async () => lock.collab),
  releaseInquiryEditAction: vi.fn(async () => undefined),
}))

const { InquiryReplyForm } = await import('@/components/inquiries/InquiryReplyForm')
const { ToastProvider } = await import('@/components/ui')

function renderForm() {
  render(
    <ToastProvider>
      <InquiryReplyForm
        inquiryId={INQUIRY_ID}
        adminId={ADMIN_ID}
        adminNickname="운영자"
        isEmail={false}
        templates={[]}
        inquiry={{
          id: INQUIRY_ID,
          inquiryNo: 1024,
          title: '계정이 잠겼어요',
          category: '계정',
          nickname: '글자용사',
        }}
        snapshot={{ replyCount: 0, status: 'pending', updatedAt: '2026-09-11T09:00:00.000Z' }}
      />
    </ToastProvider>,
  )

  return userEvent.setup()
}

beforeEach(() => {
  refresh.mockReset()
  lock.claimOk = true
  lock.collab = null
  replyResult.current = { code: 'conflict', formError: CONFLICT_MESSAGE }
})

describe('InquiryReplyForm — 충돌', () => {
  it('should keep the draft and refresh the thread when someone answered first', async () => {
    // Arrange
    const user = renderForm()
    const textarea = screen.getByLabelText(/답변 내용/)
    await user.type(textarea, DRAFT)

    // Act
    await user.click(screen.getByRole('button', { name: '답변 등록' }))

    // Assert
    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument()
    expect(textarea).toHaveValue(DRAFT)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('should send the snapshot the page was rendered with', async () => {
    // Arrange
    const { replyToInquiryAction } = await import('@/lib/actions/inquiries-actions')
    const user = renderForm()
    await user.type(screen.getByLabelText(/답변 내용/), '짧은 답변')

    // Act
    await user.click(screen.getByRole('button', { name: '답변 등록' }))

    // Assert — 서버는 이 값과 지금 DB 를 비교해 충돌을 가른다.
    await waitFor(() => expect(replyToInquiryAction).toHaveBeenCalled())

    const formData = vi.mocked(replyToInquiryAction).mock.calls[0]?.[1] as FormData

    expect(formData.get('expectedReplyCount')).toBe('0')
    expect(formData.get('expectedStatus')).toBe('pending')
  })
})

describe('InquiryReplyForm — 앞선 스레드 안내', () => {
  it('should not cry stale when the poll answer is older than the rendered thread', async () => {
    /* Arrange — 내가 방금 상태를 바꿨고(화면은 최신), 폴링 응답이 그보다 늦게 도착했다.
       단순 비교로 두면 내가 한 일 때문에 "다른 운영자가 처리했습니다"가 뜬다. */
    lock.collab = {
      status: 'pending',
      updatedAt: '2026-09-11T08:00:00.000Z',
      replyCount: 0,
      assignee: null,
      editing: null,
    }

    // Act
    renderForm()

    // Assert
    await waitFor(() => expect(screen.getByLabelText(/답변 내용/)).not.toBeDisabled())
    expect(screen.queryByTestId('inquiry-thread-stale')).not.toBeInTheDocument()
  })

  it('should warn before the save is rejected when a reply landed', async () => {
    // Arrange — 폴링이 화면보다 앞선다(답변이 한 건 더 있다).
    lock.collab = {
      status: 'pending',
      updatedAt: '2026-09-11T09:00:00.000Z',
      replyCount: 1,
      assignee: null,
      editing: null,
    }

    // Act
    renderForm()

    // Assert — 저장 버튼을 누른 뒤에야 알려 주면 이미 긴 답변을 다 쓴 뒤다.
    expect(await screen.findByTestId('inquiry-thread-stale')).toHaveTextContent(
      '다른 운영자가 이 문의를 처리했습니다',
    )
  })
})

describe('InquiryReplyForm — 작성 중 잠금', () => {
  it('should lock the form and name the operator who is writing', async () => {
    // Arrange
    lock.claimOk = false

    // Act
    renderForm()

    // Assert — 경고만 띄우고 폼을 열어 두면 아무 일도 하지 않는 장식이 된다.
    const banner = await screen.findByTestId('inquiry-edit-lock')

    expect(banner).toHaveTextContent('다른운영자')
    expect(banner).toHaveTextContent('답변을 작성하고 있습니다')
    expect(screen.getByLabelText(/답변 내용/)).toBeDisabled()
    expect(screen.getByRole('button', { name: '답변 등록' })).toBeDisabled()
  })

  it('should open the form again after a forced takeover', async () => {
    // Arrange
    lock.claimOk = false
    const user = renderForm()
    await screen.findByTestId('inquiry-edit-lock')

    // Act — "그래도 이어서 작성"
    lock.claimOk = true
    await user.click(screen.getByRole('button', { name: '그래도 이어서 작성' }))

    // Assert
    await waitFor(() => expect(screen.getByLabelText(/답변 내용/)).not.toBeDisabled())
    expect(screen.queryByTestId('inquiry-edit-lock')).not.toBeInTheDocument()
  })
})
