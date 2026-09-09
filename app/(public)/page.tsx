import { HeroSection } from '@/components/home/HeroSection'
import { NewsCommunitySection } from '@/components/home/NewsCommunitySection'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { getActiveHeroBanner } from '@/lib/data/hero-banner'

export default async function HomePage(_props: PageProps<'/'>) {
  const banner = await getActiveHeroBanner()

  return (
    <>
      <HeroSection banner={banner} />
      <NewsCommunitySection />
      <SiteFooter variant="home" />
    </>
  )
}
