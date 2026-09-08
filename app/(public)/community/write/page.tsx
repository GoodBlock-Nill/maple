import Image from 'next/image'

import { BackToListLink } from '@/components/board/BackToListLink'
import { ListSheet } from '@/components/board/ListSheet'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { COMMUNITY_CATEGORIES, LOGIN_REQUIRED_NOTICE } from '@/lib/constants/board'

import type { Metadata } from 'next'

const COMMUNITY_PATH = '/community'
const SUBMIT_NOTICE_ID = 'write-submit-notice'

/** 고객지원 폼과 동일한 입력 표면(h44 · radius 10 · border #cdd3db). */
const FIELD_CLASS = 'rounded-[10px] border-line-soft text-[17px] placeholder:text-[#9a9a9a]'

export const metadata: Metadata = {
  title: '글쓰기',
  description: '자유게시판에 새 글을 작성합니다.',
  robots: { index: false, follow: false },
}

export default function CommunityWritePage(_props: PageProps<'/community/write'>) {
  return (
    <PageShell variant="community" title="글쓰기">
      <ListSheet className="mt-6">
        <form className="rounded-panel border-line-soft bg-surface shadow-chip flex flex-col gap-8 border p-6 sm:p-10">
          <p className="bg-sheet text-ink-muted rounded-[10px] px-4 py-3 text-[15px]">
            {LOGIN_REQUIRED_NOTICE} 아래 항목은 미리 살펴볼 수 있도록 열어 두었습니다.
          </p>

          <fieldset>
            <legend className="text-ink text-[17px] font-semibold">카테고리</legend>
            <div className="flex flex-wrap gap-2.5 pt-3">
              {COMMUNITY_CATEGORIES.map((category, index) => (
                <label key={category.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value={category.value}
                    defaultChecked={index === 0}
                    className="peer sr-only"
                  />
                  <span className="board-control text-ink-muted peer-checked:bg-ink peer-checked:border-ink peer-focus-visible:outline-focus inline-flex items-center px-[15px] text-[17px] font-medium transition-colors peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                    {category.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Input
            label="제목"
            required
            maxLength={100}
            placeholder="제목을 입력해주세요"
            className={FIELD_CLASS}
          />

          <Textarea
            label="내용"
            required
            rows={12}
            hint="마크다운 문법을 사용할 수 있습니다."
            placeholder="내용을 입력해주세요"
            className={FIELD_CLASS}
          />

          <div className="flex flex-wrap items-center justify-end gap-4">
            <p id={SUBMIT_NOTICE_ID} className="text-ink-muted text-[15px]">
              {LOGIN_REQUIRED_NOTICE}
            </p>
            <Button
              type="submit"
              disabled
              size="lg"
              aria-describedby={SUBMIT_NOTICE_ID}
              className="w-[110px] gap-1.5 rounded-[10px] px-0 text-[17px]"
            >
              <Image
                src="/images/brand/icon-write.svg"
                alt=""
                width={25}
                height={25}
                aria-hidden
                className="shrink-0"
              />
              등록
            </Button>
          </div>
        </form>
      </ListSheet>

      <BackToListLink href={COMMUNITY_PATH} />
    </PageShell>
  )
}
