'use client'

import Image from 'next/image'
import { useActionState, useMemo } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { PostEditor } from '@/components/editor/PostEditor'
import { Input } from '@/components/ui/Input'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { createPost } from '@/lib/actions/post-actions'
import { updatePost } from '@/lib/actions/post-edit-actions'
import { COMMUNITY_CATEGORIES } from '@/lib/constants/board'
import { POST_TITLE_MAX } from '@/lib/validation/post'

import type { CommunityCategory } from '@/types/domain'

/** 고객지원 폼과 동일한 입력 표면(h44 · radius 10 · border #cdd3db). */
const FIELD_CLASS = 'rounded-[10px] border-line-soft text-[17px] placeholder:text-[#9a9a9a]'

type PostFormValues = {
  category: CommunityCategory
  title: string
  /** 에디터가 읽는 본문 HTML. 레거시 마크다운 글은 수정 화면에서 미리 변환해 넘긴다. */
  content: string
}

type PostFormProps = {
  /** 넘기면 수정 모드가 된다. 없으면 새 글 작성. */
  postId?: string
  defaultValues?: PostFormValues
}

/**
 * 자유게시판 글쓰기 · 수정 폼.
 *
 * 작성과 수정은 같은 규칙(`createPostSchema` = `updatePostSchema`)을 쓰므로 폼을
 * 나누지 않는다. 나누면 상한이 갈려서 "쓸 때는 통과했는데 고칠 때는 막히는" 글이
 * 생긴다. 대상 글 id 는 서버 액션에 bind 로 실어 폼 필드에서 조작할 수 없게 한다.
 *
 * 제출 버튼은 아이콘이 붙은 전용 마크업이 필요해 `SubmitButton` 을 쓰지 않고
 * `useActionState` 의 pending 플래그로 비활성화한다.
 */
export function PostForm({ postId, defaultValues }: PostFormProps) {
  const action = useMemo(
    () => (postId === undefined ? createPost : updatePost.bind(null, postId)),
    [postId],
  )
  const [state, formAction, isPending] = useActionState(action, EMPTY_FORM_STATE)

  const isEditMode = postId !== undefined
  const submitLabel = isEditMode ? '수정' : '등록'

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
                defaultChecked={
                  defaultValues === undefined
                    ? index === 0
                    : defaultValues.category === category.value
                }
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
        defaultValue={defaultValues?.title}
        placeholder="제목을 입력해주세요"
        error={state.fieldErrors?.title}
        className={FIELD_CLASS}
      />

      <PostEditor
        label="내용"
        name="content"
        defaultValue={defaultValues?.content}
        hint="사진은 끌어다 놓거나 붙여 넣을 수 있고, 유튜브·Vimeo 주소는 영상 버튼으로 넣습니다."
        error={state.fieldErrors?.content}
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
          {isPending ? `${submitLabel} 중` : submitLabel}
        </button>
      </div>
    </form>
  )
}
