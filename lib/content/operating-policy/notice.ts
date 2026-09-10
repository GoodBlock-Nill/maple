import type { PolicyNotice } from './types'

/**
 * 원문 첫머리의 인용 블록 — 넥슨·Toben 지식재산권 고지.
 *
 * 개인정보처리방침이 쓰는 고지(`site_settings.ip_notice` → `PolicyIpNotice`)와는
 * 다른 물건이다. 그쪽은 넥슨 IP 정책을 따라 따로 갱신되는 사이트 전역 문구라
 * 본문 밖 말미에 붙지만, 이 네 줄은 **운영정책 원문의 일부**다. 개정 이력에 함께
 * 실려야 하고 문서 맨 앞에 와야 해서 본문 안에 담는다.
 */
export const OPERATING_POLICY_NOTICE: PolicyNotice = {
  lines: [
    '본 서버는 넥슨(주)의 메이플스토리월드 플랫폼에서 공식 출시된 글자월드입니다.',
    "'MapleStory' 및 관련 지식재산권은 NEXON Korea Corp.에 있습니다.",
    "'MapleStory Worlds' 및 관련 지식재산권은 Toben Studio Inc.에 있습니다.",
    '본 서비스는 이용약관 및 가이드라인을 준수하여 운영됩니다.',
  ],
}
