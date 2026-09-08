import Image from 'next/image'
import Link from 'next/link'

import { FOOTER_CONFIG } from '@/components/layout/footer-variants'
import { Logo } from '@/components/layout/Logo'
import { FOOTER_MENU_LINKS, POLICY_LINKS, SITE_TAGLINE, SNS_LINKS } from '@/lib/constants/site'
import { resolveContactEmail, resolveCopyright } from '@/lib/data/site-view'
import { getSiteSettings } from '@/lib/data/site'
import { hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'

import type { FooterVariant } from '@/components/layout/footer-variants'
import type { NavItem } from '@/lib/constants/site'
import type { CSSProperties } from 'react'

/** 마스코트 좌표가 기준으로 삼는 시안 폭. */
const FOOTER_WIDTH = 1440

type SiteFooterProps = {
  /** 페이지별 배경 일러스트·마스코트·패널 위치만 바뀐다. 내용은 동일. */
  variant?: FooterVariant
}

/**
 * 페이지 배경 위에 떠 있는 1300×353 글래스 패널. 우측 상단에 마스코트가 걸친다.
 * 가변 수치(섹션 높이·패널 오프셋·마스코트 좌표)는 Tailwind 동적 클래스 대신
 * CSS 변수로 넘겨 반응형 분기(`xl:`)를 그대로 쓴다.
 *
 * 연락처·저작권은 `site_settings` 가 단일 출처다. 푸터는 모든 페이지에 있으므로
 * 페이지마다 설정을 내려받아 prop 으로 넘기는 대신 여기서 직접 읽는다 — 조회는
 * `unstable_cache`(300초)를 거쳐 요청마다 DB 를 때리지 않는다.
 */
export async function SiteFooter({ variant = 'home' }: SiteFooterProps) {
  const settings = await getSiteSettings()
  const contactEmail = resolveContactEmail(settings)
  const copyright = resolveCopyright(settings)
  const config = FOOTER_CONFIG[variant]
  const { mascot } = config
  const background = hasPublicAsset(config.background)
    ? config.background
    : (config.backgroundFallback ?? null)
  /* 마스코트는 1440 기준 좌표를 오른쪽 여백으로 바꿔 붙인다. 컨테이너가
     1440 보다 좁아져도(1280~1439) 화면 밖으로 밀려 잘리지 않는다. */
  const style = {
    '--footer-height': `${config.height}px`,
    '--footer-panel-top': `${config.panelTop}px`,
    '--mascot-right': `${FOOTER_WIDTH - mascot.left - mascot.width}px`,
    '--mascot-top': `${mascot.top}px`,
    '--mascot-width': `${mascot.width}px`,
    '--mascot-mobile-width': `${mascot.mobileWidth}px`,
  } as CSSProperties

  return (
    <footer style={style} className="relative isolate overflow-hidden" data-variant={variant}>
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{ backgroundColor: config.backgroundColor }}
      />
      {/* TODO(asset): 배경도 폴백도 없으면 backgroundColor 만 남는다. */}
      {background !== null && hasPublicAsset(background) ? (
        <Image
          src={background}
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
      ) : null}
      {config.needsGrassPatch ? (
        /* 배경 JPG 상단 ~160px 는 원본 PNG의 투명 영역이 흰색으로 구워진 자리다.
           시안(home.png)의 같은 행 평균색 ÷ JPG 의 같은 행 평균색으로 구한
           곱연산 램프를 얹어 흰 기운을 지우고 앞 섹션의 숲과 잇는다.
           TODO(asset): 상단이 투명한 원본 PNG 가 오면 이 보정 레이어는 지운다. */
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[170px] bg-[linear-gradient(180deg,#45987a_0px,#46a873_20px,#43b46a_40px,#51c26b_60px,#6fd45d_85px,#73d166_105px,#70d76c_122px,#84e28a_132px,#a9f2ac_142px,#d9f4cd_151px,#ffffff_163px)] mix-blend-multiply"
        />
      ) : null}

      <div className="relative mx-auto w-full max-w-[1440px] px-4 pt-16 pb-12 xl:h-[var(--footer-height)] xl:px-0 xl:pt-[var(--footer-panel-top)] xl:pb-[70px]">
        {hasPublicAsset(mascot.src) ? (
          <Image
            src={mascot.src}
            alt=""
            width={mascot.width}
            height={mascot.height}
            unoptimized
            loading="eager"
            aria-hidden
            style={mascot.isFlipped === true ? { transform: 'scaleX(-1)' } : undefined}
            className={cn(
              'drop-shadow-mascot relative z-20 -mb-8 ml-auto block w-[var(--mascot-mobile-width)] xl:absolute xl:top-[var(--mascot-top)] xl:right-[var(--mascot-right)] xl:mb-0 xl:w-[var(--mascot-width)]',
              mascot.pixelArt !== false && 'pixel-art',
            )}
          />
        ) : null}

        <div
          className={cn(
            config.panelClass,
            'footer-ink rounded-panel mx-auto w-full max-w-[1300px] px-6 py-8 sm:px-10',
            'xl:h-[353px] xl:px-[150px] xl:pt-[38px] xl:pb-10',
          )}
        >
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-[100px]">
            <div className="flex w-full max-w-[309px] flex-col items-start">
              <Logo width={109} height={40} />
              <p className="mt-[15px] text-[18px] leading-[25px] text-white">{SITE_TAGLINE}</p>
              <a
                href={contactEmail.href}
                className="rounded-pill text-ink hover:bg-sheet mt-[34px] inline-flex bg-white px-10 py-[15px] text-[18px] leading-6 font-semibold transition-colors"
              >
                {contactEmail.display}
              </a>
            </div>

            {/* 시안의 Legal 열은 x 789 에서 시작한다. Menu 열 폭은 최장 링크
                "커뮤니티" 의 글자 폭으로 정해지는데 Figma 쪽 한글 서체가
                Pretendard 보다 2px 넓다 → 시안 실측 폭을 최소값으로 고정한다. */}
            <FooterColumn title="Menu" links={FOOTER_MENU_LINKS} className="lg:min-w-[58px]" />
            <FooterColumn title="Legal" links={POLICY_LINKS} />
          </div>

          {/* 시안의 구분선은 패널 안쪽 폭(998) 이 아니라 992 이고, 가운데가 아니라
              콘텐츠 왼쪽 끝에 붙는다(실측 x 220~1211). */}
          <hr className="mt-6 w-full max-w-[992px] border-0 border-t border-white/40" />

          {/* 시안 푸터에는 IP 고지 문단이 없다. 넣으면 패널이 353px 을 넘겨
              모든 행이 밀리므로 `/policy/privacy` 로 옮겼다. */}
          <div className="mt-[23px] flex w-full flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <p className="text-ink-soft text-[16px] font-medium">{copyright}</p>
            <SnsList />
          </div>
        </div>
      </div>
    </footer>
  )
}

type FooterColumnProps = {
  title: string
  links: readonly NavItem[]
  className?: string
}

function FooterColumn({ title, links, className }: FooterColumnProps) {
  return (
    <nav aria-label={title} className={className}>
      <p className="text-[20px] leading-none font-medium text-white">{title}</p>
      {/* 링크 줄 간격은 시안 기준 28px(글자 16 + 간격 12). `leading-none` 은
          인라인 <a> 가 아니라 <li> 스트럿에 걸려야 실제 높이가 줄어든다. */}
      <ul className="mt-[14px] flex flex-col gap-3 leading-none">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="rounded-pill text-ink-soft text-[16px] whitespace-nowrap transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SnsList() {
  return (
    <ul className="flex items-center gap-1.5">
      {SNS_LINKS.map((sns) => (
        <li key={sns.href}>
          <Link
            href={sns.href}
            prefetch={false}
            aria-label={sns.label}
            className="flex size-8 items-center justify-center overflow-hidden rounded-[7px] bg-[#edf1f4] transition-opacity hover:opacity-80"
          >
            <Image
              src={sns.icon}
              alt=""
              width={Math.round(sns.width)}
              height={Math.round(sns.height)}
              style={{ width: sns.width, height: sns.height }}
              className={sns.hasOwnPlate ? 'size-8' : undefined}
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}
