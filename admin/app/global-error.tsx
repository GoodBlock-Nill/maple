'use client'

/**
 * 루트 레이아웃까지 깨졌을 때의 마지막 화면.
 *
 * 이 파일은 루트 레이아웃을 **대체**하므로 `<html>` · `<body>` 를 직접 그려야 하고,
 * 전역 스타일시트와 폰트도 닿지 않는다(Next 문서). 그래서 Tailwind 클래스 대신
 * 인라인 스타일만 쓴다 — 여기서 클래스에 기대면 아무 서식 없는 흰 화면이 남는다.
 *
 * 여기까지 왔다면 사이드바도 없다. 운영자가 할 수 있는 일은 새로고침과 신고뿐이라
 * 그 두 가지만 남긴다. `metadata` 는 클라이언트 컴포넌트라 쓸 수 없어 `<title>` 로 둔다.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          backgroundColor: '#f5f6f8',
          color: '#1f2430',
          fontFamily: 'system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif',
        }}
      >
        <title>오류 | 글자월드 ADMIN</title>

        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          관리자 콘솔을 불러오지 못했습니다.
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#5b6472' }}>
          잠시 후 다시 시도해 주세요. 계속 실패하면 개발팀에 알려 주세요.
          {error.digest === undefined ? '' : ` (오류 코드 ${error.digest})`}
        </p>

        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: 8,
            height: 40,
            padding: '0 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: '#3d6dfb',
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  )
}
