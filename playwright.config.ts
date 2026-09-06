import { defineConfig, devices } from '@playwright/test';

/**
 * The suite runs against the *built* site, never the dev server: what is
 * asserted has to be what ships. `npm run verify` builds first, then starts
 * `astro preview` over dist/ through this config.
 *
 * Viewports are not configured here — each test drives them itself
 * (360/768/1280, see tests/pages.ts), because most assertions have to be made
 * at every width rather than once per project.
 */
const PORT = 4321;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    /* Deterministic rendering: no smooth scrolling (the stylesheet enables it
       under `prefers-reduced-motion: no-preference`, which would make the
       lazy-image walk race), and a fixed scale factor so tap targets are
       measured in CSS pixels. */
    contextOptions: { reducedMotion: 'reduce' },
    deviceScaleFactor: 1,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node tests/server.mjs`,
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
