import { WithdrawnNoticeDialog } from '@/components/auth/WithdrawnNoticeDialog'
import { HeroSection } from '@/components/home/HeroSection'
import { NewsCommunitySection } from '@/components/home/NewsCommunitySection'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { WITHDRAWN_NOTICE_PARAM, WITHDRAWN_NOTICE_VALUE } from '@/lib/auth/lifecycle'
import { firstValue } from '@/lib/utils/list-query'

export default async function HomePage(props: PageProps<'/'>) {
  const searchParams = await props.searchParams
  /* 탈퇴 직후 리다이렉트(`/?notice=withdrawn`)로만 켜지는 1회성 안내. 시안 v2 는
     배너가 아니라 모달이다 — 주소 정리는 모달이 닫힐 때 한다. */
  const isWithdrawn = firstValue(searchParams[WITHDRAWN_NOTICE_PARAM]) === WITHDRAWN_NOTICE_VALUE

  return (
    <>
      <HeroSection />
      {isWithdrawn ? <WithdrawnNoticeDialog /> : null}
      <NewsCommunitySection />
      <SiteFooter variant="home" />
    </>
  )
}
