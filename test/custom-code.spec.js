'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Свой CSS/JS: выключен по умолчанию, включается одной кнопкой, снимает CSS
 * при выключении и возвращается после перезагрузки страницы. Предупреждение
 * в тестах пропускается через OCTO_E2E.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('свой CSS и JS: включение, снятие и повтор после перезагрузки', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-custom-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    const css = 'body { background-color: rgb(1, 2, 3) !important; }';
    const js = 'document.documentElement.setAttribute("data-custom-code", "1");';
    const background = () => site.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.evaluate(
      ({ styles, script }) => window.octo.cmd('customCodeSet', { css: styles, js: script }),
      { styles: css, script: js },
    );

    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.customCode.css).toBe(css);
    expect(saved.customCode.js).toBe(js);
    expect(saved.customCode.enabled).toBe(false);
    expect(await background()).not.toBe('rgb(1, 2, 3)');

    await page.evaluate(() => window.octo.cmd('customCodeToggle'));
    await expect(page.locator('#rowCustom')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(background).toBe('rgb(1, 2, 3)');
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-custom-code')))
      .toBe('1');

    // Перезагрузка страницы возвращает CSS и JS, пока режим включён.
    await site.reload();
    await expect.poll(background, { timeout: 8000 }).toBe('rgb(1, 2, 3)');
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-custom-code')))
      .toBe('1');

    // Выключение снимает CSS и сохраняет состояние.
    await page.evaluate(() => window.octo.cmd('customCodeToggle'));
    await expect(page.locator('#rowCustom')).toHaveAttribute('aria-checked', 'false');
    await expect.poll(background).not.toBe('rgb(1, 2, 3)');
    const after = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(after.customCode.enabled).toBe(false);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
