import { PolicyBlockView } from '@/components/policy/PolicyBlockView'

import type { PolicySection, PolicySubsection } from '@/lib/content/operating-policy'

type PolicySectionArticleProps = {
  section: PolicySection
}

/** `##` 장 하나 — 번호가 붙은 큰 제목과 본문/하위 항목을 그린다. */
export function PolicySectionArticle({ section }: PolicySectionArticleProps) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-28">
      <h2
        id={`${section.id}-heading`}
        className="text-ink text-[22px] leading-tight font-bold sm:text-[27px]"
      >
        {section.number}. {section.title}
      </h2>
      <div className="mt-5 flex flex-col gap-4">
        {section.blocks.map((block, index) => (
          <PolicyBlockView key={index} block={block} />
        ))}
      </div>
      {section.subsections !== undefined ? (
        <div className="mt-6 flex flex-col gap-8">
          {section.subsections.map((subsection) => (
            <PolicySubsectionArticle key={subsection.id} subsection={subsection} depth={0} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

type PolicySubsectionArticleProps = {
  subsection: PolicySubsection
  /** 0 = `###`(예: 3-1), 1 = `####`(예: 가/나) — 들여쓰기와 글자 크기를 나눈다. */
  depth: number
}

function PolicySubsectionArticle({ subsection, depth }: PolicySubsectionArticleProps) {
  const HeadingTag = depth === 0 ? 'h3' : 'h4'

  return (
    <div id={subsection.id} className={depth === 0 ? 'scroll-mt-28' : 'scroll-mt-28 pl-4 sm:pl-6'}>
      <HeadingTag
        className={
          depth === 0
            ? 'text-ink text-[19px] font-semibold'
            : 'text-ink-muted text-[17px] font-semibold'
        }
      >
        {subsection.title}
      </HeadingTag>
      <div className="mt-3 flex flex-col gap-4">
        {subsection.blocks.map((block, index) => (
          <PolicyBlockView key={index} block={block} />
        ))}
      </div>
      {subsection.subsections !== undefined ? (
        <div className="mt-5 flex flex-col gap-6">
          {subsection.subsections.map((child) => (
            <PolicySubsectionArticle key={child.id} subsection={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
