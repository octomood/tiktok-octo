'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Дымовой тест: приложение поднимается, полоса заголовка отвечает на команды,
 * панель поиска открывается и меняет высоту «хрома».
 *
 * Сайт не грузим: OCTO_HOME_URL=about:blank и отдельный профиль в temp,
 * чтобы не трогать реальную сессию и не зависеть от сети.
 *
 * Шорткаты проверяем через мост (window.octo.cmd): синтетические клавиши
 * Playwright не проходят через before-input-event, которым обрабатываются
 * реальные нажатия. Сам поиск и состояние при этом проходят весь путь
 * renderer → main → findInPage → renderer.
 */
test('окно, команды и поиск по странице', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-'));
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

    // Первым окном Playwright может отдать about:blank внутри WebContentsView.
    let page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
    for (let attempt = 0; attempt < 50 && !page; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      page = app.windows().find((candidate) => candidate.url().startsWith('file://'));
    }
    expect(page, 'окно с полосой заголовка не появилось').toBeTruthy();

    await expect(page.locator('#titlebar')).toBeVisible();
    await expect(page.locator('#btnHome')).toBeVisible();
    await expect(page.locator('#findbar')).toBeHidden();

    const baseHeight = await page.evaluate(
      () => document.getElementById('chrome').getBoundingClientRect().height,
    );
    expect(baseHeight).toBeGreaterThan(0);

    // Звук: команда проходит main → renderer и меняет состояние интерфейса.
    await page.click('#btnMute');
    await expect(page.locator('body')).toHaveClass(/is-muted/);
    await page.click('#btnMute');
    await expect(page.locator('body')).not.toHaveClass(/is-muted/);

    // Поиск: открытие меняет высоту «хрома», main сдвигает WebContentsView.
    await page.evaluate(() => window.octo.cmd('find'));
    await expect(page.locator('#findbar')).toBeVisible();

    const findHeight = await page.evaluate(
      () => document.getElementById('chrome').getBoundingClientRect().height,
    );
    expect(findHeight).toBeGreaterThan(baseHeight);

    await page.locator('#findInput').fill('tiktok');
    await expect(page.locator('#findCount')).toHaveText('Нет совпадений');

    await page.evaluate(() => window.octo.find('close'));
    await expect(page.locator('#findbar')).toBeHidden();
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
