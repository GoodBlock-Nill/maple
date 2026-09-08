import { describe, expect, it } from 'vitest'

import { toCsvFile } from '@/lib/utils/csv'
import { inferJobGroup, RANKING_CSV_HEADERS, validateRankingCsv } from '@/lib/validation/rankings'

const HEADER = 'rank,character_name,level,job,job_group,guild,exp,avatar_url'

function csv(...rows: readonly string[]): string {
  return [HEADER, ...rows].join('\n')
}

describe('validateRankingCsv', () => {
  it('should accept a contiguous snapshot starting at rank 1', () => {
    const result = validateRankingCsv(
      csv(
        '1,설윤,212,비숍,adventurer,MapleStar,98.7B,',
        '2,후니월드,211,플레임위자드,,글자월드,98.4B,',
      ),
    )

    expect(result.issues).toEqual([])
    expect(result.isValid).toBe(true)
    expect(result.rows).toHaveLength(2)
  })

  it('should map optional columns to null so the client can fall back', () => {
    const [row] = validateRankingCsv(csv('1,설윤,212,비숍,adventurer,,,')).rows

    expect(row).toMatchObject({ guild: null, exp: null, avatar_url: null })
  })

  it('should reject a gap in the rank sequence', () => {
    // 순위가 빠진 표는 "부분 성공"이 아니라 그냥 틀린 표다.
    const result = validateRankingCsv(csv('1,가,200,비숍,,,,', '3,나,199,비숍,,,,'))

    expect(result.isValid).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes('2위가 없습니다'))).toBe(true)
  })

  it('should reject a snapshot that does not start at 1', () => {
    const result = validateRankingCsv(csv('2,가,200,비숍,,,,', '3,나,199,비숍,,,,'))

    expect(result.isValid).toBe(false)
  })

  it('should report duplicated ranks with the conflicting line', () => {
    const result = validateRankingCsv(csv('1,가,200,비숍,,,,', '1,나,199,비숍,,,,'))

    expect(result.issues[0]).toMatchObject({ line: 3 })
    expect(result.issues[0]?.message).toContain('중복')
  })

  it('should allow duplicated character names', () => {
    // 동명이인은 실제로 존재한다(시드 데이터에도 있다).
    const result = validateRankingCsv(csv('1,설윤,212,비숍,,,,', '2,설윤,211,비숍,,,,'))

    expect(result.isValid).toBe(true)
  })

  it('should reject a non integer level', () => {
    const result = validateRankingCsv(csv('1,가,20.5,비숍,,,,'))

    expect(result.isValid).toBe(false)
    expect(result.issues[0]?.message).toContain('레벨')
  })

  it('should reject an unknown job group', () => {
    expect(validateRankingCsv(csv('1,가,200,비숍,legend,,,')).isValid).toBe(false)
  })

  it('should reject a file without the required headers', () => {
    const result = validateRankingCsv('rank,name\n1,가')

    expect(result.issues[0]).toEqual({
      line: 0,
      message: '필수 열이 없습니다: character_name, level, job',
    })
  })

  it('should reject a header-only file', () => {
    expect(validateRankingCsv(HEADER).issues[0]?.message).toBe('데이터 행이 없습니다.')
  })

  it('should read a file exported with a BOM and CRLF endings', () => {
    const file = toCsvFile([[...RANKING_CSV_HEADERS], ['1', '설윤', '212', '비숍', '', '', '', '']])

    expect(validateRankingCsv(file).isValid).toBe(true)
  })

  it('should keep the row order of the file for the preview', () => {
    const result = validateRankingCsv(csv('1,가,200,비숍,,,,', '2,나,199,비숍,,,,'))

    expect(result.rows.map((row) => row.character_name)).toEqual(['가', '나'])
  })
})

describe('inferJobGroup', () => {
  it('should map known jobs to their group', () => {
    expect(inferJobGroup('비숍')).toBe('adventurer')
    expect(inferJobGroup('플레임위자드')).toBe('cygnus')
    expect(inferJobGroup('데몬슬레이어')).toBe('demon')
  })

  it('should ignore spaces inside the job name', () => {
    expect(inferJobGroup('플레임 위자드')).toBe('cygnus')
  })

  it('should fall back to adventurer for unknown jobs', () => {
    // job_group 은 NOT NULL 이다. 모르는 직업 하나 때문에 업로드를 막지는 않는다.
    expect(inferJobGroup('신규직업')).toBe('adventurer')
  })
})
