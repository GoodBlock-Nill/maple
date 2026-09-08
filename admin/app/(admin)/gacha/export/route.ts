import { requireAdmin } from '@/lib/auth/require-admin'
import { getGachaItemsForExport } from '@/lib/data/gacha'
import { toCsvFile } from '@/lib/utils/csv'
import { DEFAULT_GACHA_TAB, GACHA_CSV_HEADERS, isGachaTab } from '@/lib/validation/gacha'

import type { NextRequest } from 'next/server'

/**
 * 확률형 아이템 CSV 내보내기 (`/gacha/export?tab=premium`).
 *
 * 서버 액션이 아니라 라우트 핸들러인 이유: 브라우저가 파일로 받아야 한다.
 * 액션의 반환값은 응답 헤더를 갖지 못해 다운로드가 되지 않는다.
 *
 * 페이지와 같은 경계를 다시 세운다 — 라우트 핸들러는 `(admin)` 레이아웃을 거치지
 * 않으므로 여기서 `requireAdmin()` 을 부르지 않으면 인가가 통째로 빠진다.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  await requireAdmin()

  const rawTab = request.nextUrl.searchParams.get('tab') ?? ''
  const tab = isGachaTab(rawTab) ? rawTab : DEFAULT_GACHA_TAB
  const items = await getGachaItemsForExport(tab)

  const rows: string[][] = [
    [...GACHA_CSV_HEADERS],
    ...items.map((item) => [
      item.id,
      item.tab,
      item.name,
      item.iconUrl ?? '',
      /* 소수 셋째 자리까지 고정해서 내보낸다. 1.2 와 1.200 이 섞이면 엑셀에서
         정렬·비교가 어긋나고, 다시 올릴 때 무의미한 변경으로 보인다. */
      item.probability.toFixed(3),
      String(item.isPublished),
      item.publishedAt,
      JSON.stringify(item.rows),
    ]),
  ]

  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(toCsvFile(rows), {
    headers: {
      // BOM 을 붙였으므로 charset 을 명시해야 브라우저가 다시 추측하지 않는다.
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="gacha-${tab}-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
