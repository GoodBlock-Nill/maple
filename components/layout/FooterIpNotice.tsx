import { Fragment } from 'react'

import { segmentIpNoticeLine, splitIpNoticeLines } from '@/lib/utils/ip-notice'
import { cn } from '@/lib/utils/cn'

type FooterIpNoticeProps = {
  notice: string
  className?: string
}

/**
 * 푸터 IP 고지 4줄(시안 footer-v3-home.png) — Switzer Regular 15/1.4 #ddd,
 * 'MapleStory' 등 고유명사만 semibold.
 *
 * 서버 컴포넌트에서도 그대로 쓸 수 있도록 순수 렌더만 한다(상태·훅 없음).
 * `SiteFooter` 가 async 서버 컴포넌트라 이 조각도 async 의존 없이 독립
 * 단위 테스트가 가능해야 한다.
 */
export function FooterIpNotice({ notice, className }: FooterIpNoticeProps) {
  const lines = splitIpNoticeLines(notice)

  return (
    <p className={cn('text-[15px] leading-[1.4] text-[#ddd]', className)}>
      {lines.map((line, lineIndex) => (
        <Fragment key={line}>
          {lineIndex > 0 ? <br /> : null}
          {segmentIpNoticeLine(line).map((segment, segmentIndex) =>
            segment.isBold ? (
              <span key={segmentIndex} className="font-semibold">
                {segment.text}
              </span>
            ) : (
              <Fragment key={segmentIndex}>{segment.text}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </p>
  )
}
