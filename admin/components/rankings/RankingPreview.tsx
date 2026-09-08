'use client'

/* eslint-disable @next/next/no-img-element -- 이미지 주소는 Storage 공개 URL 과
   사용자 사이트의 정적 경로가 섞여 next/image 의 원격 패턴 밖이다. 관리자 화면의
   썸네일·미리보기라 최적화도 필요 없다. */
import { siteAssetSrc } from '@/components/settings/site-assets'
import { jobGroupLabel, type RankingUploadRow } from '@/lib/validation/rankings'

/**
 * 사용자 사이트 미리보기.
 *
 * 사용자 사이트의 랭킹은 **TOP3 카드 + 4위부터의 표**로 나뉜다
 * (`components/ranking/TopThree.tsx` · `RankingRow.tsx`). 관리자에서 한 줄짜리
 * 표만 보여 주면 "1~3위가 카드로 어떻게 보이는지"를 올린 뒤에야 알게 된다.
 *
 * 카드가 쓰는 값: 캐릭터 이미지(없으면 실루엣 폴백) · 레벨 · 직업 · 경험치.
 * 표가 쓰는 값: 순위 · 캐릭터 이미지 · 닉네임(마스킹) · 레벨 · 직업 · 길드.
 * 경험치는 카드에만 보이고, 길드는 표에만 보인다.
 */

const TOP_COUNT = 3

/** 사용자 사이트는 닉네임 앞 3자만 남기고 가린다(`lib/utils/mask.ts`). */
function maskNickname(nickname: string): string {
  const trimmed = nickname.trim()

  return trimmed.length === 0 ? '***' : `${trimmed.slice(0, 3)}***`
}

export function RankingPreview({ rows }: { rows: readonly RankingUploadRow[] }) {
  const sorted = [...rows].sort((left, right) => left.rank - right.rank)
  const top = sorted.slice(0, TOP_COUNT)
  const rest = sorted.slice(TOP_COUNT)

  return (
    <section className="flex flex-col gap-3" aria-label="사용자 사이트 미리보기">
      <div className="flex items-baseline gap-2">
        <h3 className="text-ink text-[15px] font-bold">사용자 사이트 미리보기</h3>
        <span className="text-muted text-[12px]">
          TOP3 카드 + 4위부터의 표. 사이트에서는 닉네임이 마스킹됩니다.
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {top.map((row) => (
          <li
            key={row.rank}
            className="border-line rounded-card flex flex-col items-center gap-2 border bg-white p-4"
            data-testid="ranking-preview-top"
          >
            <span className="bg-accent-soft text-accent-strong rounded-pill px-2 py-0.5 text-[12px] font-bold">
              {row.rank}위
            </span>
            <Avatar url={row.avatar_url} size="h-16 w-16" />
            <p className="text-ink text-[14px] font-bold">{row.character_name}</p>
            <dl className="text-muted grid w-full grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px]">
              <dt>레벨</dt>
              <dd className="text-ink text-right">Lv. {row.level}</dd>
              <dt>직업</dt>
              <dd className="text-ink truncate text-right">{row.job}</dd>
              <dt>경험치</dt>
              <dd className="text-ink text-right">{row.exp ?? '-'}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <div className="border-line rounded-panel max-h-[320px] overflow-auto border">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <caption className="sr-only">4위부터의 랭킹 미리보기</caption>
          <thead className="bg-page/70 sticky top-0">
            <tr className="border-line border-b">
              {['순위', '캐릭터 정보', '레벨', '직업', '길드'].map((header) => (
                <th
                  key={header}
                  className="text-muted px-3 py-2 text-left text-[12px] font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rest.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted px-3 py-6 text-center">
                  4위 이후 행이 없습니다.
                </td>
              </tr>
            ) : (
              rest.map((row) => (
                <tr key={row.rank} className="border-line border-b last:border-b-0">
                  <td className="px-3 py-2">{row.rank}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar url={row.avatar_url} size="h-8 w-8" />
                      <span className="text-ink font-semibold">{row.character_name}</span>
                      <span className="text-muted text-[12px]">
                        사이트 표기 {maskNickname(row.character_name)}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2">Lv. {row.level}</td>
                  <td className="px-3 py-2">
                    {row.job}
                    <span className="text-muted ml-1 text-[12px]">
                      ({jobGroupLabel(row.job_group)})
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.guild ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * 캐릭터 이미지.
 *
 * 사용자 사이트는 `public/` 에 실제로 있는 자산만 그리고 없으면 공통 실루엣으로
 * 대체한다. 관리자에서는 존재 여부를 알 수 없으므로 주소가 비었을 때만 폴백을
 * 그리고, 깨진 주소는 브라우저의 대체 텍스트로 드러나게 둔다.
 */
function Avatar({ url, size }: { url: string | null; size: string }) {
  if (url === null || url === '') {
    return <span className={`bg-page rounded-pill block ${size}`} aria-hidden="true" />
  }

  return (
    <img
      src={siteAssetSrc(url)}
      alt=""
      aria-hidden="true"
      className={`rounded-pill object-contain ${size}`}
    />
  )
}
