import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DOC_SOURCES, DOCS_OUT_DIR, syncDocs } from '../../scripts/sync-docs-lib.mjs'

/* 화면 설명서는 `docs/admin/` 한 곳에만 둔다. 빌드 때 `public/docs/` 로 떠 오는
   복사 규칙만 임시 디렉터리에서 검증한다 — 실제 저장소 파일은 건드리지 않는다. */

const workspaces: string[] = []

async function makeWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'maple-sync-docs-'))

  workspaces.push(dir)

  return dir
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('DOC_SOURCES', () => {
  it('should expose the screens guide under a login-free file name', () => {
    expect(DOC_SOURCES['screens.html']).toBe('../../docs/admin/SCREENS-GUIDE.html')
    expect(DOC_SOURCES['inquiry-thread.html']).toBe(
      '../../docs/reference/inquiry-thread-designer-guide.html',
    )
  })

  it('should stay a frozen allowlist so callers cannot widen what is published', () => {
    expect(Object.isFrozen(DOC_SOURCES)).toBe(true)
  })

  it('should target the public folder that next serves as static files', () => {
    expect(DOCS_OUT_DIR).toBe('public/docs')
  })
})

describe('syncDocs', () => {
  it('should copy every allowlisted document into the output directory', async () => {
    // Arrange
    const workspace = await makeWorkspace()
    const source = join(workspace, 'SCREENS-GUIDE.html')
    const outDir = join(workspace, 'public', 'docs')

    await writeFile(source, '<section class="doc">화면</section>', 'utf8')

    // Act
    const copied = await syncDocs({ sources: { 'screens.html': source }, outDir })

    // Assert
    expect(copied).toHaveLength(1)
    expect(copied[0]?.to).toBe(join(outDir, 'screens.html'))
    await expect(readFile(join(outDir, 'screens.html'), 'utf8')).resolves.toBe(
      '<section class="doc">화면</section>',
    )
  })

  it('should create the output directory when it does not exist yet', async () => {
    // Arrange
    const workspace = await makeWorkspace()
    const source = join(workspace, 'guide.html')
    const outDir = join(workspace, 'nested', 'public', 'docs')

    await writeFile(source, 'x', 'utf8')

    // Act
    await syncDocs({ sources: { 'screens.html': source }, outDir })

    // Assert
    await expect(readFile(join(outDir, 'screens.html'), 'utf8')).resolves.toBe('x')
  })

  it('should overwrite a stale copy left by an earlier build', async () => {
    // Arrange
    const workspace = await makeWorkspace()
    const source = join(workspace, 'guide.html')
    const outDir = join(workspace, 'public', 'docs')

    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'screens.html'), '옛날 문서', 'utf8')
    await writeFile(source, '새 문서', 'utf8')

    // Act
    await syncDocs({ sources: { 'screens.html': source }, outDir })

    // Assert
    await expect(readFile(join(outDir, 'screens.html'), 'utf8')).resolves.toBe('새 문서')
  })

  it('should throw naming every missing source when a document is gone', async () => {
    // Arrange
    const workspace = await makeWorkspace()
    const present = join(workspace, 'present.html')
    const missing = join(workspace, 'missing.html')

    await writeFile(present, 'x', 'utf8')

    // Act
    const attempt = syncDocs({
      sources: { 'screens.html': present, 'gone.html': missing },
      outDir: join(workspace, 'public', 'docs'),
    })

    // Assert
    await expect(attempt).rejects.toThrow(/gone\.html/)
  })

  it('should copy nothing when any source is missing', async () => {
    // Arrange
    const workspace = await makeWorkspace()
    const present = join(workspace, 'present.html')
    const outDir = join(workspace, 'public', 'docs')

    await writeFile(present, 'x', 'utf8')

    // Act
    await syncDocs({
      sources: { 'screens.html': present, 'gone.html': join(workspace, 'missing.html') },
      outDir,
    }).catch(() => undefined)

    // Assert
    await expect(readFile(join(outDir, 'screens.html'), 'utf8')).rejects.toThrow()
  })

  it('should reject a directory standing in for a document', async () => {
    // Arrange
    const workspace = await makeWorkspace()
    const source = join(workspace, 'a-directory.html')

    await mkdir(source)

    // Act
    const attempt = syncDocs({
      sources: { 'screens.html': source },
      outDir: join(workspace, 'public', 'docs'),
    })

    // Assert
    await expect(attempt).rejects.toThrow(/a-directory\.html/)
  })

  it('should return an empty list when the allowlist is empty', async () => {
    // Arrange
    const workspace = await makeWorkspace()

    // Act
    const copied = await syncDocs({ sources: {}, outDir: join(workspace, 'public', 'docs') })

    // Assert
    expect(copied).toEqual([])
  })
})
