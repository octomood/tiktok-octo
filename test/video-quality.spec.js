'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Аппаратное декодирование на Linux.
 *
 * Настоящий HEVC в Xvfb не проверить: там нет GPU и VA-API. Зато можно
 * убедиться, что настройка читается до app.whenReady(), управляет флагами
 * Chromium и переживает перезапуск.
 */

async function launch(userData) {
  const app = await electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
      // Переменная окружения сильнее настройки, для теста её убираем.
      OCTO_HW_VIDEO: '',
    },
  });
  await app.firstWindow();
  return app;
}

function writeState(userData, hardwareVideo) {
  fs.writeFileSync(
    path.join(userData, 'octo-state.json'),
    JSON.stringify({ hardwareVideo }, null, 2),
  );
}

test('аппаратное декодирование: состояние до запуска и флаги', async () => {
  test.skip(process.platform !== 'linux', 'настройка есть только на Linux');

  const onDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-hw-on-'));
  const offDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-hw-off-'));
  let app;

  try {
    writeState(onDir, true);
    app = await launch(onDir);
    const enabled = await app.evaluate(({ app: electronApp }) => ({
      disabled: electronApp.commandLine.hasSwitch('disable-accelerated-video-decode'),
      features: electronApp.commandLine.getSwitchValue('enable-features'),
    }));
    expect(enabled.disabled).toBe(false);
    expect(enabled.features).toContain('VaapiOnNvidiaGPUs');
    await app.close();
    app = null;

    writeState(offDir, false);
    app = await launch(offDir);
    const disabled = await app.evaluate(({ app: electronApp }) => ({
      disabled: electronApp.commandLine.hasSwitch('disable-accelerated-video-decode'),
    }));
    expect(disabled.disabled).toBe(true);
  } finally {
    if (app) await app.close();
    fs.rmSync(onDir, { recursive: true, force: true });
    fs.rmSync(offDir, { recursive: true, force: true });
  }
});
