'use client'

import { useActionState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { createComment } from '@/lib/actions/post-actions'
import { LOGIN_REQUIRED_NOTICE } from '@/lib/constants/board'
import { COMMENT_CONTENT_MAX } from '@/lib/validation/post'

import type { FormEvent } from 'react'

const COMMENT_FIELD_CLASS =
  'rounded-[10px] border-line-soft text-[17px] placeholder:text-[#9a9a9a] disabled:bg-sheet'

type CommentFormProps = {
  postId: string
  isAuthenticated: boolean
}

export function CommentForm({ postId, isAuthenticated }: CommentFormProps) {
  const [state, formAction] = useActionState(createComment, EMPTY_FORM_STATE)

  // 등록에 성공하면 입력창을 비운다. 서버가 목록을 다시 그려도 textarea 의
  // 사용자 입력값은 브라우저가 그대로 들고 있기 때문이다.
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const form = event.currentTarget

    queueMicrotask(() => {
      form.reset()
    })
  }

  if (!isAuthenticated) {
    return (
      <form className="mt-8 flex flex-col gap-3">
        <Textarea
          label="댓글 작성"
          hint={LOGIN_REQUIRED_NOTICE}
          placeholder="댓글을 입력해주세요"
          rows={4}
          disabled
          className={COMMENT_FIELD_CLASS}
        />
        <Button
          href={`/login?next=${encodeURIComponent(`/community/${postId}`)}`}
          className="self-end"
        >
          로그인하고 댓글 쓰기
        </Button>
      </form>
    )
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <FormFeedback state={state} />

      <input type="hidden" name="postId" value={postId} />

      <Textarea
        label="댓글 작성"
        name="content"
        required
        rows={4}
        maxLength={COMMENT_CONTENT_MAX}
        placeholder="댓글을 입력해주세요"
        error={state.fieldErrors?.content}
        className={COMMENT_FIELD_CLASS}
      />

      <Button type="submit" className="self-end">
        등록
      </Button>
    </form>
  )
}
