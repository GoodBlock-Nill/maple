import { maskNickname } from '@/lib/utils/mask'

/**
 * 작성자 표시 규칙.
 *
 * 공개 조회(anon)는 `profiles` 를 읽을 수 없으므로 글·댓글의 `author_name` 스냅샷이
 * 화면의 유일한 근거다. 파기 배치(`purge_withdrawn_profiles`)는 프로필 닉네임과
 * 스냅샷을 모두 `탈퇴한 회원#<id 앞 8자>` 로 바꾼다. 실제 회원 닉네임은 공백·`#` 을
 * 쓸 수 없어(`nicknameSchema`) 이 접두사와 충돌하지 않는다.
 *
 * 탈퇴 대기(90일 보존) 중에는 스냅샷이 그대로라 기존 마스킹 닉네임이 보인다
 * — 오너 결정 3(docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md §6).
 */

/** 화면에 그리는 고정 문구. 마스킹하지 않는다. */
export const PURGED_AUTHOR_LABEL = '탈퇴한 회원'

/** DB 함수 purge_withdrawn_profiles 가 쓰는 익명 닉네임 접두사. 바꾸면 함수도 함께 바꾼다. */
export const PURGED_NICKNAME_PREFIX = `${PURGED_AUTHOR_LABEL}#`

export function isPurgedAuthorName(authorName: string | null | undefined): boolean {
  return typeof authorName === 'string' && authorName.startsWith(PURGED_NICKNAME_PREFIX)
}

export type AuthorDisplaySource = {
  /** 원본 닉네임(스냅샷). */
  author: string
  /** 매퍼가 스냅샷을 보고 판정한 값. */
  authorPurged: boolean
}

/** 목록·상세·댓글이 같은 규칙으로 작성자를 그린다. */
export function authorLabel({ author, authorPurged }: AuthorDisplaySource): string {
  return authorPurged ? PURGED_AUTHOR_LABEL : maskNickname(author)
}
