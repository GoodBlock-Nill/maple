import { z } from 'zod'

/**
 * 여러 줄 평문 필드의 공통 스키마 조각.
 *
 * 브라우저는 textarea 값을 폼 전송 시 **CRLF 로 정규화**한다(HTML 사양). 그대로
 * 저장하면 사용자 화면·검색·글자 수 계산이 보이지 않는 `\r` 에 흔들린다. 길이를
 * 재기 전에 LF 로 되돌리고 앞뒤 공백을 다듬는다.
 *
 * `inquiries.ts` 에서 떼어 낸 것은 의존 방향 때문이다 — 문의 협업(배정·메모)
 * 스키마가 이 조각을 쓰는데, 그쪽을 `inquiries.ts` 가 다시 가져다 쓰면서
 * 두 모듈이 서로를 참조하게 된다. 아무것도 의존하지 않는 이 파일에 두면 고리가 없다.
 */
export function plainTextField(max: number, emptyMessage: string, tooLongMessage: string) {
  return z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(z.string().min(1, emptyMessage).max(max, tooLongMessage))
}
