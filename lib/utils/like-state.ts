import type { FormState } from '@/lib/actions/form-state'

/**
 * 좋아요 상태와 그 토글 규칙.
 *
 * 낙관적 UI(`useOptimistic`)와 서버 액션이 같은 규칙을 써야 눌렀을 때 튀는 값이
 * 없다. 그래서 규칙만 순수 함수로 떼어 두고 양쪽이 이것만 부른다.
 */

export type LikeState = {
  liked: boolean
  likeCount: number
}

/**
 * 서버 액션 `toggleLike()` 의 결과.
 *
 * 성공/실패를 판별 가능한 유니온으로 나눈다. 실패 쪽이 `FormState` 를 그대로
 * 품고 있어서 다른 폼과 같은 방식으로 오류 문구를 그릴 수 있고, 비로그인은
 * `requiresLogin` 으로 구분해 클라이언트가 로그인 화면으로 보낸다.
 */
export type ToggleLikeResult =
  ({ ok: true } & LikeState) | ({ ok: false; requiresLogin: boolean } & FormState)

/**
 * 한 번 누른 뒤의 상태.
 *
 * 취소는 1 을 빼지만 0 아래로는 내려가지 않는다. 시드 데이터처럼 `post_likes`
 * 행 없이 `like_count` 만 있는 글에서 취소가 먼저 일어나면 음수가 될 수 있는데,
 * 화면에 "-1"이 뜨는 것보다 0 에서 멈추는 편이 낫다(DB 트리거도 같은 규칙이다).
 */
export function toggleLikeState({ liked, likeCount }: LikeState): LikeState {
  return {
    liked: !liked,
    likeCount: liked ? Math.max(0, likeCount - 1) : likeCount + 1,
  }
}
