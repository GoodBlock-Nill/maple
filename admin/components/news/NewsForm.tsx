'use client'

import { useActionState, useCallback, useEffect } from 'react'

import { PostEditor } from '@/components/editor/PostEditor'
import { NewsPublishFields } from '@/components/news/NewsPublishFields'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/actions/form-state'
import { saveNewsAction } from '@/lib/actions/news-actions'
import { NEWS_SUMMARY_MAX, NEWS_TITLE_MAX } from '@/lib/constants/news'
import { isoToKstLocal, type NewsPublishMode } from '@/lib/validation/news'

import type { NewsCategoryOption, NewsDetail } from '@/lib/data/news'

/**
 * 뉴스 작성 · 수정 폼.
 *
 * 작성과 수정이 한 컴포넌트인 이유: 필드가 완전히 같고, 다른 것은 숨은 `id` 하나뿐이다.
 * 서버 액션도 그 값으로 분기한다(`saveNewsAction`).
 *
 * 본문은 `PostEditor` 가 숨은 input 으로 실어 보낸다 — 에디터를 상위 폼 상태로
 * 끌어올리면 한 글자마다 리렌더되어 한글 조합이 끊긴다(PostEditor 주석 참고).
 */

type NewsFormProps = {
  categories: readonly NewsCategoryOption[]
  /** 수정 모드일 때의 기존 글. 새 글이면 null. */
  post: NewsDetail | null
}

/** 기존 글 → 라디오 초기 선택. 예약(미래 발행)은 별도 상태로 되살려야 한다. */
function initialMode(post: NewsDetail | null): NewsPublishMode {
  if (post === null) {
    return 'draft'
  }

  if (!post.isPublished) {
    return 'draft'
  }

  return post.status === 'scheduled' ? 'schedule' : 'now'
}

export function NewsForm({ categories, post }: NewsFormProps) {
  const { showToast } = useToast()

  const runSave = useCallback(
    (prevState: FormState, formData: FormData) => saveNewsAction(prevState, formData),
    [],
  )

  const [state, formAction, isPending] = useActionState(runSave, EMPTY_FORM_STATE)

  /* 저장 성공은 리다이렉트 없이 끝난다(수정 화면에 그대로 머문다). 토스트가 유일한
     완료 신호라 상태가 바뀔 때 한 번만 띄운다. */
  useEffect(() => {
    if (state.message !== undefined) {
      showToast(state.message, 'success')
    }
  }, [state, showToast])

  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {post !== null && <input type="hidden" name="id" value={post.id} />}

      <div className="flex flex-col gap-5">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <FormBanner message={state.formError} />

            <Select
              label="카테고리"
              name="categoryKey"
              required
              defaultValue={post?.categoryKey ?? ''}
              placeholder="선택하세요"
              error={errors.categoryKey}
              options={categories.map((option) => ({ value: option.key, label: option.label }))}
              wrapperClassName="max-w-[240px]"
            />

            <Input
              label="제목"
              name="title"
              required
              maxLength={NEWS_TITLE_MAX}
              defaultValue={post?.title ?? ''}
              hint={`${NEWS_TITLE_MAX}자까지 입력할 수 있습니다.`}
              error={errors.title}
            />

            <Textarea
              label="요약"
              name="summary"
              rows={3}
              maxLength={NEWS_SUMMARY_MAX}
              defaultValue={post?.summary ?? ''}
              hint={`목록에는 보이지 않습니다. 검색 결과·공유 카드 설명으로만 쓰입니다(${NEWS_SUMMARY_MAX}자까지).`}
              error={errors.summary}
            />
          </CardBody>
        </Card>

        <PostEditor
          name="content"
          label="본문"
          defaultValue={post?.content ?? ''}
          hint="이미지는 붙여넣기·드래그로도 올릴 수 있습니다."
          error={errors.content}
        />
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title="발행" />
          <CardBody className="flex flex-col gap-4">
            <NewsPublishFields
              defaultMode={initialMode(post)}
              defaultScheduledAt={
                post !== null && post.status === 'scheduled' ? isoToKstLocal(post.publishedAt) : ''
              }
              defaultPinned={post?.isPinned ?? false}
              scheduleError={errors.scheduledAt}
            />

            <div className="border-line flex items-center gap-2 border-t pt-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? '저장 중…' : '저장'}
              </Button>
              <Button href="/news" variant="secondary">
                목록으로
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </form>
  )
}
