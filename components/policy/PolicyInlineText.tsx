import { parsePolicyEmphasis } from '@/lib/utils/policy-text'

type PolicyInlineTextProps = {
  text: string
}

/** 원문의 `**굵게**` 표기를 `<strong>` 으로 바꿔 그린다. */
export function PolicyInlineText({ text }: PolicyInlineTextProps) {
  const segments = parsePolicyEmphasis(text)

  return (
    <>
      {segments.map((segment, index) =>
        segment.bold ? (
          <strong key={index} className="text-ink font-semibold">
            {segment.text}
          </strong>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}
