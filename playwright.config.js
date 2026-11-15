'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
