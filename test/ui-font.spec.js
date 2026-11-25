'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

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

test('шрифт интерфейса: по умолчанию Google Sans Medium, пресеты, свой шрифт и файл', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-font-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    // По умолчанию используется Google Sans Medium.
    const initialFont = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ui-font'),
    );
    expect(initialFont).toContain('Google Sans Medium');

    // Открываем настройки и переключаемся на Inter.
    await page.click('#btnPanel');
    await expect(page.locator('#panel')).toBeVisible();
    await page.click('[data-cat-head="app"]');
    await expect(page.locator('#uiFontSelect')).toHaveValue('google-sans-medium');

    await page.selectOption('#uiFontSelect', 'inter');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--ui-font'),
        ),
      )
      .not.toContain('Google Sans Medium');
    await expect.poll(() => readState(userData).uiFont?.preset).toBe('inter');

    // Выбор собственного системного шрифта по названию.
    await page.selectOption('#uiFontSelect', 'custom-name');
    await expect(page.locator('#uiFontCustomNameRow')).toBeVisible();
    await page.fill('#uiFontNameInput', 'JetBrains Mono');
    await page.click('#uiFontNameApply');

    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--ui-font'),
        ),
      )
      .toContain('JetBrains Mono');
    await expect
      .poll(() => readState(userData).uiFont)
      .toMatchObject({
        preset: 'custom-name',
        family: 'JetBrains Mono',
      });

    // Загрузка файла шрифта (используем встроенный inter-latin.woff2 как тестовый файл).
    const sampleFont = path.join(__dirname, '../src/renderer/assets/fonts/inter-latin.woff2');
    await page.evaluate((filePath) => window.octo.cmd('uiFontPick', filePath), sampleFont);
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--ui-font'),
        ),
      )
      .toContain('OctoCustomFont');
    await expect
      .poll(() => readState(userData).uiFont)
      .toMatchObject({
        preset: 'custom-file',
        fileName: 'inter-latin.woff2',
      });
    expect(fs.existsSync(path.join(userData, 'fonts', 'ui-custom.woff2'))).toBe(true);
  } finally {
    await app?.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
