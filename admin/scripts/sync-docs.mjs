#!/usr/bin/env node
/**
 * 공개 문서 동기화 — `pnpm build` · `pnpm dev` 앞에 붙어서 돈다.
 *
 * `docs/admin/SCREENS-GUIDE.html`(화면 설명서) 한 벌을 `admin/public/docs/screens.html`
 * 로 떠 온다. 그래야 `/docs/screens` 로 열 수 있다(`next.config.ts` 의 rewrites).
 *
 * 경로는 **스크립트 자신의 위치**를 기준으로 푼다. cwd 기준으로 풀면 저장소 루트에서
 * `pnpm --filter @maple/admin build` 로 돌릴 때와 `admin/` 안에서 돌릴 때가 달라진다.
 *
 * pnpm 은 `prebuild` 같은 npm 라이프사이클 훅을 기본으로 실행하지 않는다. 그래서
 * 훅에 기대지 않고 `build`/`dev` 스크립트 앞에 직접 붙였다.
 */

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DOC_SOURCES, DOCS_OUT_DIR, syncDocs } from './sync-docs-lib.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const adminRoot = join(scriptDir, '..')

const sources = Object.fromEntries(
  Object.entries(DOC_SOURCES).map(([name, relativePath]) => [
    name,
    resolve(scriptDir, relativePath),
  ]),
)

try {
  const copied = await syncDocs({ sources, outDir: join(adminRoot, DOCS_OUT_DIR) })

  for (const { name, bytes } of copied) {
    console.log(`[sync-docs] ${DOCS_OUT_DIR}/${name} (${Math.round(bytes / 1024)} KB)`)
  }
} catch (error) {
  console.error('[sync-docs] 실패 — 문서 동기화를 건너뛰고 빌드를 계속하지 않는다.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
