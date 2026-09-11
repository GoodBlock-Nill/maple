'use client'

import { useActionState, useCallback, useEffect } from 'react'

import { PostEditor } from '@/components/editor/PostEditor'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/actions/form-state'
import { saveNewsTemplateAction } from '@/lib/actions/news-template-actions'
import { NEWS_TEMPLATE_SUMMARY_MAX, NEWS_TEMPLATE_TITLE_MAX } from '@/lib/validation/news-templates'

import type { AdminNewsTemplate } from '@/lib/data/news-templates'

/**
 * 카테고리 템플릿 편집 폼.
 *
 * 본문 편집기는 뉴스 작성 화면과 **같은 컴포넌트**(`PostEditor`)다. 다른 편집기를 쓰면
 * 여기서 만든 서식이 글 화면에서 다르게 보이고, 정제기가 지우는 태그도 달라진다.
 *
 * 저장은 리다이렉트 없이 끝난다(고친 자리에 머문다). 저장·되돌리기 뒤에는 페이지가
 * 다시 그려지고, 부모가 `key` 를 바꿔 이 폼을 새 초기값으로 다시 마운트한다 — 비제어
 * 입력과 에디터는 `defaultValue` 가 바뀌어도 스스로 값을 갈아 끼우지 않기 때문이다.
 *
 * '기본값으로 되돌리기' 는 이 폼 **밖**(페이지 헤더)에 있다. 그 버튼도 서버 액션 폼이라
 * 여기 넣으면 폼이 중첩되고, 중첩된 form 은 브라우저가 무시한다.
 */
export function NewsTemplateForm({ template }: { template: AdminNewsTemplate }) {
  const { showToast } = useToast()

  const runSave = useCallback(
    (prevState: FormState, formData: FormData) => saveNewsTemplateAction(prevState, formData),
    [],
  )

  const [state, formAction, isPending] = useActionState(runSave, EMPTY_FORM_STATE)

  useEffect(() => {
    if (state.message !== undefined) {
      showToast(state.message, 'success')
    }
  }, [state, showToast])

  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="category" value={template.categoryKey} />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <FormBanner message={state.formError} />

          <Input
            label="제목 템플릿"
            name="title"
            maxLength={NEWS_TEMPLATE_TITLE_MAX}
            defaultValue={template.title}
            hint="새 글의 제목 칸이 비어 있을 때만 채웁니다. 운영자가 쓴 제목은 덮지 않습니다."
            error={errors.title}
          />

          <Textarea
            label="요약 템플릿"
            name="summary"
            rows={2}
            maxLength={NEWS_TEMPLATE_SUMMARY_MAX}
            defaultValue={template.summary}
            hint="요약 칸이 비어 있을 때만 채웁니다. 목록에는 보이지 않고 검색 결과·공유 카드 설명으로 쓰입니다."
            error={errors.summary}
          />

          <label className="text-ink flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={template.isActive}
              className="accent-accent size-4"
            />
            새 글 작성 화면에서 이 카테고리를 고르면 템플릿 채우기
          </label>
        </CardBody>
      </Card>

      <PostEditor
        name="body"
        label="본문 템플릿"
        defaultValue={template.body}
        hint="새 글의 본문을 이 내용으로 채웁니다. {{날짜}} 처럼 적어 둔 자리는 자동으로 바뀌지 않습니다 — 작성할 때 직접 고쳐 씁니다."
        error={errors.body}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? '저장 중…' : '저장'}
        </Button>
        <Button href="/news/templates" variant="secondary">
          목록으로
        </Button>
      </div>
    </form>
  )
}
