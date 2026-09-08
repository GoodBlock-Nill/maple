import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'

export default function PublicNotFound() {
  return (
    <>
      <div className="bg-page-sub flex min-h-[60vh] items-center pt-[190px] pb-24">
        <Container className="flex flex-col items-center gap-5 text-center">
          <p className="text-ink-muted text-body-lg font-semibold">404</p>
          <h1 className="text-ink text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.04em]">
            요청하신 글을 찾을 수 없습니다
          </h1>
          <p className="text-ink-muted text-prose">
            주소가 바뀌었거나 삭제된 글일 수 있습니다. 목록에서 다시 찾아보세요.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button href="/news" variant="dark">
              뉴스 목록
            </Button>
            <Button href="/community" variant="light">
              자유게시판
            </Button>
          </div>
        </Container>
      </div>
      <SiteFooter variant="home" />
    </>
  )
}
