/**
 * 사이트 설정 연동 전/후 1440 스크린샷 대조용 스크립트.
 *
 * DB 값이 현재 상수와 같은 동안에는 화면이 픽셀 단위로 같아야 한다 —
 * "DB 로 옮겼더니 화면이 달라졌다"를 눈이 아니라 파일로 증명하기 위한 것이다.
 *
 *   node tests/manual/settings-screenshots.mjs before
 *   node tests/manual/settings-screenshots.mjs after
 *
 * 결과: verify/settings-wired-{page}-{suffix}.png
 */
import { mkdirSync } from 'node:fs'

import { chromium } from '@playwright/test'

const suffix = process.argv[2] ?? 'now'
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const PAGES = [
  ['home', '/'],
  ['about', '/about'],
  ['privacy', '/policy/privacy'],
]

mkdirSync('verify', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

for (const [name, path] of PAGES) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' })
  /* 웹폰트 교체와 GIF 첫 프레임이 자리를 잡은 뒤 찍어야 전/후 비교가 성립한다. */
  await page.waitForTimeout(1500)
  await page.screenshot({
    path: `verify/settings-wired-${name}-${suffix}.png`,
    fullPage: true,
    animations: 'disabled',
  })
  console.log(`${name} → verify/settings-wired-${name}-${suffix}.png`)
}

await browser.close()
