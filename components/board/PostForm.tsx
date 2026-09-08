'use client'

import Image from 'next/image'
import { useActionState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { createPost } from '@/lib/actions/post-actions'
import { COMMUNITY_CATEGORIES } from '@/lib/constants/board'
import { POST_CONTENT_MAX, POST_TITLE_MAX } from '@/lib/validation/post'

/** 고객지원 폼과 동일한 입력 표면(h44 · radius 10 · border #cdd3db). */
const FIELD_CLASS = 'rounded-[10px] border-line-soft text-[17px] placeholder:text-[#9a9a9a]'

/**
 * 자유게시판 글쓰기 폼.
 *
 * 제출 버튼은 `useFormStatus` 대신 액션 상태의 `pending` 을 쓰지 않고, 아이콘이
 * 붙은 전용 마크업이 필요해 `SubmitButton` 을 쓰지 않는다. 대신 액션이 진행 중일
 * 때 `useActionState` 의 pending 플래그로 비활성화한다.
 */
export function PostForm() {
  const [state, formAction, isPending] = useActionState(createPost, EMPTY_FORM_STATE)

  return (
    <form
      action={formAction}
      className="rounded-panel border-line-soft bg-surface shadow-chip flex flex-col gap-8 border p-6 sm:p-10"
    >
      <FormFeedback state={state} />

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
        {state.fieldErrors?.category === undefined ? null : (
          <p role="alert" className="text-badge-red mt-2 text-[13px] font-medium">
            {state.fieldErrors.category}
          </p>
        )}
      </fieldset>

      <Input
        label="제목"
        name="title"
        required
        maxLength={POST_TITLE_MAX}
        placeholder="제목을 입력해주세요"
        error={state.fieldErrors?.title}
        className={FIELD_CLASS}
      />

      <Textarea
        label="내용"
        name="content"
        required
        rows={12}
        maxLength={POST_CONTENT_MAX}
        hint="마크다운 문법을 사용할 수 있습니다."
        placeholder="내용을 입력해주세요"
        error={state.fieldErrors?.content}
        className={FIELD_CLASS}
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="cta-dark inline-flex h-[47px] w-[110px] items-center justify-center gap-1.5 rounded-[10px] text-[17px] font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50"
        >
          <Image
            src="/images/brand/icon-write.svg"
            alt=""
            width={25}
            height={25}
            aria-hidden
            className="shrink-0"
          />
          {isPending ? '등록 중' : '등록'}
        </button>
      </div>
    </form>
  )
}
