import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * `public/` 아래 정적 자산이 실제로 존재하는지 확인한다.
 *
 * 시안 자산이 순차적으로 들어오는 동안 아직 없는 파일을 `next/image` 로
 * 렌더하면 깨진 이미지 아이콘이 남는다. 서버 컴포넌트에서 이 함수를 거쳐
 * 폴백(실루엣·그라데이션)으로 갈아끼우면, 자산이 도착한 순간 별도 수정 없이
 * 원본 이미지가 살아난다.
 *
 * **서버 전용** — `node:fs` 를 쓰므로 클라이언트 컴포넌트에서 import 하면 안 된다.
 */
/** 존재가 확인된 경로만 담는다. 없는 파일은 매번 다시 확인해 뒤늦게 들어온
 *  자산도 서버 재시작 없이 반영된다. */
const known = new Set<string>()

export function hasPublicAsset(src: string): boolean {
  if (known.has(src)) {
    return true
  }

  // 원격 URL(유튜브 썸네일 등)은 존재 여부를 알 수 없으므로 통과시킨다.
  if (!src.startsWith('/')) {
    return true
  }

  if (!existsSync(path.join(process.cwd(), 'public', src))) {
    return false
  }

  known.add(src)

  return true
}

/** 존재하는 자산만 남긴다. 마스코트·장식처럼 선택적인 목록에 쓴다. */
export function filterExistingAssets<TItem extends { src: string }>(
  items: readonly TItem[],
): readonly TItem[] {
  return items.filter((item) => hasPublicAsset(item.src))
}
