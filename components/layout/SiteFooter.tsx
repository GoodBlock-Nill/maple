import Image from 'next/image'

import { FOOTER_CONFIG, FOOTER_PANEL_DEFAULTS } from '@/components/layout/footer-variants'
import { FooterIpNotice } from '@/components/layout/FooterIpNotice'
import { FooterLegalLinks } from '@/components/layout/FooterLegalLinks'
import { Logo } from '@/components/layout/Logo'
import { FOOTER_POLICY_LINKS } from '@/lib/constants/site'
import { resolveContactEmail, resolveCopyright, resolveIpNotice } from '@/lib/data/site-view'
import { getSiteSettings } from '@/lib/data/site'
import { hasPublicAsset } from '@/lib/utils/asset'
import { cn } from '@/lib/utils/cn'

import type { FooterVariant } from '@/components/layout/footer-variants'
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
  const ipNotice = resolveIpNotice(settings)
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
    '--footer-panel-max': `${config.panelMaxWidth ?? FOOTER_PANEL_DEFAULTS.panelMaxWidth}px`,
    '--footer-panel-px': `${config.panelPaddingX ?? FOOTER_PANEL_DEFAULTS.panelPaddingX}px`,
    '--footer-panel-pt': `${config.panelPaddingTop ?? FOOTER_PANEL_DEFAULTS.panelPaddingTop}px`,
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

      <div className="relative mx-auto w-full max-w-[1440px] px-4 pt-16 pb-12 xl:min-h-[var(--footer-height)] xl:px-0 xl:pt-[var(--footer-panel-top)] xl:pb-[70px]">
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
            'footer-ink rounded-panel mx-auto w-full max-w-[var(--footer-panel-max)] px-6 py-8 sm:px-10',
            /* 시안 패널 높이는 353 이지만 IP 고지 4줄이 들어가면 그 안에 안 맞을 수
               있다 — `h-` 대신 `min-h-` 를 써서 실제로 넘치면 패널이 늘어나게 두고
               잘리지 않게 한다(위·아래 섹션 배경 위 자유 배치라 늘어나도 안전하다).
               마스코트는 절대 위치라 늘어난 높이의 영향을 받지 않는다. */
            'xl:min-h-[353px] xl:px-[var(--footer-panel-px)] xl:pt-[var(--footer-panel-pt)] xl:pb-10',
          )}
        >
          {/* 시안 v3(footer-v3-home.png) §5 — 로고 · 연락처+약관 한 줄 · 구분선 ·
              IP 고지+저작권을 세로 한 줄(gap 20)로 쌓는다. 폭 열은 폰과 데스크톱이
              같은 순서라 lg 분기가 필요 없다(SNS 버튼은 오너 지시로 뺐다). */}
          <div className="flex w-full flex-col items-start gap-5">
            <Logo width={109} height={40} />

            <div className="flex flex-col gap-3">
              <p className="font-ui text-[16px] leading-[22px] font-medium text-[#fafafa]">
                문의 :{' '}
                <a href={contactEmail.href} className="transition-opacity hover:opacity-80">
                  {contactEmail.display}
                </a>
              </p>
              <FooterLegalLinks links={FOOTER_POLICY_LINKS} />
            </div>

            <hr className="w-full border-0 border-t border-white/40" />

            <div className="flex flex-col gap-6">
              <FooterIpNotice notice={ipNotice} />
              <p className="font-ui text-[15px] leading-[22px] font-medium text-[#c2c2c2]">
                {copyright}
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
