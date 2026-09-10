'use client'

import { useState } from 'react'

import { Button, Input } from '@/components/ui'
import {
  COUPON_CODE_MAX_LENGTH,
  generateCouponCode,
  hasAmbiguousCodeChars,
  normalizeCouponCode,
} from '@/lib/validation/coupon-code'

/**
 * 쿠폰 코드 입력 + 자동 생성.
 *
 * 입력하는 동안 **대문자로 되돌린다.** 저장 시점에만 정규화하면 운영자가 소문자로
 * 적어 둔 코드를 그대로 공지에 붙여 넣고, 사용자는 화면에 적힌 것과 다른 코드를
 * 보게 된다(등록은 되지만 "코드가 다르다"는 문의가 남는다).
 *
 * 자동 생성은 `0/O` · `1/I` 가 없는 알파벳만 쓴다. 손으로 적은 코드에는 그 글자를
 * 막지 않고 **경고만** 한다 — 이미 인쇄물에 나간 코드를 그대로 등록해야 할 때가 있다.
 */
export function CouponCodeField({
  defaultValue,
  error,
  disabled = false,
}: {
  defaultValue: string
  error?: string
  disabled?: boolean
}) {
  const [code, setCode] = useState(defaultValue)
  const showAmbiguousHint = hasAmbiguousCodeChars(code)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <Input
          label="쿠폰 코드"
          name="code"
          required
          maxLength={COUPON_CODE_MAX_LENGTH}
          value={code}
          onChange={(event) => setCode(normalizeCouponCode(event.target.value))}
          error={error}
          disabled={disabled}
          placeholder="GLZA-XXXX-XXXX"
          hint="공지·배너에 그대로 실리는 값입니다. 사용자가 소문자로 입력해도 등록됩니다."
          className="font-mono"
          wrapperClassName="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => setCode(generateCouponCode())}
          disabled={disabled}
          /* 힌트 한 줄만큼 위로 올려 입력 칸과 밑동을 맞춘다. */
          className="mb-[22px]"
        >
          자동 생성
        </Button>
      </div>

      {showAmbiguousHint && (
        <p className="text-warn text-[12px]">
          0 · O · 1 · I 가 섞여 있습니다. 손으로 옮겨 적을 때 헷갈릴 수 있으니 자동 생성을 권합니다.
        </p>
      )}
    </div>
  )
}
