import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * 테스트용 mp4 만들기.
 *
 * 저장소에 바이너리를 넣지 않는다 — 영상 첨부는 "브라우저가 진짜 파일을 스토리지로
 * 올린다"를 확인하는 것이라 내용이 무엇이든 상관없고, 커밋된 바이너리는 아무도
 * 다시 열어 보지 않으면서 저장소만 무겁게 한다.
 *
 * ffmpeg 이 없는 환경에서는 `null` 을 돌려 호출한 테스트가 스스로 건너뛰게 한다.
 * 도구가 없다고 전체 스위트가 빨개지면 "무엇이 깨졌는지"가 묻힌다.
 */
export function makeTestVideo(target: string, seconds = 1): string | null {
  try {
    mkdirSync(dirname(target), { recursive: true })
    rmSync(target, { force: true })

    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `testsrc=duration=${seconds}:size=64x64:rate=5`,
        /* yuv420p 가 아니면 브라우저가 재생하지 못한다(디코더가 4:4:4 를 안 받는다). */
        '-pix_fmt',
        'yuv420p',
        target,
      ],
      { stdio: 'pipe' },
    )

    return existsSync(target) ? target : null
  } catch {
    return null
  }
}
