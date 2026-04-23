// Playwright configuration for DocMind browser integration tests.
/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: ".",
  testMatch: ["tests/test_widget_integration.js"],
  fullyParallel: false,
  retries: 0,
  timeout: 180000,
  use: {
    headless: true,
  },
};
