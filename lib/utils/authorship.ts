/**
 * 작성자 판정 · 수정 여부 판정.
 *
 * 두 함수 모두 **화면 분기용**이다. 실제 권한은 서버 액션의 재확인과 DB 의
 * RLS(`posts_update_own` · `comments_update_own`)가 강제하므로, 여기를 우회해도
 * 남의 글은 고칠 수 없다.
 */

/**
 * 뷰어가 이 글/댓글의 작성자인가.
 *
 * 탈퇴 사용자의 글은 `author_id` 가 null 이 된다(`on delete set null`). null 끼리
 * 같다고 판정하면 비로그인 사용자에게 수정 버튼이 열리므로 둘 다 값이 있을 때만
 * true 를 돌려준다.
 */
export function isAuthor(
  authorId: string | null | undefined,
  viewerId: string | null | undefined,
): boolean {
  if (typeof authorId !== 'string' || authorId === '') {
    return false
  }

  if (typeof viewerId !== 'string' || viewerId === '') {
    return false
  }

  return authorId === viewerId
}

/**
 * "수정됨" 표시 여부.
 *
 * `updated_at` 으로는 판정할 수 없다. `set_updated_at` 트리거가 모든 UPDATE 에서
 * 도는데 `increment_post_view()` 가 조회수를 올릴 때마다 그 UPDATE 가 발생해,
 * 조회만 돼도 값이 밀린다. DB 의 `mark_post_edited()` 트리거가 제목·본문·요약·
 * 말머리가 실제로 바뀐 순간에만 채우는 `edited_at` 을 그대로 신뢰한다.
 */
export function isEdited(editedAt: string | null | undefined): boolean {
  if (typeof editedAt !== 'string' || editedAt === '') {
    return false
  }

  return !Number.isNaN(new Date(editedAt).getTime())
}
