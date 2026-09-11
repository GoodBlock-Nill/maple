import { describe, expect, it } from 'vitest'

import { IP_NOTICE } from '@/lib/constants/site'
import { segmentIpNoticeLine, splitIpNoticeLines } from '@/lib/utils/ip-notice'

describe('splitIpNoticeLines', () => {
  it('should split a newline-separated block into trimmed lines', () => {
    expect(splitIpNoticeLines('첫 줄\n둘째 줄\n셋째 줄')).toEqual(['첫 줄', '둘째 줄', '셋째 줄'])
  })

  it('should normalize CRLF when the text comes from a browser textarea', () => {
    expect(splitIpNoticeLines('첫 줄\r\n둘째 줄')).toEqual(['첫 줄', '둘째 줄'])
  })

  it('should drop empty and whitespace-only lines', () => {
    expect(splitIpNoticeLines('A\n\n   \nB')).toEqual(['A', 'B'])
  })

  it('should trim surrounding whitespace of each line', () => {
    expect(splitIpNoticeLines('  A  \n  B  ')).toEqual(['A', 'B'])
  })

  it('should return empty array when input is empty or whitespace only', () => {
    expect(splitIpNoticeLines('')).toEqual([])
    expect(splitIpNoticeLines('   \n  \n ')).toEqual([])
  })

  it('should reproduce the four design lines from the fallback constant', () => {
    // 폴백이 화면과 같은 경로로 쪼개지는지 — DB 값이 비어도 4줄이 유지된다.
    expect(splitIpNoticeLines(IP_NOTICE)).toHaveLength(4)
    expect(splitIpNoticeLines(IP_NOTICE)[0]).toBe(
      '본 서버는 넥슨(주)의 메이플스토리월드 플랫폼에서 공식 출시된 글자월드입니다.',
    )
  })
})

describe('segmentIpNoticeLine', () => {
  it('should return a single non-bold segment when there is no match', () => {
    expect(segmentIpNoticeLine('본 서비스는 이용약관 및 가이드라인을 준수하여 운영됩니다.')).toEqual([
      { text: '본 서비스는 이용약관 및 가이드라인을 준수하여 운영됩니다.', isBold: false },
    ])
  })

  it('should bold a single quoted term surrounded by plain text', () => {
    expect(segmentIpNoticeLine("'MapleStory' 및 관련 지식재산권은 NEXON Korea Corp.에 있습니다.")).toEqual([
      { text: "'MapleStory'", isBold: true },
      { text: ' 및 관련 지식재산권은 ', isBold: false },
      { text: 'NEXON Korea Corp.', isBold: true },
      { text: '에 있습니다.', isBold: false },
    ])
  })

  it('should prefer the longer term so MapleStory Worlds is not cut at MapleStory', () => {
    expect(
      segmentIpNoticeLine("'MapleStory Worlds' 및 관련 지식재산권은 Toben Studio Inc.에 있습니다."),
    ).toEqual([
      { text: "'MapleStory Worlds'", isBold: true },
      { text: ' 및 관련 지식재산권은 ', isBold: false },
      { text: 'Toben Studio Inc.', isBold: true },
      { text: '에 있습니다.', isBold: false },
    ])
  })

  it('should handle a bold term at the very start of the line with no leading segment', () => {
    expect(segmentIpNoticeLine("'MapleStory' 뿐이다")).toEqual([
      { text: "'MapleStory'", isBold: true },
      { text: ' 뿐이다', isBold: false },
    ])
  })

  it('should return empty array when input is an empty string', () => {
    expect(segmentIpNoticeLine('')).toEqual([])
  })
})
