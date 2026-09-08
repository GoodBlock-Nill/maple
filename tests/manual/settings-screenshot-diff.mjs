/**
 * 전/후 스크린샷 픽셀 비교. 어디가 몇 픽셀 달라졌는지 y 구간으로 알려 준다.
 * (레이아웃이 밀렸는지 vs 글자만 바뀌었는지를 눈이 아니라 숫자로 판정한다.)
 *
 *   node tests/manual/settings-screenshot-diff.mjs [기준접미사] [비교접미사]
 *
 * GIF 캐릭터가 있는 페이지는 프레임이 달라 매 촬영마다 잡티가 남는다. 같은
 * 접미사 둘(예: after after2)로 한 번 돌려 그 잡티 수준을 먼저 재고, 실제
 * 변경을 그 위에서 판정한다.
 */
import { readFileSync } from 'node:fs'

import { chromium } from '@playwright/test'

const PAGES = ['home', 'about', 'privacy']
const [baseSuffix = 'before', headSuffix = 'after'] = process.argv.slice(2)

const browser = await chromium.launch()
const page = await browser.newPage()

for (const name of PAGES) {
  const before = readFileSync(`verify/settings-wired-${name}-${baseSuffix}.png`).toString('base64')
  const after = readFileSync(`verify/settings-wired-${name}-${headSuffix}.png`).toString('base64')

  const result = await page.evaluate(
    async ([a, b]) => {
      const load = (data) =>
        new Promise((resolve) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.src = `data:image/png;base64,${data}`
        })

      const [imageA, imageB] = await Promise.all([load(a), load(b)])
      const width = Math.min(imageA.width, imageB.width)
      const height = Math.min(imageA.height, imageB.height)

      const pixels = (image) => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, width, height).data
      }

      const dataA = pixels(imageA)
      const dataB = pixels(imageB)
      const bands = []
      let differing = 0

      for (let y = 0; y < height; y += 1) {
        let rowDiff = 0
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4
          if (
            Math.abs(dataA[index] - dataB[index]) > 8 ||
            Math.abs(dataA[index + 1] - dataB[index + 1]) > 8 ||
            Math.abs(dataA[index + 2] - dataB[index + 2]) > 8
          ) {
            rowDiff += 1
          }
        }
        if (rowDiff > 0) {
          differing += rowDiff
          const last = bands[bands.length - 1]
          if (last !== undefined && y - last.to <= 2) {
            last.to = y
            last.pixels += rowDiff
          } else {
            bands.push({ from: y, to: y, pixels: rowDiff })
          }
        }
      }

      return {
        size: { width, height },
        sizeMismatch: imageA.width !== imageB.width || imageA.height !== imageB.height,
        dimensions: { before: [imageA.width, imageA.height], after: [imageB.width, imageB.height] },
        differing,
        ratio: differing / (width * height),
        bands: bands.slice(0, 12),
      }
    },
    [before, after],
  )

  console.log(`\n[${name}] ${result.dimensions.before.join('x')} → ${result.dimensions.after.join('x')}`)
  console.log(`  다른 픽셀 ${result.differing} (${(result.ratio * 100).toFixed(4)}%)`)
  for (const band of result.bands) {
    console.log(`  y ${band.from}~${band.to}: ${band.pixels}px`)
  }
}

await browser.close()
