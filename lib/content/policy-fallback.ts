import {
  OPERATING_POLICY_ADDENDUM,
  OPERATING_POLICY_EFFECTIVE_DATE,
  OPERATING_POLICY_NOTICE,
  OPERATING_POLICY_SECTIONS,
  OPERATING_POLICY_TITLE,
  OPERATING_POLICY_VERSION,
} from '@/lib/content/operating-policy'
import {
  MARKETING_CONSENT_DESCRIPTION,
  MARKETING_CONSENT_EFFECTIVE_DATE,
  MARKETING_CONSENT_HEADING,
  MARKETING_CONSENT_SECTIONS,
  MARKETING_CONSENT_TITLE,
  MARKETING_CONSENT_VERSION,
} from '@/lib/content/marketing-consent'
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_VERSION,
} from '@/lib/content/privacy-policy'

import type {
  PolicyAddendum,
  PolicyNotice,
  PolicySection,
} from '@/lib/content/operating-policy/types'
import type { LegalSlug } from '@/lib/data/legal'

/**
 * 코드 안의 정책 문안 — DB 발행본이 없을 때의 폴백.
 *
 * 이 값들은 `supabase/migrations/20260908002200_legal_documents.sql` 의 최초 발행본과
 * 같은 문안이다(그 시드를 이 데이터에서 생성했다). 관리자가 개정하면 DB 쪽만
 * 앞서 나가고 여기는 "최초 문안"으로 굳는다. 지우지 않는 이유는 하나다 — 약관
 * 페이지는 DB 가 흔들려도 반드시 열려야 한다.
 *
 * 제목(h1)은 문서 제목이 아니라 헤더 링크(`POLICY_LINKS`)의 라벨을 쓴다. 두 표기가
 * 다른 문서가 있고(개인정보처리방침 ↔ 글자월드 개인정보처리방침), 화면에서는
 * 링크를 눌러 들어온 이름이 그대로 보여야 한다.
 */
export type PolicyFallback = {
  /** `<h1>` 에 그리는 이름. */
  heading: string
  /** 문서 정식 명칭. 메타데이터 타이틀과 관리자 문서명이 이 값이다. */
  title: string
  description: string
  version: string
  /** `2026년 9월 18일` 표기. */
  effectiveDate: string
  sections: readonly PolicySection[]
  /** 1장 앞에 오는 고지 블록. 목차에는 오르지 않는다. */
  notice?: PolicyNotice
  addendum?: PolicyAddendum
  /** 구조화 문안이 없는 문서의 안내 문단(디스코드). */
  paragraphs: readonly string[]
  /** 넥슨 IP 고지를 이 문서에 싣는지 여부. */
  hasIpNotice: boolean
}

const DISCORD_PARAGRAPHS = [
  '글자월드 공식 디스코드 서버는 모두가 안전하게 즐길 수 있는 공간을 목표로 운영됩니다.',
  '정식 운영정책 문안은 준비 중입니다. 확정되는 대로 이 페이지에 게시합니다.',
] as const

export const POLICY_FALLBACKS: Record<LegalSlug, PolicyFallback> = {
  privacy: {
    heading: '개인정보처리방침',
    title: PRIVACY_POLICY_TITLE,
    description:
      '글자월드가 수집하는 개인정보 항목, 처리 목적, 보유 기간, 위탁·국외 이전, 이용자의 권리 행사 방법을 안내합니다.',
    version: PRIVACY_POLICY_VERSION,
    effectiveDate: PRIVACY_POLICY_EFFECTIVE_DATE,
    sections: PRIVACY_POLICY_SECTIONS,
    paragraphs: [],
    hasIpNotice: true,
  },
  discord: {
    heading: '디스코드 운영정책',
    title: '디스코드 운영정책',
    description: DISCORD_PARAGRAPHS[0],
    version: PRIVACY_POLICY_VERSION,
    effectiveDate: PRIVACY_POLICY_EFFECTIVE_DATE,
    sections: [],
    paragraphs: DISCORD_PARAGRAPHS,
    hasIpNotice: false,
  },
  marketing: {
    heading: MARKETING_CONSENT_HEADING,
    title: MARKETING_CONSENT_TITLE,
    description: MARKETING_CONSENT_DESCRIPTION,
    version: MARKETING_CONSENT_VERSION,
    effectiveDate: MARKETING_CONSENT_EFFECTIVE_DATE,
    sections: MARKETING_CONSENT_SECTIONS,
    paragraphs: [],
    hasIpNotice: false,
  },
  operating: {
    heading: OPERATING_POLICY_TITLE,
    title: OPERATING_POLICY_TITLE,
    description:
      '글자월드 이용 원칙, 이용자 권리·의무, 금지행위와 제재 기준, 복구·환불 정책, 아동·청소년 보호정책과 이의신청 절차를 안내합니다.',
    version: OPERATING_POLICY_VERSION,
    effectiveDate: OPERATING_POLICY_EFFECTIVE_DATE,
    sections: OPERATING_POLICY_SECTIONS,
    notice: OPERATING_POLICY_NOTICE,
    addendum: OPERATING_POLICY_ADDENDUM,
    paragraphs: [],
    hasIpNotice: false,
  },
}
