'use client'

import { kindMoveNotice } from '@/components/inquiry-categories/category-kind-move'
import { Button } from '@/components/ui'

import type { InquiryCategoryKindMove } from '@/components/inquiry-categories/category-kind-move'

/**
 * 카테고리 폼의 아래쪽 — 사용자 화면 미리보기 · 노출 여부 · 저장 줄.
 *
 * 다이얼로그에서 떼어 낸 것은 200줄 상한 때문이지만, 묶음 자체에 뜻이 있다: 여기 셋은
 * **저장을 누르기 직전에 확인하는 것들**이다(무엇이 보일지 · 사용자에게 내보낼지 ·
 * 무엇이 함께 움직일지).
 */

export function InquiryCategoryFormFooter({
  prefill,
  isEdit,
  isPending,
  isActive,
  kindMove,
  isConfirming,
  onClose,
  onConfirm,
  onCancelConfirm,
}: {
  /** 프리필 원문. 사용자 폼과 같은 방식(`whitespace-pre-line`)으로 그린다. */
  prefill: string
  isEdit: boolean
  isPending: boolean
  isActive: boolean
  /** 종류를 옮기는 저장일 때만 온다(`kindMoveOf`). null 이면 확인 없이 바로 저장한다. */
  kindMove: InquiryCategoryKindMove | null
  isConfirming: boolean
  onClose: () => void
  /** 확인 단계로 들어간다(종류를 옮기는 저장에서만 쓰인다). */
  onConfirm: () => void
  onCancelConfirm: () => void
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-muted text-[12px] font-semibold">사용자 화면 미리보기</span>
        <p className="border-line bg-page text-ink rounded-panel border px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-line">
          {prefill === '' ? '프리필을 입력하면 사용자 화면 모습이 보입니다.' : prefill}
        </p>
      </div>

      <label className="text-ink flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={isActive}
          className="accent-accent size-4"
        />
        사용자 폼에 노출
      </label>

      {kindMove !== null && isConfirming ? (
        <KindMoveConfirm move={kindMove} isPending={isPending} onCancel={onCancelConfirm} />
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          {/* 종류를 옮기는 저장은 곧바로 보내지 않는다 — 한 걸음 앞에서 몇 건이
              함께 움직이는지 보여 준다. */}
          {kindMove === null ? (
            <Button type="submit" disabled={isPending}>
              {isPending ? '저장 중…' : isEdit ? '수정' : '등록'}
            </Button>
          ) : (
            <Button onClick={onConfirm} disabled={isPending}>
              {isEdit ? '수정' : '등록'}
            </Button>
          )}
        </div>
      )}
    </>
  )
}

/**
 * 종류 변경 확인.
 *
 * 되돌리기 어려운 조작이라 확인을 세운다(DEVELOPER-GUIDE §7.4 의 3요소: 제목 · 실제로
 * 일어나는 일 · 취소+실행). 다이얼로그를 **한 겹 더 띄우지 않는 이유**는 하나다 —
 * 공용 `Dialog` 는 Escape 를 document 에서 듣는다. 겹쳐 띄우면 Escape 한 번에 바깥
 * 폼까지 닫혀 운영자가 쓰던 값을 잃는다. 그래서 같은 다이얼로그 안에서 버튼 줄만
 * 바꿔 단다(폼은 계속 마운트되어 있으므로 그대로 제출된다).
 */
function KindMoveConfirm({
  move,
  isPending,
  onCancel,
}: {
  move: InquiryCategoryKindMove
  isPending: boolean
  onCancel: () => void
}) {
  return (
    <div className="border-warn/25 bg-warn-soft rounded-panel flex flex-col gap-2 border px-3 py-3">
      <p className="text-ink text-[13px] font-semibold">문의 종류를 바꿉니다</p>
      <p className="text-ink text-[13px] leading-relaxed">{kindMoveNotice(move)}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={isPending}>
          취소
        </Button>
        <Button variant="danger" size="sm" type="submit" disabled={isPending}>
          {isPending ? '저장 중…' : '종류 바꾸고 저장'}
        </Button>
      </div>
    </div>
  )
}
