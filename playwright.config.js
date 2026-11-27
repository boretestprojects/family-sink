import { defineConfig } from "@playwright/test";

const baseURL = `http://127.0.0.1:${process.env.FAMILY_SINK_TEST_PORT ?? 4173}`;

export default defineConfig({
  testDir: "tests",
  testMatch: "dashboard.spec.js",
  use: {
    baseURL,
    launchOptions: { executablePath: process.env.FAMILY_SINK_CHROMIUM || undefined },
  },
  webServer: {
    command: "node tests/serve-panel.mjs",
    url: baseURL,
    reuseExistingServer: false,
  },
});
