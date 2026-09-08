/**
 * CSV 파싱 · 직렬화 (RFC 4180).
 *
 * 라이브러리를 붙이지 않는 이유는 두 가지다. 하나는 관리자 화면이 다루는 CSV 가
 * "엑셀에서 열고 다시 저장한 파일" 한 종류뿐이라는 것, 다른 하나는 **미리보기가
 * 브라우저에서 돌아야 한다**는 것이다. 이 모듈은 순수 함수만 담아 서버 액션과
 * 클라이언트 컴포넌트가 같은 코드로 같은 결과를 낸다 — 미리보기에서 통과한 행이
 * 서버에서 다르게 해석되면 그 미리보기는 아무 의미가 없다.
 */

/**
 * 엑셀은 BOM 이 없으면 UTF-8 파일을 시스템 코드페이지(한국어 Windows 는 CP949)로
 * 읽어 한글이 전부 깨진다. 내보내기에는 반드시 붙이고, 가져오기에서는 벗긴다.
 */
export const UTF8_BOM = '\uFEFF'

/** 엑셀·구글 시트가 모두 안전하게 인식하는 줄바꿈. */
const ROW_SEPARATOR = '\r\n'

/**
 * CSV 텍스트 → 2차원 배열.
 *
 * 따옴표 안의 쉼표·줄바꿈·이스케이프된 따옴표("")를 모두 처리한다. 줄바꿈은
 * CRLF · LF · CR 을 모두 한 줄로 센다(맥 엑셀이 CR 만 쓰는 경우가 있다).
 */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith(UTF8_BOM) ? text.slice(1) : text
  const rows: string[][] = []

  let row: string[] = []
  let field = ''
  let isQuoted = false
  let index = 0

  const endField = (): void => {
    row.push(field)
    field = ''
  }

  const endRow = (): void => {
    endField()
    rows.push(row)
    row = []
  }

  while (index < source.length) {
    const char = source[index] ?? ''

    if (isQuoted) {
      if (char === '"') {
        // 따옴표 두 개는 값 안의 따옴표 한 개다.
        if (source[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }

        isQuoted = false
        index += 1
        continue
      }

      field += char
      index += 1
      continue
    }

    if (char === '"' && field === '') {
      isQuoted = true
      index += 1
      continue
    }

    if (char === ',') {
      endField()
      index += 1
      continue
    }

    if (char === '\r' || char === '\n') {
      endRow()
      index += char === '\r' && source[index + 1] === '\n' ? 2 : 1
      continue
    }

    field += char
    index += 1
  }

  // 마지막 줄에 줄바꿈이 없을 수 있다. 남은 버퍼가 있으면 한 줄로 마감한다.
  if (field !== '' || row.length > 0) {
    endRow()
  }

  return rows.filter((candidate) => !isBlankRow(candidate))
}

/** 값이 하나도 없는 줄(파일 끝의 빈 줄 등)은 데이터가 아니다. */
function isBlankRow(row: readonly string[]): boolean {
  return row.every((value) => value.trim() === '')
}

/** 쉼표·따옴표·줄바꿈이 있으면 감싸고, 값 안의 따옴표는 두 개로 늘린다. */
export function escapeCsvValue(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}

export function stringifyCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join(ROW_SEPARATOR)
}

/** 다운로드용 본문. BOM + CRLF + 끝줄 개행. */
export function toCsvFile(rows: readonly (readonly string[])[]): string {
  return `${UTF8_BOM}${stringifyCsv(rows)}${ROW_SEPARATOR}`
}

export type CsvRecord = {
  /** 파일에서의 줄 번호(헤더 = 1). 오류를 원본 위치로 되짚기 위한 값이다. */
  line: number
  values: Record<string, string>
}

export type CsvTable = {
  headers: readonly string[]
  records: readonly CsvRecord[]
  /** 파일 전체를 되돌리는 오류(헤더 누락 등). 있으면 records 는 비어 있다. */
  error: string | null
}

/**
 * 첫 줄을 헤더로 읽어 `{ 헤더: 값 }` 레코드로 바꾼다.
 *
 * 헤더는 소문자로 정규화하고 앞뒤 공백을 지운다. 엑셀에서 저장하면 헤더에 공백이
 * 섞여 들어오는 일이 잦은데, 그 한 칸 때문에 전체 파일이 반려되면 원인을 찾기 어렵다.
 */
export function parseCsvTable(text: string, requiredHeaders: readonly string[] = []): CsvTable {
  const rows = parseCsv(text)
  const headerRow = rows[0]

  if (headerRow === undefined) {
    return { headers: [], records: [], error: '빈 파일입니다.' }
  }

  const headers = headerRow.map((header) => header.trim().toLowerCase())
  const missing = requiredHeaders.filter((header) => !headers.includes(header))

  if (missing.length > 0) {
    return { headers, records: [], error: `필수 열이 없습니다: ${missing.join(', ')}` }
  }

  const records = rows.slice(1).map((row, index) => ({
    line: index + 2,
    values: Object.fromEntries(
      headers.map((header, column) => [header, (row[column] ?? '').trim()]),
    ),
  }))

  return { headers, records, error: null }
}
