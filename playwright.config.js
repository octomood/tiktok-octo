'use strict';

const { defineConfig } = require('@playwright/test');

// Chromium выбирает Wayland по `WAYLAND_DISPLAY` и `XDG_SESSION_TYPE` даже под
// Xvfb — тогда окна тестов появляются на рабочем столе. Тесты запускаются
// только на виртуальном X11, поэтому принудительно оставляем X11.
if (process.env.OCTO_TEST_XVFB) {
  delete process.env.WAYLAND_DISPLAY;
  process.env.XDG_SESSION_TYPE = 'x11';
  process.env.ELECTRON_OZONE_PLATFORM_HINT = 'x11';
}

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
