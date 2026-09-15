/**
 * 저장소 문서(`docs/admin/*.html`)를 관리자 앱의 `public/docs/` 로 복사하는 순수 로직.
 *
 * 문서의 단일 출처는 `docs/admin/` 이다. 관리자 앱 안에 사본을 커밋하면 두 벌이
 * 생기고 반드시 어긋난다. 그래서 빌드·개발 서버 기동 때마다 여기서 한 벌 떠 온다
 * (`public/docs/` 는 .gitignore 대상).
 *
 * 실행 스크립트(`sync-docs.mjs`)와 분리해 둔 이유는 테스트 때문이다 — 복사 규칙만
 * 임시 디렉터리에서 검증할 수 있다.
 */

import { copyFile, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 공개할 문서 허용 목록. `키 = public/docs/ 아래 파일명`, `값 = admin/scripts 기준 상대 경로`.
 * 문서를 더 열려면 여기 한 줄만 추가한다(경로는 스크립트 위치 기준으로 해석된다).
 *
 * @type {Readonly<Record<string, string>>}
 */
export const DOC_SOURCES = Object.freeze({
  'screens.html': '../../docs/admin/SCREENS-GUIDE.html',
})

/** `public/docs` — 앱 루트(admin/) 기준 산출물 디렉터리. */
export const DOCS_OUT_DIR = 'public/docs'

/**
 * 허용 목록의 문서를 `outDir` 로 복사한다.
 *
 * 원본이 하나라도 없으면 **아무것도 복사하지 않고** 빠진 것을 모두 모아 던진다.
 * 반쯤 복사된 산출물로 빌드가 통과하는 편보다 즉시 멈추는 편이 낫다.
 *
 * @param {{ sources: Record<string, string>, outDir: string }} options
 * @returns {Promise<Array<{ name: string, from: string, to: string, bytes: number }>>} 복사한 파일 목록
 */
export async function syncDocs({ sources, outDir }) {
  const entries = Object.entries(sources)
  const missing = []
  const found = []

  for (const [name, from] of entries) {
    const stats = await statOrNull(from)

    if (stats === null || !stats.isFile()) {
      missing.push(`${name} ← ${from}`)
      continue
    }

    found.push({ name, from, bytes: stats.size })
  }

  if (missing.length > 0) {
    throw new Error(`복사할 원본 문서를 찾지 못했다:\n  - ${missing.join('\n  - ')}`)
  }

  await mkdir(outDir, { recursive: true })

  const copied = []

  for (const { name, from, bytes } of found) {
    const to = join(outDir, name)

    await copyFile(from, to)
    copied.push({ name, from, to, bytes })
  }

  return copied
}

/**
 * @param {string} path
 * @returns {Promise<import('node:fs').Stats | null>}
 */
async function statOrNull(path) {
  try {
    return await stat(path)
  } catch {
    return null
  }
}
