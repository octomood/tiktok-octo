'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Снимок с аннотацией: окно открывается с картинкой, рисуем стрелку,
 * сохраняем — в папке появляется PNG. Проверяем реальный canvas и настоящий
 * mouse-drag, а не только разметку.
 */

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

test('снимок с аннотацией: окно, стрелка и сохранение PNG', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-annotate-'));
  const pictures = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-annotate-out-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_SCREENSHOT_DIR: pictures,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(app, (candidate) => candidate.url().endsWith('/index.html'));
    await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    await page.evaluate(() => window.octo.cmd('screenshotAnnotate'));
    let editor = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/annotator.html'),
      'окно аннотаций',
    );

    // Второй снимок при открытом редакторе: старое окно закрывается, новое
    // должно работать. Раньше closed старого обнулял ссылку на новое окно.
    const nextEditor = app.waitForEvent('window');
    await page.evaluate(() => window.octo.cmd('screenshotAnnotate'));
    editor = await nextEditor;

    const canvas = editor.locator('#annotateCanvas');
    await expect(canvas).toBeVisible();
    await expect
      .poll(() => editor.evaluate(() => document.getElementById('annotateCanvas').width))
      .toBeGreaterThan(0);

    // Рисуем стрелку настоящим перетаскиванием.
    const box = await canvas.boundingBox();
    await editor.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await editor.mouse.down();
    await editor.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 6 });
    await editor.mouse.up();

    await editor.click('[data-tool="rect"]');
    await expect(editor.locator('[data-tool="rect"]')).toHaveClass(/is-on/);
    await editor.click('[data-tool="arrow"]');

    await editor.click('#btnSave');

    await expect
      .poll(() => fs.readdirSync(pictures).find((name) => name.endsWith('-annotated.png')) || '')
      .toMatch(/^tiktok-octo-\d{8}-\d{6}-annotated\.png$/);

    await expect
      .poll(() => app.windows().some((candidate) => candidate.url().endsWith('/annotator.html')))
      .toBe(false);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(pictures, { recursive: true, force: true });
  }
});
