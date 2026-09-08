'use client'

/* eslint-disable @next/next/no-img-element -- 이미지 주소는 Storage 공개 URL 과
   사용자 사이트의 정적 경로가 섞여 next/image 의 원격 패턴 밖이다. 관리자 화면의
   썸네일·미리보기라 최적화도 필요 없다. */
import { siteAssetSrc } from '@/components/settings/site-assets'
import { cn } from '@/lib/utils/cn'

import type { GachaDetailRow } from '@/lib/validation/gacha'

/**
 * 사용자 사이트 미리보기.
 *
 * 사용자 사이트의 `components/guide/GachaItemCard.tsx` · `GachaGradeTable.tsx` 가
 * 그리는 결과를 그대로 재현한다. 관리자에서 본 모습과 사이트에 실제로 뜨는 모습이
 * 다르면 운영자는 저장 → 새 탭에서 확인 → 되돌아오기를 반복하게 된다.
 *
 * 재현이므로 원본이 바뀌면 여기도 함께 바꿔야 한다. 그래서 색·열 구성처럼 눈에
 * 보이는 값은 전부 원본과 같은 리터럴로 적어 두고 출처를 주석으로 남긴다.
 */

/** `lib/constants/guide.ts` 의 GACHA_GRADE_CLASS 와 같은 값(시안 실측 hex). */
const GRADE_CLASS: Record<GachaDetailRow['grade'], string> = {
  SS: 'text-[#ac75e6]',
  S: 'text-[#ee473f]',
  A: 'text-[#ee9513]',
  B: 'text-[#3b82f6]',
  C: 'text-[#727272]',
}

/** 사용자 사이트 표의 4열(등급 · 획득 아이템명 · 확률(%) · 비고). */
const TABLE_HEADERS = ['등급', '획득 아이템명', '확률(%)', '비고'] as const

export function GachaPreview({
  name,
  probability,
  iconUrl,
  publishedAt,
  rows,
}: {
  name: string
  /** 폼에 입력된 문자열 그대로. 숫자가 아니면 카드 확률은 비워 둔다. */
  probability: string
  iconUrl: string
  /** `YYYY-MM-DD`. 카드의 갱신일 자리. */
  publishedAt: string
  rows: readonly GachaDetailRow[]
}) {
  const numeric = Number(probability)
  /* 사용자 사이트 카드는 `toFixed(2)` 로 두 자리만 노출한다(lib/data/mappers.ts).
     DB 는 셋째 자리까지 보관하므로 1.234 는 카드에서 1.23% 로 보인다. */
  const cardProbability =
    Number.isFinite(numeric) && probability.trim() !== '' ? numeric.toFixed(2) : '-'
  const cardIcon = iconUrl !== '' ? iconUrl : (rows[0]?.itemIcon ?? '')

  return (
    <section className="flex flex-col gap-3" aria-label="사용자 사이트 미리보기">
      <div className="flex items-baseline gap-2">
        <h2 className="text-ink text-[15px] font-bold">사용자 사이트 미리보기</h2>
        <span className="text-muted text-[12px]">글자월드 /guide 의 카드·상세표와 같은 구성</span>
      </div>

      <article className="border-line rounded-card flex min-h-[150px] w-full max-w-[320px] flex-col gap-5 border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="border-line flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border bg-white p-[5px]">
            {cardIcon === '' ? (
              <span className="bg-page block h-full w-full" aria-hidden="true" />
            ) : (
              <img
                src={siteAssetSrc(cardIcon)}
                alt=""
                aria-hidden="true"
                className="size-full object-contain"
              />
            )}
          </span>
          <span className="text-ink text-[22px] leading-none font-medium">{cardProbability}%</span>
        </div>

        <h3 className="text-ink line-clamp-2 flex-1 text-[19px] leading-[26px] font-medium">
          {name === '' ? '(이름 없음)' : name}
        </h3>

        <p className="text-muted text-[13px] font-medium">갱신일 {publishedAt}</p>
      </article>

      <div className="border-line rounded-panel overflow-x-auto border bg-white">
        <table className="w-full min-w-[560px] table-fixed border-collapse text-center text-[13px]">
          <caption className="sr-only">{name} 등급별 획득 확률 미리보기</caption>
          <thead>
            <tr className="bg-[#f3f3f3]">
              {TABLE_HEADERS.map((header) => (
                <th key={header} scope="col" className="text-ink h-10 px-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="text-muted px-3 py-6">
                  확률표가 비어 있습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="border-line border-t">
                  <td className={cn('h-11 px-3 font-semibold', GRADE_CLASS[row.grade])}>
                    [{row.grade}등급]
                  </td>
                  <td className="px-3">
                    <span className="inline-flex items-center gap-[5px]">
                      {row.itemIcon !== '' && (
                        <img
                          src={siteAssetSrc(row.itemIcon)}
                          alt=""
                          aria-hidden="true"
                          className="size-6 object-contain"
                        />
                      )}
                      {row.itemName === '' ? '(이름 없음)' : row.itemName}
                    </span>
                  </td>
                  <td className="px-3">{row.probability}%</td>
                  <td className="px-3">{row.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
