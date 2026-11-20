'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Адрес прокси с логином и паролем.
 *
 * Пароли часто содержат «%» как есть, а не только в виде `%25`:
 * `decodeURIComponent` на такой строке бросает URIError. Раньше это
 * всплывало из IPC-обработчика и роняло main-процесс, поэтому проверяем,
 * что приложение остаётся живым, адрес сохраняется, а прокси применяется.
 *
 * Вторая часть — хранение пароля: при доступном keyring в состоянии лежит
 * адрес без пароля и секрет, иначе прежний полный адрес (файл закрыт 0600).
 * После перезапуска панель в обоих случаях показывает полный адрес.
 */

async function waitForFileWindow(app) {
  let page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
  }
  return page;
}

function readState(userData) {
  try {
    return JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
  } catch {
    return {};
  }
}

function launch(userData) {
  return electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
    },
  });
}

/** Повторит решение region.js: basic_text на Linux защитой не считаем. */
function hasSecureStorage(app) {
  return app.evaluate(({ safeStorage }) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return false;
      if (
        process.platform === 'linux' &&
        safeStorage.getSelectedStorageBackend() === 'basic_text'
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });
}

function resolvedProxy(app) {
  return app.evaluate(({ session }) =>
    session.fromPartition('persist:octo-tiktok').resolveProxy('https://www.tiktok.com/'),
  );
}

test('прокси с «%» в пароле не роняет приложение и применяется', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-proxy-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();
    const secure = await hasSecureStorage(app);

    // Незакодированный процент в пароле: раньше здесь был URIError.
    const raw = 'socks5://user:100%@127.0.0.1:1080';
    await page.evaluate((address) => window.octo.cmd('regionProxyApply', address), raw);
    await expect
      .poll(() => readState(userData).region?.proxy || '')
      .toMatch(/^socks5:\/\/(user:100%@)?127\.0\.0\.1:1080$/);

    const stored = readState(userData).region || {};
    if (secure) {
      expect(stored.proxy).toBe('socks5://127.0.0.1:1080');
      expect(typeof stored.proxySecret).toBe('string');
      expect(stored.proxySecret.length).toBeGreaterThan(0);
      expect(JSON.stringify(stored)).not.toContain('100%');
    } else {
      expect(stored.proxy).toBe(raw);
      expect(stored.proxySecret).toBeUndefined();
    }

    // Main-процесс жив: следующая команда выполняется, окно на месте.
    await page.click('#btnPanel');
    await expect(page.locator('#regionProxy')).toHaveValue(raw);

    // Корректное процентное кодирование по-прежнему раскодируется, а в
    // правила прокси логин и пароль не попадают.
    const encoded = 'http://user:p%40ss@127.0.0.1:8080';
    await page.evaluate((address) => window.octo.cmd('regionProxyApply', address), encoded);
    await expect
      .poll(() => readState(userData).region?.proxy || '')
      .toMatch(/^http:\/\/(user:p%40ss@)?127\.0\.0\.1:8080$/);
    await expect.poll(() => resolvedProxy(app)).toBe('PROXY 127.0.0.1:8080');

    // После перезапуска секрет расшифровывается и панель показывает полный адрес.
    await app.close();
    app = await launch(userData);
    await app.firstWindow();
    const restarted = await waitForFileWindow(app);
    await expect(restarted.locator('#regionProxy')).toHaveValue(encoded);
    await expect.poll(() => resolvedProxy(app)).toBe('PROXY 127.0.0.1:8080');

    // Сброс адреса убирает и секрет, и прокси из сессии.
    await restarted.evaluate(() => window.octo.cmd('regionProxyClear'));
    await expect.poll(() => readState(userData).region?.proxy || '').toBe('');
    expect(readState(userData).region?.proxySecret).toBeUndefined();
    await expect.poll(() => resolvedProxy(app)).toBe('DIRECT');
  } finally {
    await app?.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
