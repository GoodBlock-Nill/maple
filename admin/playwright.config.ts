import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

/**
 * 이 머신에는 Playwright 가 내려받은 브라우저가 캐시에만 있고 프로젝트에는 없다.
 * 채널(`channel: 'chromium'`)로 두면 실행 파일을 찾지 못하므로 헤드리스 셸 경로를
 * 직접 지정한다. 환경 변수로 덮어쓸 수 있게 열어 둔다(CI 는 기본 경로를 쓴다).
 */
const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  path.join(
    process.env.HOME ?? '',
    'Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  )

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.ADMIN_E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: chromiumPath },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
