const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const backendURL = process.env.PLAYWRIGHT_BACKEND_URL || 'http://localhost:5000';
const testDatabaseURL = process.env.TEST_DATABASE_URL ||
  'postgresql://todo_user_test:todo_test_password@localhost:5432/todo_app_test';
const jwtSecret = process.env.JWT_SECRET || process.env.PLAYWRIGHT_JWT_SECRET || 'playwright-e2e-secret';
const secretKey = process.env.SECRET_KEY || jwtSecret;

function portFromUrl(urlString) {
  const parsed = new URL(urlString);
  if (parsed.port) {
    return parsed.port;
  }
  if (parsed.protocol === 'https:') {
    return '443';
  }
  return '80';
}

const backendEnv = Object.assign({}, {
  FLASK_ENV: 'testing',
  TEST_DATABASE_URL: testDatabaseURL,
  DATABASE_URL: testDatabaseURL,
  JWT_SECRET: jwtSecret,
  SECRET_KEY: secretKey,
  CORS_ORIGINS: [baseURL, 'http://localhost:3000', 'http://127.0.0.1:3000']
    .filter(Boolean)
    .join(','),
});

const frontendEnv = Object.assign({}, {
  BROWSER: 'none',
  PORT: portFromUrl(baseURL),
  REACT_APP_API_URL: backendURL,
  WDS_SOCKET_PORT: portFromUrl(baseURL),
});

module.exports = defineConfig({
  testDir: path.join(__dirname, 'src/tests/e2e'),
  timeout: 120 * 1000,
  expect: {
    timeout: 5000,
  },
  reporter: [['html'], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10 * 1000,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: Object.assign({}, devices['Desktop Chrome']) },
    { name: 'firefox', use: Object.assign({}, devices['Desktop Firefox']) },
    { name: 'webkit', use: Object.assign({}, devices['Desktop Safari']) }
  ],
  webServer: [
    {
      command: 'bash -lc "cd ../backend && source venv/bin/activate && python run.py > /dev/null 2>&1"',
      url: (backendURL.endsWith('/') ? backendURL.slice(0, -1) : backendURL) + '/health',
      reuseExistingServer: true,
      timeout: 120 * 1000,
      env: backendEnv,
    },
    {
      command: 'npm start',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120 * 1000,
      env: frontendEnv,
    },
  ],
});
