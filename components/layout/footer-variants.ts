export type FooterVariant =
  'home' | 'news' | 'community' | 'guide' | 'ranking' | 'support' | 'about' | 'mypage'

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
  /** 시안에서 좌우가 뒤집혀 있는 마스코트. */
  isFlipped?: boolean
  /**
   * 저해상도 GIF 를 원본보다 크게 표시할 때 `pixel-art` 클래스를 붙일지.
   * 전 변형이 GIF·업스케일이라 기본값은 true — 향후 원본 크기 정지 이미지로
   * 바뀌면 개별적으로 false 를 지정한다.
   */
  pixelArt?: boolean
}

/** 연락처 블록 모양 — 흰 알약 버튼(기본) / "문의하기" 제목 + 이메일 텍스트. */
export type FooterContactStyle = 'pill' | 'text'

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
  /**
   * 패널 최대 폭(1440 기준). v2 푸터 패널 통일(오너 지시 2026-09-11)로 전 변형이
   * 마이페이지/고객지원 v2 값인 1200(x=120)을 공유한다.
   * 값을 바꾸면 `mx-auto` 가 알아서 가운데로 놓으므로 x 좌표는 따라온다.
   */
  panelMaxWidth?: number
  /** 패널 안쪽 좌우 패딩(1440 기준). v2 통일값 140. */
  panelPaddingX?: number
  /** 패널 안쪽 위 패딩. v2 통일값 40. */
  panelPaddingTop?: number
  /** 좌측 블록(로고·태그라인·연락처) 폭. v2 통일값 371(시안 실측). */
  brandWidth?: number
  /** 연락처 표시 방식. v2 통일값은 "문의하기" 제목 + 이메일 텍스트 블록(시안 §5). */
  contactStyle?: FooterContactStyle
  mascot: FooterMascot
}

/**
 * `FooterConfig` 의 선택 항목 기본값 — v2 푸터 패널 통일(오너 지시 2026-09-11)로
 * 전 변형이 고객지원 v2(166:13652) 패널을 공유한다: 1200 폭 @ x=120.
 */
export const FOOTER_PANEL_DEFAULTS = {
  panelMaxWidth: 1200,
  panelPaddingX: 140,
  panelPaddingTop: 40,
  brandWidth: 371,
  contactStyle: 'text',
} as const satisfies Required<
  Pick<
    FooterConfig,
    'panelMaxWidth' | 'panelPaddingX' | 'panelPaddingTop' | 'brandWidth' | 'contactStyle'
  >
>

/** 서브 페이지 공통값: 패널 높이 353 + 하단 여백 70 을 섹션 높이에서 뺀다. */
function subPanelTop(height: number): number {
  return height - 353 - 70
}

/**
 * v2 푸터 패널 통일(오너 지시 2026-09-11) — 모든 변형이 고객지원 v2(166:13652)와
 * 같은 1200 폭 @ x=120 패널을 쓴다. 패널이 1300@x=70 → 1200@x=120 으로 좁아지며
 * 우측 끝이 1370 → 1320 으로 50px 안쪽으로 들어왔다. 마스코트는 패널 우상단과의
 * 겹침 관계를 유지하도록 각 변형에서 `left` 를 그대로 -50 만큼 옮긴다(고객지원·
 * 마이페이지는 이미 1200 패널 기준 좌표라 이번 이동 대상에서 제외).
 */
