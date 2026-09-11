'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE, type FormState } from '@/lib/actions/form-state'
import { resetNewsTemplateAction } from '@/lib/actions/news-template-actions'

/**
 * 기본값으로 되돌리기 + 확인 다이얼로그.
 *
 * 확인을 세우는 이유는 이 조작이 **운영자가 쓴 문안을 덮어쓰기** 때문이다. 되돌린 값은
 * 처음 배포된 시드와 같은 문안이고(코드 상수), 이전 문안은 감사 로그의 `before` 에만 남는다.
 * 그 사실을 설명에 적어 둔다 — "되돌리기"라는 단어만 보면 한 번 더 누르면 다시 돌아올
 * 것처럼 읽힌다.
 *
 * 이미 기본값인 템플릿에는 버튼을 그리지 않는다. 아무 일도 하지 않는 버튼은 운영자에게
 * "무언가 달라졌나"를 되묻게 만든다.
 *
 * 성공하면 **목록으로 돌아간다.** 편집 폼의 입력과 에디터는 비제어라, 그 자리에 머물면
 * 서버가 되돌린 문안 대신 화면에 남아 있던 옛 문안을 계속 보여 준다. 목록에는 그 카테고리가
 * '기본값' 으로 찍히므로 무엇이 일어났는지가 화면에 남는다(토스트는 이동해도 유지된다).
 */
export function NewsTemplateResetButton({
  category,
  label,
  isDefault,
}: {
  category: string
  label: string
  /** 지금 문안이 이미 기본값인가. */
  isDefault: boolean
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()
  const router = useRouter()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await resetNewsTemplateAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
        router.push('/news/templates')
      }

      return result
    },
    [router, showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  if (isDefault) {
    return null
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        기본값으로 되돌리기
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="템플릿 기본값 복원"
        description="지금 저장된 문안을 처음 배포된 기본 템플릿으로 덮어씁니다. 고쳐 둔 내용은 감사 로그에만 남습니다. 사용 여부(켜짐/꺼짐)는 그대로 두고, 되돌린 뒤에는 템플릿 목록으로 돌아갑니다."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="category" value={category} />

          <p className="text-ink text-[13px]">
            {label}
            <span className="text-muted"> 템플릿을 기본값으로 되돌립니다.</span>
          </p>

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant="danger" type="submit" disabled={isPending}>
              {isPending ? '되돌리는 중…' : '되돌리기'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
