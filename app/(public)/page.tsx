import { FlashNotice } from '@/components/board/FlashNotice'
import { HeroSection } from '@/components/home/HeroSection'
import { NewsCommunitySection } from '@/components/home/NewsCommunitySection'
import { SiteFooter } from '@/components/layout/SiteFooter'
import {
  WITHDRAWN_NOTICE_MESSAGE,
  WITHDRAWN_NOTICE_PARAM,
  WITHDRAWN_NOTICE_VALUE,
} from '@/lib/auth/lifecycle'
import { firstValue } from '@/lib/utils/list-query'

export default async function HomePage(props: PageProps<'/'>) {
  const searchParams = await props.searchParams
  /* 탈퇴 직후 리다이렉트(`/?notice=withdrawn`)로만 켜지는 1회성 안내. 주소 정리는
     FlashNotice 가 맡는다(새로고침·공유 링크에서는 다시 뜨지 않는다). */
  const isWithdrawn = firstValue(searchParams[WITHDRAWN_NOTICE_PARAM]) === WITHDRAWN_NOTICE_VALUE

  return (
    <>
      <HeroSection />
      {isWithdrawn ? (
        <div className="mx-auto w-full max-w-[1140px] px-6">
          <FlashNotice param={WITHDRAWN_NOTICE_PARAM} message={WITHDRAWN_NOTICE_MESSAGE} />
        </div>
      ) : null}
      <NewsCommunitySection />
      <SiteFooter variant="home" />
    </>
  )
}
