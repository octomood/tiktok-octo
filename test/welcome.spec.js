'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Мастер первого запуска: язык, прокси и поиск локального клиента.
 *
 * Сеть не нужна: OCTO_E2E отключает настоящую проверку найденных прокси,
 * остаются только TCP-пробы портов localhost. Сайт не грузим — about:blank.
 * Мастер в тестах включается явно (OCTO_WELCOME=1): иначе он перекрывал бы
 * полосу и панель во всех остальных сценариях с пустым профилем.
 */

async function waitForWindow(app, predicate) {
  let page = app.windows().find(predicate);
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    page = app.windows().find(predicate);
  }
  return page;
}

function waitForFileWindow(app) {
  return waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
}

function readState(userData) {
  try {
    return JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
  } catch {
    return {};
  }
}

/** Звук ленты: view — дочерний about:blank внутри главного окна. */
function viewMuted(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) =>
      item.webContents.getURL().startsWith('file://'),
    );
    const view = win.contentView.children.find(
      (child) => child.webContents && child.webContents.getURL() === 'about:blank',
    );
    return Boolean(view && view.webContents && view.webContents.isAudioMuted());
  });
}

function launch(userData) {
  return electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_WELCOME: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
    },
  });
}

test('мастер: язык, поиск прокси и сохранение настройки', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-welcome-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('#welcomeTitle')).toHaveText('Добро пожаловать в TikTok octo');
    await expect(page.locator('#welcomeLanguage')).toHaveValue('ru');
    // Лента под мастером не должна играть втихую.
    await expect.poll(() => viewMuted(app)).toBe(true);

    // Язык меняется сразу и переводит сам мастер.
    await page.selectOption('#welcomeLanguage', 'en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#welcomeTitle')).toHaveText('Welcome to TikTok octo');

    // Тумблер открывает поле адреса и поиск локального клиента.
    await expect(page.locator('#welcomeProxyFields')).toBeHidden();
    await page.click('#welcomeProxyToggle');
    await expect(page.locator('#welcomeProxyToggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#welcomeProxyFields')).toBeVisible();

    await page.click('#welcomeDiscover');
    await expect(page.locator('#welcomeScanState')).toHaveText(/Nothing found|Proxies found/);

    await page.fill('#welcomeProxy', 'socks5://127.0.0.1:9');
    await page.click('#welcomeContinue');
    await expect(page.locator('#welcome')).toBeHidden();
    // Мастер закрыт — звук возвращается.
    await expect.poll(() => viewMuted(app)).toBe(false);

    await expect
      .poll(() => readState(userData))
      .toMatchObject({
        welcomeDone: true,
        language: 'en',
        region: { proxy: 'socks5://127.0.0.1:9' },
      });

    // Мастер открывается повторно из панели и снова показывает сохранённый адрес.
    await page.evaluate(() => window.octo.cmd('welcomeOpen'));
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('#welcomeProxyToggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#welcomeProxy')).toHaveValue('socks5://127.0.0.1:9');

    // Пропустить — тоже закрывает мастер.
    await page.click('#welcomeSkip');
    await expect(page.locator('#welcome')).toBeHidden();

    // Если звук был выключен до мастера, закрытие его не включает обратно.
    await page.evaluate(() => window.octo.cmd('mute'));
    await expect.poll(() => viewMuted(app)).toBe(true);
    await page.evaluate(() => window.octo.cmd('welcomeOpen'));
    await expect(page.locator('#welcome')).toBeVisible();
    await expect.poll(() => viewMuted(app)).toBe(true);
    await page.click('#welcomeSkip');
    await expect(page.locator('#welcome')).toBeHidden();
    await expect.poll(() => viewMuted(app)).toBe(true);
  } finally {
    await app?.close();
  }
});

test('мастер: обход DPI включается без прокси', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-welcome-dpi-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('#welcomeDpiNote')).toBeHidden();

    // Способы взаимоисключающие: прокси и обход DPI не включаются вместе.
    await page.click('#welcomeProxyToggle');
    await page.click('#welcomeDpiToggle');
    await expect(page.locator('#welcomeProxyToggle')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#welcomeDpiToggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#welcomeDpiNote')).toBeVisible();
    await expect(page.locator('#welcomeProxyFields')).toBeHidden();

    await page.click('#welcomeContinue');
    await expect(page.locator('#welcome')).toBeHidden();
    await expect.poll(() => readState(userData).dpiBypass).toBe(true);
    expect(readState(userData).welcomeDone).toBe(true);
    expect((readState(userData).region && readState(userData).region.proxy) || '').toBe('');
  } finally {
    await app?.close();
  }
});

test('мастер: неверный адрес не закрывает экран, пропуск ничего не меняет', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-welcome-skip-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await expect(page.locator('#welcome')).toBeVisible();
    await page.click('#welcomeProxyToggle');
    await page.fill('#welcomeProxy', 'не адрес');
    await page.click('#welcomeContinue');

    // Ошибка формата: мастер остаётся открытым, адрес не сохраняется.
    await expect(page.locator('#welcome')).toBeVisible();
    const failed = readState(userData);
    expect(failed.welcomeDone).not.toBe(true);
    expect((failed.region && failed.region.proxy) || '').toBe('');

    // Правильный адрес принимается и закрывает мастер.
    await page.fill('#welcomeProxy', 'socks5://127.0.0.1:1080');
    await page.click('#welcomeContinue');
    await expect(page.locator('#welcome')).toBeHidden();
    await expect
      .poll(() => readState(userData))
      .toMatchObject({ welcomeDone: true, region: { proxy: 'socks5://127.0.0.1:1080' } });
  } finally {
    await app?.close();
  }
});
