'use client'

import { useActionState, useCallback, useEffect, useMemo } from 'react'

import { PostEditor } from '@/components/editor/PostEditor'
import { useNewsTemplatePrefill } from '@/components/news/use-news-template-prefill'
import { NewsPublishFields } from '@/components/news/NewsPublishFields'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
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
import type { NewsTemplate } from '@/lib/utils/news-template-prefill'

/**
 * 뉴스 작성 · 수정 폼.
 *
 * 작성과 수정이 한 컴포넌트인 이유: 필드가 완전히 같고, 다른 것은 숨은 `id` 하나뿐이다.
 * 서버 액션도 그 값으로 분기한다(`saveNewsAction`).
 *
 * 본문은 `PostEditor` 가 숨은 input 으로 실어 보낸다 — 에디터를 상위 폼 상태로
 * 끌어올리면 한 글자마다 리렌더되어 한글 조합이 끊긴다(PostEditor 주석 참고).
 * 템플릿을 갈아 끼울 때만 `key` 를 바꿔 에디터를 새 초기값으로 다시 마운트한다
 * (`use-news-template-prefill.ts`).
 */

type NewsFormProps = {
  categories: readonly NewsCategoryOption[]
  /** 카테고리별 글 템플릿. 새 글에서 카테고리를 고르면 이 양식이 폼을 채운다. */
  templates: readonly NewsTemplate[]
  /** 수정 모드일 때의 기존 글. 새 글이면 null. */
  post: NewsDetail | null
}

/**
 * 지금 에디터에 있는 본문(HTML).
 *
 * `PostEditor` 가 폼에 실어 보내는 숨은 input 을 **이벤트가 일어난 순간에만** 읽는다.
 * 본문을 상위 상태로 올리지 않는 이유는 PostEditor 주석과 같다 — 한 글자마다 리렌더되면
 * 한글 조합이 끊긴다. ref 대신 이벤트의 `form` 을 타는 것은 렌더 중 ref 접근을 만들지
 * 않기 위해서다(`react-hooks/refs`).
 */
function readEditorBody(form: HTMLFormElement | null): string {
  const element = form?.elements.namedItem('content')

  return element instanceof HTMLInputElement ? element.value : ''
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

export function NewsForm({ categories, templates, post }: NewsFormProps) {
  const { showToast } = useToast()

  const categoryLabels = useMemo(
    () => new Map(categories.map((option) => [option.key, option.label])),
    [categories],
  )

  const prefill = useNewsTemplatePrefill({
    templates,
    categoryLabels,
    initial: {
      category: post?.categoryKey ?? '',
      title: post?.title ?? '',
      summary: post?.summary ?? '',
      body: post?.content ?? '',
    },
    isEdit: post !== null,
  })

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

            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="카테고리"
                name="categoryKey"
                required
                value={prefill.category}
                onChange={(event) =>
                  prefill.selectCategory(
                    event.target.value,
                    readEditorBody(event.currentTarget.form),
                  )
                }
                placeholder="선택하세요"
                error={errors.categoryKey}
                options={categories.map((option) => ({ value: option.key, label: option.label }))}
                wrapperClassName="max-w-[240px]"
                hint={
                  post === null ? '고르면 그 카테고리의 템플릿이 제목·본문을 채웁니다.' : undefined
                }
              />

              {/* 기존 글에는 자동 적용하지 않는다. 불러오기는 운영자가 누를 때만. */}
              {post !== null && prefill.hasTemplate && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(event) =>
                    prefill.loadTemplate(readEditorBody(event.currentTarget.form))
                  }
                >
                  템플릿 불러오기
                </Button>
              )}
            </div>

            <Input
              label="제목"
              name="title"
              required
              maxLength={NEWS_TITLE_MAX}
              value={prefill.title}
              onChange={(event) => prefill.setTitle(event.target.value)}
              hint="사용자 사이트 목록에 한 줄로 보입니다. PC 약 59자 · 폰 약 18자를 넘으면 말줄임(…) 됩니다(상세 화면에는 전부 나옵니다)."
              error={errors.title}
            />

            <Textarea
              label="요약"
              name="summary"
              rows={3}
              maxLength={NEWS_SUMMARY_MAX}
              value={prefill.summary}
              onChange={(event) => prefill.setSummary(event.target.value)}
              hint="목록에는 보이지 않습니다. 검색 결과·공유 카드 설명으로만 쓰입니다."
              error={errors.summary}
            />
          </CardBody>
        </Card>

        <PostEditor
          key={prefill.bodyKey}
          name="content"
          label="본문"
          defaultValue={prefill.body}
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

      <Dialog
        open={prefill.pendingLabel !== null}
        onClose={prefill.cancelPending}
        title="템플릿 적용"
        description="작성 중인 내용이 지워집니다. 템플릿을 적용할까요?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-ink text-[13px]">
            {prefill.pendingLabel}
            <span className="text-muted"> 템플릿으로 본문을 갈아 끼웁니다.</span>
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={prefill.cancelPending}>
              취소
            </Button>
            <Button onClick={prefill.confirmPending}>적용</Button>
          </div>
        </div>
      </Dialog>
    </form>
  )
}
