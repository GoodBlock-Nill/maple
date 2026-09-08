
## Guide sort options (확률형 아이템 정보)
- `GachaSort` = 'latest' | 'prob_desc' | 'prob_asc'. Legacy 'probability'/'name' removed; `parseOption()` in lib/utils/list-query.ts already falls back to `DEFAULT_GACHA_SORT` generically for unknown values — no extra parsing code needed.
- Multi-column Supabase order chain pattern: `SORT_RULE[sort]` is now `readonly {column, ascending}[]`, looped with `.order()` calls, then a final `.order('id', {ascending:true})` tiebreak. Exported `SORT_RULE` from lib/data/gacha.ts for direct unit testing (avoids mocking the Supabase query builder).
- `probability` column in `gacha_items` is numeric (not string) in DB, so `.order('probability', ...)` sorts numerically — confirmed via seed.sql values.
- To preserve `?item=` (detail modal) across a sort change in app/(public)/guide/page.tsx, add `[GACHA_ITEM_PARAM]: itemId` to the SortMenu's `hrefFor` buildHref call (itemId is `string | undefined`, buildHref already treats undefined as "omit").
