
## Ranking pagination + TOP3 clip fix (2026-09-08)

- `RANKING_PAGE_SIZE` counts TOP3 cards as part of the page total. Page N shows
  entries 1..N*10 (cards + rows), not N*10 table rows on top of TOP3.
  `lib/data/rankings.ts#toRankingPage` now derives `shown = accumulatedCount(page, RANKING_PAGE_SIZE, total)`
  and `rows.length = shown - TOP_RANK_COUNT`. The Supabase range fetch dropped the
  `TOP_RANK_COUNT` offset arg to `accumulatedRange` since cards are already inside
  the page size.
- CSS gotcha: an `<img>`/`next/image` placed directly as a flex item (not wrapped)
  keeps its intrinsic size as an implicit `min-width`/`min-height: auto` on the
  main axis, which silently defeats `max-w-full`/`object-contain` once the flex
  container becomes narrower than the image. Fix is `min-w-0` on the image class.
  This bit both `TopThreeCard`'s character image and (more visibly, per Playwright
  clip audit) `TopThreeLaurel`'s absolutely-positioned decoration — the laurel
  needed `max-w-[calc(100%-<left-offset>px)]` + `aspect-[w/h]` + `h-auto` +
  `object-contain` since it's absolutely positioned with a fixed left offset, not
  a flex child.
- Testing `lib/data/rankings.ts` directly in Vitest fails because it transitively
  imports `lib/supabase/public.ts` which has `import 'server-only'`. Workaround:
  `vi.mock('server-only', () => ({}))` at the top of the test file before
  importing the module under test — no need to touch vitest config.
- Verification tool: `node .../scratchpad/compare/clip.mjs <path> <viewportWidth>`
  walks every `<img>`, checks ancestor `overflow` clipping and viewport edges —
  very effective for catching TOP3 image/laurel clipping across breakpoints.
