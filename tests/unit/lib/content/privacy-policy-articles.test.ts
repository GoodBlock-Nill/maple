import { describe, expect, it } from 'vitest'

import { article, listsOf, tablesOf, textOf } from './privacy-policy-helpers'

/**
 * 조문별 문안 — 원문(`docs/개인정보처리방침_글자월드_v1_0.pdf`)과 글자가 같아야 하는 값들.
 *
 * 눈으로 세기 어려운 값(표의 행수 · 안전성 확보조치 7항목)과, 화면 다른 곳과 반드시
 * 같아야 하는 숫자·연락처(탈퇴 90일 · care@gjstory.com)를 못 박는다.
 */

describe('제2조 수집 항목 표', () => {
  it('should list all seven collection rows with the three original columns', () => {
    // Arrange
    const [table] = tablesOf(2)

    // Assert
    expect(table?.code).toBe('①')
    expect(table?.headers).toEqual(['구분', '수집 항목', '수집 방법'])
    expect(table?.rows).toHaveLength(7)
    expect(table?.rows.map((row) => row[0])).toEqual([
      '회원가입(필수)',
      '프로필 설정(선택)',
      '서비스 이용(필수)',
      '커뮤니티 이용',
      '1:1 문의(필수)',
      '1:1 문의(선택)',
      '자동 수집',
    ])
  })

  it('should keep the sensitive-data and optional-item clauses', () => {
    // Arrange
    const text = textOf(2)

    // Assert
    expect(text).toContain('민감정보와 주민등록번호 등 고유식별정보를 수집하지 않습니다')
    expect(text).toContain('선택항목을 제공하지 않아도 기본적인 서비스 이용에는 제한이 없습니다')
  })
})

/**
 * 회원 탈퇴 90일 보존·파기 규정(docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md §4.2).
 * 화면 문구(탈퇴 모달 · 복구 안내)와 방침이 같은 숫자를 말해야 한다.
 */
describe('제3조 처리 및 보유기간', () => {
  it('should state the 90-day retention after a withdrawal request', () => {
    // Arrange
    const text = textOf(3)

    // Assert
    expect(text).toContain('탈퇴일로부터 90일간 보존한 뒤 지체 없이 파기')
    expect(text).toContain(
      '파기 항목: 이메일 주소, 닉네임, 메이플스토리 월드 계정 UID, 메이플스토리 월드 프로필 코드',
    )
    expect(text).toContain('"탈퇴한 회원"으로 비식별 처리')
  })

  it('should keep the three statutory retention rows', () => {
    // Arrange
    const [table] = tablesOf(3)

    // Assert
    expect(table?.headers).toEqual(['보존 항목', '보존 근거', '보존 기간'])
    expect(table?.rows).toHaveLength(3)
    expect(table?.rows.map((row) => row.at(-1))).toEqual(['회원 탈퇴 후 1년', '3년', '3개월'])
    expect(table?.rows[1]?.[1]).toContain('전자상거래 등에서의 소비자보호에 관한 법률')
    expect(table?.rows[2]?.[1]).toBe('통신비밀보호법')
  })
})

describe('제5·6조 위탁과 국외 이전', () => {
  it('should publish the three processors of the v1.0 document', () => {
    // Arrange
    const [table] = tablesOf(5)

    // Assert
    expect(table?.headers).toEqual(['수탁업체', '위탁업무'])
    expect(table?.rows.map((row) => row[0])).toEqual([
      'Amazon Web Services, Inc.',
      'Sendbird, Inc.',
      '(주)가비아(하이웍스)',
    ])
    expect(table?.rows[2]?.[1]).toContain('이메일 호스팅')
  })

  it('should say the transfer abroad depends on the AWS·Sendbird region', () => {
    // Arrange
    const text = textOf(6)

    // Assert
    expect(text).toContain('AWS와 Sendbird가 모두 국내 리전으로 설정되어')
    expect(text).toContain('국외로 이전하지 않습니다')
  })
})

