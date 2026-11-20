'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Клавиатурная лента и редактор горячих клавиш.
 *
 * Лента проверяется на поддельном видео в about:blank: J/L перематывают,
 * K и пробел ставят паузу, цифры прыгают по проценту, «?» открывает раздел
 * «Клавиши». Ввод в поле не перехватывается. Редактор — реальными нажатиями
 * в полосе заголовка и синтетическим событием, чтобы конфликт не запускал
 * назначенную команду.
 */

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

async function launch(userData) {
  const app = await electron.launch({
    args: [path.join(__dirname, '..'), '--no-sandbox'],
    env: {
      ...process.env,
      OCTO_E2E: '1',
      OCTO_USER_DATA: userData,
      OCTO_HOME_URL: 'about:blank',
    },
  });
  await app.firstWindow();
  const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
  const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');
  return { app, page, site };
}

test('клавиатурная лента: перемотка, пауза, процент и подсказка', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-keys-'));
  let app;

  try {
    ({ app } = await launch(userData));
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    await site.evaluate(() => {
      const video = document.createElement('video');
      const fake = { time: 30, paused: false, volume: 1 };
      Object.defineProperty(video, 'duration', { configurable: true, get: () => 100 });
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => fake.time,
        set: (value) => {
          fake.time = value;
        },
      });
      Object.defineProperty(video, 'paused', { configurable: true, get: () => fake.paused });
      video.play = () => {
        fake.paused = false;
        return Promise.resolve();
      };
      video.pause = () => {
        fake.paused = true;
      };
      video.getBoundingClientRect = () => ({
        width: 320,
        height: 568,
        top: 0,
        left: 0,
        right: 320,
        bottom: 568,
      });
      document.body.append(video);
      window.__fakeVideo = fake;
    });

    await site.keyboard.press('l');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.time)).toBe(40);

    await site.keyboard.press('j');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.time)).toBe(30);

    await site.keyboard.press('5');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.time)).toBe(50);

    await site.keyboard.press('k');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.paused)).toBe(true);

    await site.keyboard.press(' ');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.paused)).toBe(false);

    // В поле ввода буквы остаются текстом, а не командами.
    await site.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'comment-field';
      document.body.append(input);
      input.focus();
    });
    await site.keyboard.type('l');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.time)).toBe(50);
    await expect
      .poll(() => site.evaluate(() => document.getElementById('comment-field').value))
      .toBe('l');

    // Подсказка по «?» открывает раздел «Клавиши».
    await site.evaluate(() => document.activeElement.blur());
    await site.keyboard.press('Shift+/');
    await expect(page.locator('#panel')).toBeVisible();
    await expect(page.locator('#catKeys')).toBeVisible();

    // На русской раскладке J/K/L приходят кириллицей: лента смотрит на code.
    const cdp = await site.context().newCDPSession(site);
    await site.evaluate(() => window.__fakeVideo && (window.__fakeVideo.time = 50));
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'д',
      code: 'KeyL',
      windowsVirtualKeyCode: 76,
      nativeVirtualKeyCode: 76,
    });
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.time)).toBe(60);

    // Выключенная лента не трогает ролик.
    await page.locator('#rowFeedKeys').click();
    await expect(page.locator('#rowFeedKeys')).toHaveAttribute('aria-checked', 'false');
    const before = await site.evaluate(() => window.__fakeVideo.time);
    await site.keyboard.press('l');
    await expect.poll(() => site.evaluate(() => window.__fakeVideo.time)).toBe(before);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('глобальное сочетание срабатывает на нелатинской раскладке', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-layout-'));
  let app;

  try {
    ({ app } = await launch(userData));
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const cdp = await page.context().newCDPSession(page);

    await expect(page.locator('#panel')).toBeHidden();
    // Ctrl+Shift+И: физическая B, но key пришёл с русской раскладки.
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'И',
      code: 'KeyB',
      modifiers: 2 | 8,
      windowsVirtualKeyCode: 66,
      nativeVirtualKeyCode: 66,
    });
    await expect(page.locator('#panel')).toBeVisible();
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('редактор горячих клавиш: переназначение, конфликт и профиль', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-keymap-'));
  let app;

  try {
    ({ app } = await launch(userData));
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));

    await page.locator('#btnPanel').click();
    await page.locator('[data-cat-head="keys"]').click();

    const backRow = page.locator('[data-keymap="back"]');
    const forwardRow = page.locator('[data-keymap="forward"]');
    const pipRow = page.locator('[data-keymap="pip"]');

    await expect(pipRow.locator('.keymap-key')).toHaveText('Ctrl+Shift+P');

    // Esc отменяет захват, но не закрывает панель.
    await backRow.click();
    await expect(backRow).toHaveClass(/is-capturing/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel')).toBeVisible();
    await expect(backRow).not.toHaveClass(/is-capturing/);
    await expect(backRow.locator('.keymap-key')).toHaveText('Alt+Left');

    // Нажатие настоящей клавиши: сочетание сразу применяется.
    await backRow.click();
    await expect(page.locator('[data-keymap="back"]')).toHaveClass(/is-capturing/);
    await page.keyboard.press('Control+Alt+F');
    await expect(backRow.locator('.keymap-key')).toHaveText('Ctrl+Alt+F');

    // Второе нажатие того же сочетания делает синтетическое событие: реальное
    // запустило бы уже назначенную команду.
    await forwardRow.click();
    await page.evaluate(() => {
      window.dispatchEvent(
        new window.KeyboardEvent('keydown', {
          key: 'F',
          ctrlKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(forwardRow.locator('.keymap-key')).toHaveText('Ctrl+Alt+F');
    await expect(page.locator('.keymap-row.is-conflict')).toHaveCount(2);

    // На русской раскладке буква приходит кириллицей: сочетание собирается
    // по физической клавише, иначе переназначить его было бы нельзя.
    await forwardRow.click();
    await page.evaluate(() => {
      window.dispatchEvent(
        new window.KeyboardEvent('keydown', {
          key: 'Ф',
          code: 'KeyA',
          ctrlKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(forwardRow.locator('.keymap-key')).toHaveText('Ctrl+Alt+A');

    // Сброс возвращает стандартный набор.
    await page.locator('[data-cmd="keymapReset"]').click();
    await expect(page.locator('.keymap-row.is-conflict')).toHaveCount(0);
    await expect(backRow.locator('.keymap-key')).toHaveText('Alt+Left');
    await expect(pipRow.locator('.keymap-key')).toHaveText('Ctrl+Shift+P');

    // Компактный профиль уводит внутренние сочетания на Ctrl+Alt.
    await page.locator('#keymapProfile').selectOption('compact');
    await expect(pipRow.locator('.keymap-key')).toHaveText('Ctrl+Alt+P');

    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.keymap.profile).toBe('compact');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
