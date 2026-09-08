'use client'

import { useActionState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { SuspensionNotice } from '@/components/board/SuspensionNotice'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { createComment } from '@/lib/actions/post-actions'
import { LOGIN_REQUIRED_NOTICE } from '@/lib/constants/board'
import { COMMENT_CONTENT_MAX } from '@/lib/validation/post'

import type { FormEvent } from 'react'

const COMMENT_FIELD_CLASS =
  'rounded-[10px] border-line-soft text-input placeholder:text-[#9a9a9a] disabled:bg-sheet'

type CommentFormProps = {
  postId: string
  isAuthenticated: boolean
  /** 정지 계정 안내(`describeSuspension()` 결과). 넘어오면 배너를 띄우고 입력을 잠근다. */
  suspensionNotice?: string | null
}

/**
 * 댓글 작성 폼.
 *
 * 상태는 셋이다 — 비로그인(로그인 유도) · 정지(안내 + 잠금) · 정상. 정지 안내는
 * 서버 액션(`createComment`)이 돌려주는 문구와 같은 함수에서 나오므로, 미리 보이는
 * 배너와 제출 후 오류가 어긋나지 않는다.
 */
export function CommentForm({
  postId,
  isAuthenticated,
  suspensionNotice = null,
}: CommentFormProps) {
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

  if (suspensionNotice !== null) {
    return (
      <div className="mt-8 flex flex-col gap-3">
        <SuspensionNotice message={suspensionNotice} />

        <Textarea
          label="댓글 작성"
          placeholder="댓글을 입력해주세요"
          rows={4}
          disabled
          className={COMMENT_FIELD_CLASS}
        />
      </div>
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