export const FOOTER_CONFIG: Record<FooterVariant, FooterConfig> = {
  home: {
    background: '/images/footer/home-bg.jpg',
    backgroundColor: '#4f8f3a',
    needsGrassPatch: true,
    height: 588,
    panelTop: 165,
    panelClass: 'glass-panel-dark',
    mascot: {
      src: '/images/footer/home-mascot.gif',
      width: 276,
      height: 149,
      /* v2 패널 통일로 우측 끝이 50px 안쪽으로 들어와 1132 → 1082. */
      left: 1082,
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
    /* v2 푸터 패널 통일로 밝은 배경 변형도 어두운 글래스를 쓴다(오너 지시 2026-09-11). */
    panelClass: 'glass-panel-dark',
    mascot: {
      src: '/images/news/mascot-footer.gif',
      width: 231,
      /* 원본(164×126) 비율대로 231 폭에 맞춰 계산한 실제 렌더 높이는
         177.47px(→177) 이다. 디자인값 178 과의 1px 차는 Next Image
         aspect-ratio 경고를 유발해 렌더 실측치로 맞춘다(화면 크기는 원래도
         auto 높이라 이 값의 영향을 받지 않는다). */
      height: 177,
      /* v2 패널 통일로 우측 끝이 50px 안쪽으로 들어와 1172 → 1122. */
      left: 1122,
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
    /* v2 푸터 패널 통일로 밝은 배경 변형도 어두운 글래스를 쓴다(오너 지시 2026-09-11). */
    panelClass: 'glass-panel-dark',
    mascot: {
      src: '/images/community/mascot-footer.gif',
      width: 154,
      /* 원본(52×67) 비율대로 154 폭에 맞춰 계산한 실제 렌더 높이는
         198.42px(→198) 이다. 디자인값 199 와의 1px 차는 Next Image
         aspect-ratio 경고를 유발해 렌더 실측치로 맞춘다(화면 크기는 원래도
         auto 높이라 이 값의 영향을 받지 않는다). */
      height: 198,
      /* v2 패널 통일로 우측 끝이 50px 안쪽으로 들어와 1182 → 1132. */
      left: 1132,
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
    /* v2 푸터 패널 통일로 밝은 배경 변형도 어두운 글래스를 쓴다(오너 지시 2026-09-11). */
    panelClass: 'glass-panel-dark',
    mascot: {
      src: '/images/guide/mascot-footer.gif',
      width: 182,
      height: 235,
      /* v2 패널 통일로 우측 끝이 50px 안쪽으로 들어와 1243 → 1193. */
      left: 1193,
      top: 240,
      mobileWidth: 120,
      /* 원본이 290×375 로 다른 변형과 달리 실제로는 다운스케일된다(실측
         `sips -g pixelWidth -g pixelHeight`) — pixel-art 를 붙이면 오히려
         계단 현상이 생겨 다른 변형과 달리 기본값을 끈다. */
      pixelArt: false,
    },
  },
  ranking: {
    background: '/images/ranking/footer-bg.png',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 631,
    panelTop: subPanelTop(631),
    /* v2 푸터 패널 통일로 랭킹 전용 그라데이션 대신 어두운 글래스를 쓴다
       (오너 지시 2026-09-11). `.glass-panel-ranking` 클래스 자체는 유지한다. */
    panelClass: 'glass-panel-dark',
    mascot: {
      src: '/images/ranking/mascot-footer.gif',
      width: 248,
      height: 200,
      /* v2 패널 통일로 우측 끝이 50px 안쪽으로 들어와 1180 → 1130. */
      left: 1130,
      top: 246,
      mobileWidth: 160,
    },
  },
  /**
   * 고객지원 — v2 시안(§7, 고객지원_푸터 166:13652)이 이번 통일의 기준이다.
   * 패널 톤도 시안 실측 평균 휘도 100~125(눈 숲 위)로 `glass-panel-sub` 보다
   * `glass-panel-dark` 가 맞는다.
   */
  support: {
    background: '/images/support/footer-bg.png',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 631,
    panelTop: subPanelTop(631),
    panelClass: 'glass-panel-dark',
    mascot: {
      src: '/images/support/mascot-footer.gif',
      width: 216,
      height: 198,
      /* 시안 v2 실측 좌표 — 구 패널(1154)에서 40px 왼쪽으로. */
      left: 1094,
      top: 236,
      mobileWidth: 140,
    },
  },
  /**
   * 마이페이지 — 언덕·꽃·나무 위 여우(시안 v2 §5, 178:20156).
   *
   * v1 과 달리 본문이 이 배경을 덮지 않는다. 시안 v2 는 회원 탈퇴 블록 아래
   * 32px 에서 푸터 섹션(939)이 그대로 시작한다(`MyPageShell` 참고).
   */
  mypage: {
    background: '/images/mypage/footer-bg.png',
    backgroundColor: '#fafafa',
    needsGrassPatch: false,
    height: 939,
    panelTop: subPanelTop(939),
    panelClass: 'glass-panel-dark',
    mascot: {
      src: '/images/mypage/mascot-footer.gif',
      width: 207,
      /* 원본(51×41) 비율대로 207 폭에 맞춘 실제 렌더 높이 166.4 → 166.
         디자인값 167 과의 1px 차는 next/image 의 aspect-ratio 경고를 부른다. */
      height: 166,
      left: 1080,
      top: 570,
      mobileWidth: 120,
    },
  },
  about: {
    /* v2: Figma 재수출본으로 교체(선명도 개선). 파일명을 바꿔 next/image 최적화
       캐시가 구본을 계속 서빙하는 문제를 우회한다. */
    background: '/images/about/footer-bg-v2.png',
    /* 앞 섹션(보라→시안 밴드)의 끝 색. 배경이 없을 때의 마지막 폴백. */
    backgroundColor: '#8dd5ff',
    needsGrassPatch: false,
    height: 703,
    panelTop: subPanelTop(703),
    /* 소개만 배경이 어두워서 밝은 회색(`-sub`)을 얹으면 시안보다 20 정도
       밝아진다. 홈과 같은 어두운 글래스 값이 시안 실측과 맞는다. */
    panelClass: 'glass-panel-dark',
    mascot: {
      /* 시안의 마스코트는 애니메이션 GIF 이고 좌우가 뒤집혀 있다. */
      src: '/images/about/mascot-footer.gif',
      width: 214,
      height: 169,
      /* v2 패널 통일로 우측 끝이 50px 안쪽으로 들어와 1202 → 1152. */
      left: 1152,
      top: 338,
      mobileWidth: 140,
      isFlipped: true,
    },
  },
}
