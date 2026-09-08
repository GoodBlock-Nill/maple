import { describe, expect, it } from 'vitest'

import {
  escapeCsvValue,
  parseCsv,
  parseCsvTable,
  stringifyCsv,
  toCsvFile,
  UTF8_BOM,
} from '@/lib/utils/csv'

describe('parseCsv', () => {
  it('should split a simple comma separated file', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('should strip the byte order mark from the first field', () => {
    // BOM 을 남기면 첫 헤더가 "﻿id" 가 되어 어떤 열도 매칭되지 않는다.
    expect(parseCsv(`${UTF8_BOM}id,name\n1,글자`)[0]?.[0]).toBe('id')
  })

  it('should keep commas that live inside quotes', () => {
    expect(parseCsv('name,note\n"펫, 영구","a,b"')[1]).toEqual(['펫, 영구', 'a,b'])
  })

  it('should unescape doubled quotes', () => {
    expect(parseCsv('note\n"그는 ""안녕"" 이라고 했다"')[1]).toEqual(['그는 "안녕" 이라고 했다'])
  })

  it('should keep newlines that live inside quotes', () => {
    expect(parseCsv('note\n"첫 줄\n둘째 줄"')).toEqual([['note'], ['첫 줄\n둘째 줄']])
  })

  it('should treat CRLF and CR as row separators', () => {
    expect(parseCsv('a,b\r\n1,2\r3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('should drop blank rows such as a trailing newline', () => {
    expect(parseCsv('a\n1\n\n')).toEqual([['a'], ['1']])
  })

  it('should return an empty list for an empty file', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('escapeCsvValue', () => {
  it('should leave plain values untouched', () => {
    expect(escapeCsvValue('글자월드')).toBe('글자월드')
  })

  it('should quote values containing a comma, quote or newline', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"')
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvValue('a\nb')).toBe('"a\nb"')
  })
})

describe('stringifyCsv', () => {
  it('should join rows with CRLF', () => {
    expect(
      stringifyCsv([
        ['a', 'b'],
        ['1', '2'],
      ]),
    ).toBe('a,b\r\n1,2')
  })

  it('should round-trip values that need escaping', () => {
    const rows = [
      ['name', 'note'],
      ['펫, 영구', 'say "hi"\n두 줄'],
    ]

    expect(parseCsv(stringifyCsv(rows))).toEqual(rows)
  })
})

describe('toCsvFile', () => {
  it('should prepend the BOM so Excel reads UTF-8', () => {
    const file = toCsvFile([['이름'], ['글자']])

    expect(file.startsWith(UTF8_BOM)).toBe(true)
    expect(file.endsWith('\r\n')).toBe(true)
  })

  it('should still parse back to the original rows', () => {
    const rows = [
      ['id', 'name'],
      ['1', '글자, 월드'],
    ]

    expect(parseCsv(toCsvFile(rows))).toEqual(rows)
  })
})

describe('parseCsvTable', () => {
  it('should map values by lowercased header names', () => {
    const table = parseCsvTable(' ID , Name \n1,글자')

    expect(table.error).toBeNull()
    expect(table.records).toEqual([{ line: 2, values: { id: '1', name: '글자' } }])
  })

  it('should report missing required headers instead of guessing', () => {
    const table = parseCsvTable('name\n글자', ['id', 'name'])

    expect(table.error).toBe('필수 열이 없습니다: id')
    expect(table.records).toEqual([])
  })

  it('should fill missing trailing cells with empty strings', () => {
    const table = parseCsvTable('a,b,c\n1,2')

    expect(table.records[0]?.values).toEqual({ a: '1', b: '2', c: '' })
  })

  it('should number lines from the file, header included', () => {
    const table = parseCsvTable('a\n1\n2')

    expect(table.records.map((record) => record.line)).toEqual([2, 3])
  })

  it('should reject an empty file', () => {
    expect(parseCsvTable('').error).toBe('빈 파일입니다.')
  })
})
