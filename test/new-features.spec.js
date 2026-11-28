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

test('профили аккаунтов, заметки к авторам, плеер и тема', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-new-'));
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForFileWindow(app);
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();
    await page.waitForLoadState('load');
    await expect(page.locator('#btnPanel')).toBeVisible();

    await page.click('#btnPanel');
    await expect(page.locator('#panel')).toBeVisible();

    // 1. Профили аккаунтов: создание, переключение и удаление.
    await page.click('#catAppHead');
    await page.fill('#profileNewName', 'Рабочий');
    await page.click('#btnProfileAdd');

    await expect.poll(() => readState(userData).profiles?.list?.length || 0).toBe(2);
    const createdState = readState(userData);
    expect(createdState.profiles.active).not.toBe('default');
    expect(createdState.profiles.list.some((p) => p.name === 'Рабочий')).toBe(true);

    await page.selectOption('#profileSelect', 'default');
    await expect.poll(() => readState(userData).profiles?.active).toBe('default');

    // 2. Заметки к авторам.
    await page.click('#catLibraryHead');
    await page.fill('#creatorAuthor', '@octo_creator');
    await page.fill('#creatorTags', 'монтаж, свет');
    await page.fill('#creatorNote', 'Хорошие переходы');
    await page.click('#btnCreatorSave');

    await expect(page.locator('#creatorNotesList')).toContainText('@octo_creator');
    await expect(page.locator('#creatorNotesList')).toContainText('#монтаж #свет');
    await expect
      .poll(() => readState(userData).creatorNotes?.['@octo_creator']?.note)
      .toBe('Хорошие переходы');

    // 3. Плеер: закрепление скорости.
    await page.click('#catPlayerHead');
    await expect(page.locator('#rowStickySpeed')).toHaveAttribute('aria-checked', 'true');
    await page.click('#rowStickySpeed');
    await expect(page.locator('#rowStickySpeed')).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => readState(userData).player?.stickySpeed).toBe(false);

    // 4. Тема: системная / светлая / тёмная (синхронизируется и на оболочке приложения).
    await page.click('#catCosmeticsHead');
    await page.selectOption('#themeModeSelect', 'system');
    await expect.poll(() => readState(userData).themeMode).toBe('system');
    await page.selectOption('#themeModeSelect', 'light');
    await expect.poll(() => readState(userData).themeMode).toBe('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.selectOption('#themeModeSelect', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // 4.5. AMOLED-режим: чисто чёрный фон в тёмной теме и сохранение настройки при светлой.
    const amoledRow = page.locator('#rowThemeAmoled');
    await expect(amoledRow).toHaveAttribute('aria-checked', 'false');
    await amoledRow.click();
    await expect(amoledRow).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => readState(userData).themeAmoled).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-amoled', 'true');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--md-surface').trim(),
        ),
      )
      .toBe('#000000');

    await page.selectOption('#themeModeSelect', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-amoled', 'false');
    await page.selectOption('#themeModeSelect', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-amoled', 'true');
    await amoledRow.click();
    await expect(amoledRow).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-amoled', 'false');

    // 5. 20 гармоничных цветовых палитр MD3 Expressive в настройках косметики.
    await expect(page.locator('#themePaletteGrid .theme-swatch')).toHaveCount(20);
    await expect(page.locator('[data-theme-palette="octo-lavender"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.click('[data-theme-palette="emerald-forest"]');
    await expect(page.locator('[data-theme-palette="emerald-forest"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'emerald-forest');
    await expect.poll(() => readState(userData).themePalette).toBe('emerald-forest');
    const primaryHex = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--md-primary').trim(),
    );
    expect(primaryHex).not.toBe('#8c84a9');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
