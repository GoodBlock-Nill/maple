/** CSV 한 줄의 미리보기 상태. 패널과 미리보기 표가 함께 쓴다. */
export type GachaPreviewRow = {
  line: number
  values: Record<string, string>
  /** 검증을 통과했으면 null. 통과하지 못했으면 화면에 그대로 보일 문구. */
  error: string | null
}
