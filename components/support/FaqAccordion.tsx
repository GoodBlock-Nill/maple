import { ChevronDownIcon } from '@/components/ui/icons'

import type { FaqGroup } from '@/types/domain'

type FaqAccordionProps = {
  groups: readonly FaqGroup[]
}

/**
 * 자주 묻는 질문 아코디언.
 * `details/summary` 라 JS 없이도 열고 닫히며, 카테고리 칩으로 묶여 있다.
 */
export function FaqAccordion({ groups }: FaqAccordionProps) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-ink text-[clamp(22px,2.6vw,26px)] leading-tight font-medium">
        자주 묻는 질문
      </h2>

      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <section key={group.category} className="flex flex-col gap-2">
            <h3 className="sr-only">{group.label}</h3>
            {group.items.map((item) => (
              <details
                key={item.id}
                name="faq"
                className="border-line-soft group rounded-[10px] border bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="rounded-pill bg-page-sub text-ink-muted border-line-soft shrink-0 border px-2.5 py-1 text-[14px] font-medium">
                    {group.label}
                  </span>
                  <span className="text-ink min-w-0 flex-1 text-[17px] font-medium">
                    {item.question}
                  </span>
                  <ChevronDownIcon className="text-ink-muted size-5 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="bg-page-sub border-line text-ink-muted mx-4 mb-4 rounded-[10px] border px-4 py-3.5 text-[16px] leading-[1.7] whitespace-pre-line">
                  {item.answer}
                </p>
              </details>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
