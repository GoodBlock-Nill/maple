# Maple

MSW 게임 대표 홈페이지.

## 요구 도구

- Node 22+
- pnpm 10
- Docker + Supabase CLI

## 시작하기

```bash
pnpm install
cp .env.example .env.local # 값 채워넣기
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## 스크립트

| 스크립트             | 설명                         |
| -------------------- | ---------------------------- |
| `pnpm dev`           | 개발 서버 실행               |
| `pnpm build`         | 프로덕션 빌드                |
| `pnpm start`         | 프로덕션 서버 실행           |
| `pnpm lint`          | ESLint 검사                  |
| `pnpm format`        | Prettier로 코드 포맷팅       |
| `pnpm format:check`  | Prettier 포맷 검사           |
| `pnpm typecheck`     | TypeScript 타입 검사         |
| `pnpm test`          | 단위 테스트 실행 (Vitest)    |
| `pnpm test:watch`    | 단위 테스트 watch 모드       |
| `pnpm test:coverage` | 단위 테스트 커버리지 리포트  |
| `pnpm test:e2e`      | E2E 테스트 실행 (Playwright) |

## 디렉토리 개요

TBD
