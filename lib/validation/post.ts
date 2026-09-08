import { z } from 'zod'

import { COMMUNITY_CATEGORY_VALUES } from '@/lib/constants/board'

import type { CommunityCategory } from '@/types/domain'

/** 게시글 · 댓글 입력 검증. 길이 상한은 DB 저장 비용과 목록 렌더를 함께 고려한 값이다. */

export const POST_TITLE_MIN = 2
export const POST_TITLE_MAX = 100
export const POST_CONTENT_MIN = 5
export const POST_CONTENT_MAX = 10_000

export const COMMENT_CONTENT_MIN = 1
export const COMMENT_CONTENT_MAX = 1_000

/**
 * `posts.category_key` 는 `board_categories` 로의 FK 다. 여기서 값을 좁혀 두면
 * 잘못된 말머리가 DB 제약 위반(23503)으로 터지는 대신 폼 오류로 되돌아온다.
 */
const category = z.enum(COMMUNITY_CATEGORY_VALUES as [CommunityCategory, ...CommunityCategory[]], {
  message: '카테고리를 선택해 주세요.',
})

export const createPostSchema = z.object({
  category,
  title: z
    .string()
    .trim()
    .min(POST_TITLE_MIN, { message: `제목은 ${POST_TITLE_MIN}자 이상 입력해 주세요.` })
    .max(POST_TITLE_MAX, { message: `제목은 ${POST_TITLE_MAX}자 이하로 입력해 주세요.` }),
  content: z
    .string()
    .trim()
    .min(POST_CONTENT_MIN, { message: `내용은 ${POST_CONTENT_MIN}자 이상 입력해 주세요.` })
    .max(POST_CONTENT_MAX, { message: `내용은 ${POST_CONTENT_MAX}자 이하로 입력해 주세요.` }),
})

export const createCommentSchema = z.object({
  postId: z.uuid({ message: '잘못된 게시글입니다.' }),
  content: z
    .string()
    .trim()
    .min(COMMENT_CONTENT_MIN, { message: '댓글 내용을 입력해 주세요.' })
    .max(COMMENT_CONTENT_MAX, { message: `댓글은 ${COMMENT_CONTENT_MAX}자 이하로 입력해 주세요.` }),
})

/**
 * 수정은 작성과 같은 규칙을 쓴다. 같은 폼(`PostForm`)을 재사용하므로 상한이
 * 갈리면 "쓸 때는 통과했는데 고칠 때는 막히는" 글이 생긴다.
 */
export const updatePostSchema = createPostSchema

/** 서버 액션이 bind 로 받는 식별자. 폼 필드가 아니라 URL 세그먼트에서 온다. */
export const postIdSchema = z.uuid({ message: '잘못된 게시글입니다.' })

export const commentIdSchema = z.uuid({ message: '잘못된 댓글입니다.' })

export type CreatePostInput = z.infer<typeof createPostSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
