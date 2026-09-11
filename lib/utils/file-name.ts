/** 확장자 앞부분(basename)을 이만큼까지만 보여 준다(시안 v2 파일 칩). */
export const FILE_BASE_VISIBLE_LENGTH = 6

const ELLIPSIS = '…'

type SplitName = { base: string; extension: string }

/** 마지막 점만 확장자 경계로 본다. 점으로 시작하는 이름(`.env`)은 확장자가 없다. */
function splitFileName(name: string): SplitName {
  const lastDot = name.lastIndexOf('.')

  if (lastDot <= 0 || lastDot === name.length - 1) {
    return { base: name, extension: '' }
  }

  return { base: name.slice(0, lastDot), extension: name.slice(lastDot) }
}

/**
 * 칩에 그릴 파일 이름 — `파일명이름표.png` → `파일명이름….png`.
 *
 * **확장자는 남기고 앞부분만** 줄인다. CSS 말줄임(`truncate`)은 오른쪽 끝을
 * 잘라서 확장자가 먼저 사라지는데, 사용자가 칩에서 확인하는 것은 "무슨 파일인가"
 * (= 확장자)이기 때문이다. 전체 이름은 호출부가 `title` 로 함께 남긴다.
 */
export function truncateFileBase(name: string, visible = FILE_BASE_VISIBLE_LENGTH): string {
  const { base, extension } = splitFileName(name)

  if ([...base].length <= visible) {
    return name
  }

  return `${[...base].slice(0, visible).join('')}${ELLIPSIS}${extension}`
}
