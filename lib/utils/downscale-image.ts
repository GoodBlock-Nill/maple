/**
 * 업로드 전 클라이언트 축소.
 *
 * 요즘 휴대폰 사진은 4000px 이 넘어 5MB 제한에 그대로 걸린다. 여기서 한 번 줄이면
 * 사용자가 "왜 안 올라가지"를 겪지 않고, 본문에서 실제로 보이는 폭(최대 ~800px)에
 * 비하면 화질 손실도 눈에 띄지 않는다.
 *
 * 실패하면 **원본을 그대로 돌려준다**. 축소는 편의 기능이지 검증이 아니다 —
 * 크기·형식의 진짜 판정은 서버(`uploadPostImage` · `createInquiry`)와 버킷 정책이 한다.
 *
 * 커뮤니티 본문 이미지와 1:1 문의 첨부가 같이 쓰므로 `lib/utils` 에 둔다. 규칙이
 * 갈리면 한쪽에서만 통과하는 사진이 생긴다.
 */

const MAX_DIMENSION = 2000

/** GIF 는 캔버스를 거치면 첫 프레임만 남아 애니메이션이 사라진다. */
const SKIP_TYPES: ReadonlySet<string> = new Set(['image/gif'])

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, 0.9)
  })
}

export async function downscaleImage(file: File): Promise<File> {
  if (SKIP_TYPES.has(file.type) || typeof createImageBitmap !== 'function') {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)

    if (scale >= 1) {
      bitmap.close()

      return file
    }

    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (context === null) {
      bitmap.close()

      return file
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await toBlob(canvas, file.type)

    /* 축소했는데 오히려 커지는 경우가 있다(PNG 재인코딩). 그럴 땐 원본이 낫다. */
    if (blob === null || blob.type !== file.type || blob.size >= file.size) {
      return file
    }

    return new File([blob], file.name, { type: file.type })
  } catch {
    return file
  }
}
