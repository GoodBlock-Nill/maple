export type FooterVariant =
  'home' | 'news' | 'community' | 'guide' | 'ranking' | 'support' | 'about'

export type FooterMascot = {
  src: string
  /** 렌더 크기(1440 기준). 원본 GIF는 저해상도라 업스케일된다. */
  width: number
  height: number
  /** 푸터 섹션 좌상단 기준 절대 좌표. */
  left: number
  top: number
  /** <xl 에서의 축소 폭. */
  mobileWidth: number
}

export type FooterConfig = {
  background: string
  /**
   * `background` 자산이 아직 없을 때 대신 쓰는 일러스트.
   * 단색으로 두면 시안의 풍경 실루엣이 통째로 사라지므로, 결이 가장 가까운
   * 기존 배경을 빌려 온다. TODO(asset)
   */
  backgroundFallback?: string
  /** 배경 PNG의 투명 영역 뒤에 깔리는 색. */
  backgroundColor: string
  /**
   * 홈 배경만 JPG로 구워지며 상단 투명부가 흰색이 되었다.
   * 초원색을 곱연산해 앞 섹션의 숲과 잇는 보정 레이어가 필요하다.
   */
  needsGrassPatch: boolean
  /** 데스크톱 섹션 높이. */
  height: number
  /** 글래스 패널 상단 오프셋. 홈 165 / 703 변형 280 / 631 변형 208. */
  panelTop: number
  panelClass: string
  mascot: FooterMascot
}

/** 서브 페이지 공통값: 패널 높이 353 + 하단 여백 70 을 섹션 높이에서 뺀다. */
function subPanelTop(height: number): number {
  return height - 353 - 70
}

export const FOOTER_CONFIG: Record<FooterVariant, FooterConfig> = {
  home: {
    background: '/images/footer/home-bg.jpg',
    backgroundColor: '#4f8f3a',
    needsGrassPatch: true,
    height: 588,
    panelTop: 165,
    panelClass: 'glass-panel',
    mascot: {
      src: '/images/footer/home-mascot.gif',
      width: 276,
      height: 149,
      left: 1132,
      top: 219,
      mobileWidth: 180,
    },
  },
  news: {
    background: '/images/news/footer-bg.jpg',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 703,
    panelTop: subPanelTop(703),
    panelClass: 'glass-panel-sub',
    mascot: {
      src: '/images/news/mascot-footer.gif',
      width: 231,
      height: 178,
      left: 1172,
      top: 310,
      mobileWidth: 150,
    },
  },
  community: {
    background: '/images/community/footer-bg.png',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 703,
    panelTop: subPanelTop(703),
    panelClass: 'glass-panel-sub',
    mascot: {
      src: '/images/community/mascot-footer.gif',
      width: 154,
      height: 199,
      left: 1182,
      top: 319,
      mobileWidth: 110,
    },
  },
  guide: {
    background: '/images/guide/footer-bg.png',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 631,
    panelTop: subPanelTop(631),
    panelClass: 'glass-panel-sub',
    mascot: {
      src: '/images/guide/mascot-footer.gif',
      width: 182,
      height: 235,
      left: 1243,
      top: 240,
      mobileWidth: 120,
    },
  },
  ranking: {
    background: '/images/ranking/footer-bg.png',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 631,
    panelTop: subPanelTop(631),
    /* 랭킹만 패널 그라데이션이 초록빛 회색이다(시안 실측). */
    panelClass: 'glass-panel-ranking',
    mascot: {
      src: '/images/ranking/mascot-footer.gif',
      width: 248,
      height: 200,
      left: 1180,
      top: 246,
      mobileWidth: 160,
    },
  },
  support: {
    background: '/images/support/footer-bg.png',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 631,
    panelTop: subPanelTop(631),
    panelClass: 'glass-panel-sub',
    mascot: {
      src: '/images/support/mascot-footer.gif',
      width: 216,
      height: 198,
      left: 1154,
      top: 236,
      mobileWidth: 140,
    },
  },
  about: {
    background: '/images/about/footer-bg.png',
    /* 소개 푸터 배경이 도착하기 전까지는 홈 푸터의 잔디 사진을 빌려 쓴다.
       단색 하늘색보다 시안(풀숲 위 글래스 패널)의 인상에 훨씬 가깝다. */
    backgroundFallback: '/images/footer/home-bg.jpg',
    /* 앞 섹션(보라→시안 밴드)의 끝 색. 두 배경 모두 없을 때의 마지막 폴백. */
    backgroundColor: '#7fd8f2',
    needsGrassPatch: false,
    height: 703,
    panelTop: subPanelTop(703),
    panelClass: 'glass-panel-sub',
    mascot: {
      src: '/images/about/mascot-footer.gif',
      width: 214,
      height: 169,
      left: 1202,
      top: 339,
      mobileWidth: 140,
    },
  },
}
