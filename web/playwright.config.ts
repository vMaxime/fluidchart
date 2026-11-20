import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const PORT = 4179
export const AUTH_STATE = 'e2e/.auth/state.json'

// The e2e suite runs against the real server (built web app + API) with a throwaway database.
// Tests share that database, so they run one at a time and reset it first (see e2e/fixtures.ts).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', storageState: AUTH_STATE },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command:
      'npm run build && (cd ../server && node build.mjs) && node --disable-warning=ExperimentalWarning ../server/dist/server.js',
    url: `http://localhost:${PORT}/api/session`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      APP_PIN: '2468',
      PORT: String(PORT),
      DATA_DIR: join(tmpdir(), `chart-e2e-${Date.now()}`),
      STATIC_DIR: 'dist',
      COOKIE_SECURE: '0',
      E2E_RESET: '1',
      // Fake token for tests that build boards through the API.
      API_TOKEN: 'e2e-fake-token-0123456789abcdef01234567',
    },
  },
})