describe('제7조 파기 절차 및 방법', () => {
  it('should split the article into the two original subsections', () => {
    // Arrange
    const subsections = article(7).subsections ?? []

    // Assert
    expect(subsections.map((entry) => entry.title)).toEqual(['1. 파기 절차', '2. 파기 방법'])
  })

  it('should purge accounts automatically once the 90-day window passes', () => {
    // Arrange
    const text = textOf(7)

    // Assert
    expect(text).toContain('보존 기간(90일)이 지난 계정의 개인정보는 자동으로 파기')
    expect(text).toContain('복구·재생할 수 없는 방법으로 영구 삭제')
  })
})

describe('제8조 권리·의무 및 행사방법', () => {
  it('should list the four rights a user can exercise', () => {
    // Arrange
    const [list] = listsOf(8)

    // Assert
    expect(list?.items).toEqual([
      '개인정보 열람 요구',
      '개인정보 정정 또는 삭제 요구',
      '개인정보 처리정지 요구',
      '개인정보 수집·이용 동의의 철회(회원 탈퇴)',
    ])
  })

  it('should reference §12 and the officer mailbox for exercising them', () => {
    // Arrange
    const text = textOf(8)

    // Assert
    expect(text).toContain('제12조의 개인정보 보호책임자 이메일(care@gjstory.com)')
    expect(text).toContain('10일 이내에 조치합니다')
  })
})

describe('제9~11조', () => {
  it('should refuse membership to children under 14', () => {
    expect(textOf(9)).toContain('만 14세 미만 아동은 회원으로 가입할 수 없습니다')
  })

  it('should list all seven security measures', () => {
    // Arrange
    const [list] = listsOf(10)

    // Assert
    expect(list?.items).toHaveLength(7)
    expect(list?.items.at(0)).toContain('비밀번호를 수집·저장하지 않으며')
    expect(list?.items.at(-1)).toBe('내부관리계획을 수립·시행합니다.')
  })

  it('should explain how to refuse cookies in the three named browsers', () => {
    // Arrange
    const text = textOf(11)

    // Assert
    expect(text).toContain('Chrome: 설정 → 개인정보 및 보안 → 서드 파티 쿠키')
    expect(text).toContain('Edge: 설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터 관리')
    expect(text).toContain('Safari: 설정 → 개인정보 보호 → 쿠키 설정')
    expect(text).toContain('광고·마케팅 목적의 쿠키는 사용하지 않습니다')
  })
})

describe('제12조 보호책임자 및 열람청구', () => {
  it('should publish both the officer and the access-request desk', () => {
    // Arrange
    const subsections = article(12).subsections ?? []
    const text = textOf(12)

    // Assert
    expect(subsections.map((entry) => entry.title)).toEqual([
      '개인정보 보호책임자',
      '개인정보 열람청구 접수·처리 부서',
    ])
    expect(text).toContain('담당자: 글자월드 관리자')
    expect(text).toContain('담당 부서: 운영팀')
    expect(text.match(/care@gjstory\.com/gu)).toHaveLength(2)
    expect(text).not.toContain('contact@글자월드.co.kr')
  })
})

describe('제13~14조', () => {
  it('should keep the three remedy agencies with their contacts', () => {
    // Arrange
    const [table] = tablesOf(13)

    // Assert
    expect(table?.headers).toEqual(['기관', '연락처'])
    expect(table?.rows).toEqual([
      ['개인정보침해신고센터(한국인터넷진흥원)', '(국번 없이) 118 / https://privacy.kisa.or.kr'],
      ['개인정보분쟁조정위원회', '(국번 없이) 1833-6972 / https://www.kopico.go.kr'],
      ['경찰청 사이버수사국', '(국번 없이) 182 / https://ecrm.police.go.kr'],
    ])
  })

  it('should announce amendments 7 days ahead (30 for material ones)', () => {
    // Arrange
    const text = textOf(14)

    // Assert
    expect(text).toContain('시행일로부터 최소 7일 전')
    expect(text).toContain('시행일로부터 최소 30일 전')
    expect(text).toContain('공고일: 2026.09.18')
    expect(text).toContain('시행일: 2026.09.18')
  })
})
