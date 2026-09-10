'use client'

import Link from 'next/link'

import { PolicyHtmlBody } from '@/components/policy/PolicyHtmlBody'
import { DialogShell } from '@/components/ui/DialogShell'
import { MARKETING_CONSENT_SUMMARY, MARKETING_CONSENT_TITLE } from '@/lib/content/marketing-consent'

type MarketingConsentDialogProps = {
  open: boolean
  onClose: () => void
  /** 체크박스를 켜고 닫는다. */
  onAgree: () => void
  /** 발행본 또는 코드 문안 HTML. 서버가 이미 골라서 넘긴다. */
  html: string
}

const TITLE_ID = 'marketing-consent-title'
const SUMMARY_ID = 'marketing-consent-summary'

/** 폰은 전체 화면 시트, sm 이상은 가운데 카드(최대 높이 70vh · 본문만 스크롤). */
const PANEL_CLASS =
  'flex h-dvh max-h-none max-w-none flex-col rounded-t-none p-0 ' +
  'sm:h-auto sm:max-h-[70vh] sm:max-w-[560px] sm:rounded-panel'

const FOOTER_BUTTON_CLASS =
  'flex h-12 flex-1 items-center justify-center rounded-[100px] text-[16px] leading-[22px] ' +
  'font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus'

/**
 * 마케팅 수신 안내 모달(회원가입 [선택] 항목의 ">").
 *
 * 필수 약관은 발행 문서라 새 탭으로 열지만, 이 안내는 회원가입 흐름 안에서
 * 읽고 바로 결정하는 문서다 — 페이지를 떠나면 입력해 둔 닉네임과 체크가 사라진다.
 * 전문은 `/policy/marketing` 에도 같은 문안으로 열려 있다.
 */
export function MarketingConsentDialog({
  open,
  onClose,
  onAgree,
  html,
}: MarketingConsentDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      labelledBy={TITLE_ID}
      describedBy={SUMMARY_ID}
      className={PANEL_CLASS}
    >
      <div className="border-line-soft border-b px-6 pt-6 pb-4">
        <h2 id={TITLE_ID} className="text-ink text-[20px] leading-[28px] font-semibold">
          {MARKETING_CONSENT_TITLE}
        </h2>
        <p id={SUMMARY_ID} className="text-ink-muted mt-2 text-[15px] leading-[22px]">
          {MARKETING_CONSENT_SUMMARY}
        </p>
      </div>

      {/* 스크롤 영역을 포커스 대상으로 둔다. 포커스 트랩이 "첫 포커스 가능 요소"로
          이동하는데, 이 상자가 없으면 본문 아래쪽 링크가 잡혀 모달이 열리자마자
          맨 아래로 스크롤된다. 키보드 사용자가 본문을 스크롤할 수 있게 되기도 한다. */}
      <div tabIndex={0} className="flex-1 overflow-y-auto px-6 py-5">
        <PolicyHtmlBody html={html} />

        <Link
          href="/policy/marketing"
          target="_blank"
          rel="noreferrer"
          className="text-ink mt-6 inline-block text-[15px] underline underline-offset-4 hover:opacity-70"
        >
          마케팅 정보 수신 동의 전문 보기
        </Link>
      </div>

      <div className="border-line-soft flex gap-3 border-t px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className={`${FOOTER_BUTTON_CLASS} border border-[#cdd3db] bg-white text-[#2a2a2a]`}
        >
          확인
        </button>
        <button
          type="button"
          onClick={onAgree}
          className={`${FOOTER_BUTTON_CLASS} bg-[#2a2a2a] text-white`}
        >
          동의하고 닫기
        </button>
      </div>
    </DialogShell>
  )
}
