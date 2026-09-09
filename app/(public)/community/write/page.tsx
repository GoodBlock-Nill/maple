import { redirect } from 'next/navigation'

import { BackToListLink } from '@/components/board/BackToListLink'
import { ListSheet } from '@/components/board/ListSheet'
import { MswLinkNotice } from '@/components/board/MswLinkNotice'
import { PostForm } from '@/components/board/PostForm'
import { PageShell } from '@/components/layout/PageShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { mswLinkNotice } from '@/lib/utils/msw-link'
import { suspensionNotice } from '@/lib/utils/suspension'
import { RESTORE_PATH } from '@/lib/validation/auth'

import type { Metadata } from 'next'

const COMMUNITY_PATH = '/community'
const WRITE_PATH = '/community/write'

export const metadata: Metadata = {
  title: '글쓰기',
  description: '자유게시판에 새 글을 작성합니다.',
  robots: { index: false, follow: false },
}

export default async function CommunityWritePage(_props: PageProps<'/community/write'>) {
  // 프록시의 검사는 낙관적이다(세션 쿠키만 본다). 실제 게이트는 여기서 한 번 더 건다.
  const user = await getCurrentUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(WRITE_PATH)}`)
  }

  // 탈퇴 대기 계정은 글을 쓸 수 없다(is_withdrawn 정책). 복구를 먼저 묻는다.
  if (user.isWithdrawn) {
    redirect(`${RESTORE_PATH}?next=${encodeURIComponent(WRITE_PATH)}`)
  }

  /* 월드 계정 연동 필수 플래그(기본 OFF). 켜져 있고 연동 전이면 폼 대신 안내만 보인다 —
     `createPost` 액션도 같은 문구로 거절한다. */
  const mswRequired = mswLinkNotice(user)

  if (mswRequired !== null) {
    return (
      <PageShell variant="community" title="글쓰기">
        <ListSheet className="mt-6">
          <MswLinkNotice message={mswRequired} />
        </ListSheet>

        <BackToListLink href={COMMUNITY_PATH} />
      </PageShell>
    )
  }

  /* 정지 계정도 화면까지는 들어온다. 문을 잠그는 대신 이유(기간 · 사유)를 보여 주고
     등록만 막는다 — 리다이렉트로 튕기면 "왜 못 쓰는지"를 알 길이 없다. 최종 차단은
     `createPost` 액션과 `posts_insert_community` 정책이 한다. */
  const suspended = suspensionNotice(user)

  return (
    <PageShell variant="community" title="글쓰기">
      <ListSheet className="mt-6">
        <PostForm suspensionNotice={suspended} />
      </ListSheet>

      <BackToListLink href={COMMUNITY_PATH} />
    </PageShell>
  )
}
