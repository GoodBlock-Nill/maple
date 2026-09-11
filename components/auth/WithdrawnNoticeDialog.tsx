'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { NoticeDialog } from '@/components/ui/NoticeDialog'
import { WITHDRAWN_DIALOG_TITLE, WITHDRAWN_NOTICE_MESSAGE } from '@/lib/auth/lifecycle'

type WithdrawnNoticeDialogProps = {
  /** 닫을 때 갈아 끼울 주소. 홈이라 기본값이 "/" 다. */
  returnPath?: string
}

/**
 * 탈퇴 완료 모달 — 탈퇴 액션이 보낸 `/?notice=withdrawn` 에서만 열린다.
 *
 * 닫는 순간 주소에서 파라미터를 뗀다. 새로고침·공유 링크에서 다시 뜨면 "또
 * 탈퇴됐나?" 하고 오해하기 때문이다(`FlashNotice` 와 같은 이유). `router.replace`
 * 를 쓰는 이유는 서버가 아는 주소까지 함께 갈아 끼워야 뒤로 가기에서도 되살아나지
 * 않기 때문이다.
 */
export function WithdrawnNoticeDialog({ returnPath = '/' }: WithdrawnNoticeDialogProps) {
  const router = useRouter()
  const [isOpen, setOpen] = useState(true)

  const close = () => {
    setOpen(false)
    router.replace(returnPath, { scroll: false })
  }

  return (
    <NoticeDialog
      open={isOpen}
      title={WITHDRAWN_DIALOG_TITLE}
      description={WITHDRAWN_NOTICE_MESSAGE}
      onClose={close}
    />
  )
}
