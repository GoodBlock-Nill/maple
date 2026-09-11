import Image from 'next/image'
import Link from 'next/link'

import { FooterColumn } from '@/components/layout/FooterColumn'
import { FOOTER_CONFIG, FOOTER_PANEL_DEFAULTS } from '@/components/layout/footer-variants'
import { Logo } from '@/components/layout/Logo'
import {
  FOOTER_MENU_LINKS,
  FOOTER_POLICY_LINKS,
  SITE_TAGLINE,
  SNS_LINKS,
} from '@/lib/constants/site'
import { resolveContactEmail, resolveCopyright } from '@/lib/data/site-view'
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
  const config = FOOTER_CONFIG[variant]
  const { mascot } = config
  const contactStyle = config.contactStyle ?? FOOTER_PANEL_DEFAULTS.contactStyle
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
    '--footer-brand-width': `${config.brandWidth ?? FOOTER_PANEL_DEFAULTS.brandWidth}px`,
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
            'footer-ink rounded-panel mx-auto w-full max-w-[var(--footer-panel-max)] px-6 py-8 sm:px-10',
            'xl:h-[353px] xl:px-[var(--footer-panel-px)] xl:pt-[var(--footer-panel-pt)] xl:pb-10',
          )}
        >
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-[100px]">
            <div className="flex w-full flex-col items-start lg:w-[var(--footer-brand-width)]">
              <Logo width={109} height={40} />
              {/* 태그라인 줄바꿈 위치는 시안 그대로여야 해서 폭을 309 로 묶는다 —
                  좌측 블록이 더 넓은 변형(마이페이지 v2 371)에서도 같은 자리에서 접힌다. */}
              <p className="text-body-lg mt-[15px] max-w-[309px] leading-[25px] text-white">
                {SITE_TAGLINE}
              </p>

              {contactStyle === 'text' ? (
                /* 시안 v2 §5 — 알약 대신 "문의하기" 제목 + 메일 주소 텍스트. */
                <div className="mt-8 flex flex-col gap-2">
                  <p className="text-[18px] leading-[26px] font-medium text-white">문의하기</p>
                  <a
                    href={contactEmail.href}
                    className="w-fit text-[16px] leading-[22px] text-white transition-opacity hover:opacity-80"
                  >
                    {contactEmail.display}
                  </a>
                </div>
              ) : (
                <a
                  href={contactEmail.href}
                  className="rounded-pill text-ink hover:bg-sheet text-body-lg mt-[34px] inline-flex bg-white px-10 py-[15px] leading-6 font-semibold transition-colors"
                >
                  {contactEmail.display}
                </a>
              )}
            </div>

            {/* 폰에서는 두 열이 나란히 선다(시안 v2 모바일 푸터). `lg:contents` 로
                lg 이상에서는 이 래퍼가 사라져 세 블록이 한 줄의 flex 아이템이 된다.

                시안의 Legal 열은 x 889(마이페이지 변형) 에서 시작한다. Menu 열 폭은
                최장 링크 "커뮤니티" 의 글자 폭으로 정해지는데 Figma 쪽 한글 서체가
                Pretendard 보다 2px 넓다 → 시안 실측 폭을 최소값으로 고정한다. */}
            <div className="flex gap-16 lg:contents">
              <FooterColumn title="Menu" links={FOOTER_MENU_LINKS} className="lg:min-w-[58px]" />
              <FooterColumn title="Legal" links={FOOTER_POLICY_LINKS} />
            </div>
          </div>

          {/* 시안의 구분선은 패널 안쪽 폭(998) 이 아니라 992 이고, 가운데가 아니라
              콘텐츠 왼쪽 끝에 붙는다(실측 x 220~1211). */}
          <hr className="mt-6 w-full max-w-[992px] border-0 border-t border-white/40" />

          {/* 시안 푸터에는 IP 고지 문단이 없다. 넣으면 패널이 353px 을 넘겨
              모든 행이 밀리므로 `/policy/privacy` 로 옮겼다. */}
          <div className="mt-[23px] flex w-full flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <p className="text-ink-soft text-ui-sm font-medium">{copyright}</p>
            <SnsList />
          </div>
        </div>
      </div>
    </footer>
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
            className="tap-area flex size-8 items-center justify-center rounded-[7px] bg-[#edf1f4] transition-opacity hover:opacity-80"
          >
            <Image
              src={sns.icon}
              alt=""
              width={Math.round(sns.width)}
              height={Math.round(sns.height)}
              style={{ width: sns.width, height: sns.height }}
              className={sns.hasOwnPlate ? 'size-8 rounded-[7px]' : undefined}
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}
