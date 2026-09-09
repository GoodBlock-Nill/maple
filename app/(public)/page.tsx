import { HeroSection } from '@/components/home/HeroSection'
import { NewsCommunitySection } from '@/components/home/NewsCommunitySection'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function HomePage(_props: PageProps<'/'>) {
  return (
    <>
      <HeroSection />
      <NewsCommunitySection />
      <SiteFooter variant="home" />
    </>
  )
}
