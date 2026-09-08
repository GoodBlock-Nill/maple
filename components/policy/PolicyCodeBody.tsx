import { PolicySectionArticle } from '@/components/policy/PolicySectionArticle'

import type { PolicyFallback } from '@/lib/content/policy-fallback'

type PolicyCodeBodyProps = {
  fallback: PolicyFallback
}

/**
 * 코드 문안 렌더러 — DB 발행본이 없을 때만 쓰인다.
 *
 * 구조화된 `PolicySection` 을 그대로 그리므로 서식의 기준점이기도 하다.
 * 발행본 쪽(`components/policy/policy-prose.ts`)의 클래스는 여기서 복사해 왔다.
 */
export function PolicyCodeBody({ fallback }: PolicyCodeBodyProps) {
  if (fallback.sections.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {fallback.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-ink-muted text-[17px] leading-[1.8]">
            {paragraph}
          </p>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-12">
        {fallback.sections.map((section) => (
          <PolicySectionArticle key={section.id} section={section} />
        ))}
      </div>

      {fallback.addendum === undefined ? null : (
        <section
          aria-labelledby="policy-addendum-heading"
          className="border-line-soft border-t pt-8"
        >
          <h2 id="policy-addendum-heading" className="text-ink text-[22px] font-bold sm:text-[27px]">
            {fallback.addendum.title}
          </h2>
          <ul className="mt-4 flex flex-col gap-1.5 pl-1">
            {fallback.addendum.items.map((item) => (
              <li
                key={item}
                className="text-ink-muted marker:text-line-soft list-disc pl-1 text-[17px] leading-[1.8] marker:content-['–_']"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
