import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShareButton } from '@/components/board/ShareButton'

const URL_UNDER_TEST = 'https://example.com/news/11111111-0000-4000-8000-000000000023'

type NavigatorOverrides = {
  share?: (data: ShareData) => Promise<void>
  clipboard?: { writeText: (value: string) => Promise<void> }
}

/** jsdom navigator 는 share/clipboard 가 없다. 필요한 능력만 얹었다 지운다. */
function stubNavigator({ share, clipboard }: NavigatorOverrides) {
  const target = window.navigator

  // 읽기 전용 속성이라 defineProperty/deleteProperty 로만 갈아끼울 수 있다.
  if (share === undefined) {
    Reflect.deleteProperty(target, 'share')
  } else {
    Object.defineProperty(target, 'share', { value: share, configurable: true })
  }

  if (clipboard === undefined) {
    Reflect.deleteProperty(target, 'clipboard')
  } else {
    Object.defineProperty(target, 'clipboard', { value: clipboard, configurable: true })
  }
}

function renderButton() {
  return render(<ShareButton title="점검 안내" text="요약" url={URL_UNDER_TEST} />)
}

afterEach(() => {
  stubNavigator({})
})

describe('ShareButton', () => {
  it('should open the os share sheet when navigator.share exists', async () => {
    // Arrange
    const share = vi.fn(async () => undefined)
    stubNavigator({ share, clipboard: { writeText: vi.fn(async () => undefined) } })
    renderButton()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '링크 공유' }))

    // Assert
    expect(share).toHaveBeenCalledWith({
      title: '점검 안내',
      text: '요약',
      url: URL_UNDER_TEST,
    })
    expect(screen.queryByText('링크가 복사되었습니다')).toBeNull()
  })

  it('should copy the url and announce it when only the clipboard exists', async () => {
    // Arrange
    const writeText = vi.fn(async () => undefined)
    stubNavigator({ clipboard: { writeText } })
    renderButton()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '링크 공유' }))

    // Assert
    expect(writeText).toHaveBeenCalledWith(URL_UNDER_TEST)
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('링크가 복사되었습니다')
    })
  })

  it('should reveal the url when the clipboard write is rejected', async () => {
    // Arrange — 권한 거부 · 비보안 컨텍스트에서 실제로 일어나는 경로다.
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    stubNavigator({ clipboard: { writeText } })
    renderButton()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '링크 공유' }))

    // Assert
    await waitFor(() => {
      expect(screen.getByLabelText('공유 링크')).toHaveValue(URL_UNDER_TEST)
    })
  })

  it('should reveal the url when neither api is available', async () => {
    // Arrange
    stubNavigator({})
    renderButton()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '링크 공유' }))

    // Assert
    await waitFor(() => {
      expect(screen.getByLabelText('공유 링크')).toHaveValue(URL_UNDER_TEST)
    })
  })
})
