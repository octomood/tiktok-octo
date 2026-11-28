'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Устойчивость: безопасный режим после двух падений, свой экран «нет сети»,
 * сторож памяти и экономный режим на батарее.
 */

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

async function waitForValue(read, check, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await read();
    if (check(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`не дождались: ${label}`);
}

async function openAppCategory(page) {
  await expect(page.locator('#panelVersion')).toContainText('v');
  const panel = page.locator('#panel');
  if (await panel.evaluate((node) => node.hidden)) {
    await page.locator('#btnPanel').click();
  }
  await expect(panel).not.toHaveAttribute('hidden', '');
  const head = page.locator('[data-cat-head="app"]');
  await expect(head).toBeVisible();
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
}

function launch(userData, extraEnv = {}) {
  return electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
      ...extraEnv,
    },
  });
}

test('безопасный режим включается после двух падений и выключается вручную', async () => {
  test.setTimeout(60_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-safe-'));
  const guardFile = path.join(userData, 'resilience.json');
  fs.writeFileSync(guardFile, JSON.stringify({ running: true, failures: 0, safeMode: false }));

  let app;
  try {
    app = await launch(userData);
    await app.firstWindow();
    let page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    // Одно падение подряд — ещё не безопасный режим.
    await openAppCategory(page);
    await page.waitForTimeout(500);
    await expect(page.locator('#rowSafeMode')).toBeHidden();
    expect(readJson(guardFile).failures).toBe(1);
    expect(readJson(guardFile).safeMode).toBe(false);

    await app.close();
    app = null;

    // Второе падение подряд — включается безопасный режим.
    fs.writeFileSync(guardFile, JSON.stringify({ running: true, failures: 1, safeMode: false }));
    app = await launch(userData);
    await app.firstWindow();
    page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );
    await openAppCategory(page);
    await expect(page.locator('#rowSafeMode')).toBeVisible();
    await expect(page.locator('#safeModeNote')).toBeVisible();
    expect(readJson(guardFile).safeMode).toBe(true);

    // Выход из режима в тесте без перезапуска.
    await page.evaluate(() => window.octo.cmd('safeModeExit', { restart: false }));
    await waitForValue(
      () => readJson(guardFile).safeMode,
      (value) => value === false,
      'безопасный режим выключен',
    );
    await expect(page.locator('#rowSafeMode')).toBeHidden();
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('экран «нет сети» вместо белой страницы', async () => {
  test.setTimeout(60_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-offline-'));
  let app;

  try {
    app = await launch(userData, { OCTO_HOME_URL: 'http://127.0.0.1:51789/' });
    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    await expect(page.locator('#offlineScreen')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#offlineScreen')).toContainText('Нет соединения');
    await expect(page.locator('[data-cmd="retryLoad"]')).toBeVisible();

    // Кнопка повторяет загрузку и не убирает экран до успеха.
    await page.locator('[data-cmd="retryLoad"]').click();
    await expect(page.locator('#offlineScreen')).toBeVisible();
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('экономный режим на батарее и сторож памяти', async () => {
  test.setTimeout(60_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-power-'));
  const memoryLog = path.join(userData, 'memory.log');
  const stateFile = path.join(userData, 'octo-state.json');
  let app;

  try {
    app = await launch(userData, {
      OCTO_POWER_SOURCE: 'battery',
      OCTO_MEMORY_LIMIT_MB: '1',
      OCTO_MEMORY_POLL_MS: '100',
      OCTO_MEMORY_LOG: memoryLog,
    });
    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    await waitForValue(
      () => (fs.existsSync(memoryLog) ? fs.readFileSync(memoryLog, 'utf8') : ''),
      (value) => value.trim().length > 0,
      'сторож памяти перезапустил страницу',
    );

    await openAppCategory(page);
    await expect(page.locator('#rowEco')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#ecoNote')).toContainText('Питание: батарея');
    await expect(page.locator('#ecoNote')).toContainText('экономный режим включён');

    // Отключаем экономию: состояние сохраняется, режим снимается.
    await page.locator('#rowEco').click();
    await waitForValue(
      () => readJson(stateFile).ecoOnBattery,
      (value) => value === false,
      'экономный режим выключен',
    );
    await expect(page.locator('#rowEco')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#ecoNote')).toContainText('Питание: батарея');
    await expect(page.locator('#ecoNote')).not.toContainText('экономный режим включён');

    // Сторож памяти можно выключить переключателем.
    await page.locator('#rowMemoryGuard').click();
    await waitForValue(
      () => readJson(stateFile).memoryGuard,
      (value) => value === false,
      'проверка памяти выключена',
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('сторож памяти не перезагружает страницу во время воспроизведения видео', async () => {
  test.setTimeout(60_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-mem-playing-'));
  const memoryLog = path.join(userData, 'memory.log');
  let app;

  try {
    app = await launch(userData, {
      OCTO_MEMORY_LIMIT_MB: '1',
      OCTO_MEMORY_POLL_MS: '60000',
      OCTO_MEMORY_LOG: memoryLog,
    });
    await app.firstWindow();
    const viewPage = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница просмотра',
    );
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((item) =>
            item.webContents.getURL().endsWith('/index.html'),
          );
          return Boolean(win && win.isVisible());
        }),
      )
      .toBe(true);

    await viewPage.evaluate(() => {
      const video = document.createElement('video');
      window.__mockPaused = false;
      Object.defineProperty(video, 'paused', { get: () => window.__mockPaused });
      Object.defineProperty(video, 'ended', { get: () => false });
      Object.defineProperty(video, 'readyState', { get: () => 4 });
      document.body.appendChild(video);
    });

    await app.evaluate(({ app: electronApp }) =>
      process.mainModule.require(`${electronApp.getAppPath()}/src/main/resilience`).checkMemory(),
    );
    expect(fs.existsSync(memoryLog)).toBe(false);

    await viewPage.evaluate(() => {
      window.__mockPaused = true;
    });

    await app.evaluate(({ app: electronApp }) =>
      process.mainModule.require(`${electronApp.getAppPath()}/src/main/resilience`).checkMemory(),
    );
    expect(fs.readFileSync(memoryLog, 'utf8').trim().length).toBeGreaterThan(0);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('во время загрузки страницы показывается экран с вращающимся логотипом', async () => {
  test.setTimeout(60_000);
  let releaseResponse = null;
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    releaseResponse = () => response.end('<!doctype html><title>Loaded</title><h1>OK</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-loading-'));
  let app;

  try {
    app = await launch(userData, { OCTO_HOME_URL: baseUrl });
    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    await expect(page.locator('#loadingScreen')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#loadingScreen .loading-logo')).toBeVisible();
    await expect(page.locator('#loadingScreen .loading-ring .md3-progress-canvas')).toBeVisible();
    const animName = await page
      .locator('#loadingScreen .loading-logo')
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animName).toBe('loading-logo-spin');

    await expect.poll(() => typeof releaseResponse).toBe('function');
    releaseResponse();

    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 15000 });
  } finally {
    if (releaseResponse) releaseResponse();
    if (app) await app.close();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
