'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Настройки и доступность: поиск по всем разделам, масштаб интерфейса,
 * фокус-кольца, prefers-reduced-motion, ARIA и RTL.
 */

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

async function openPanel(page) {
  // URL окна появляется раньше, чем titlebar успевает получить первое
  // состояние и повесить обработчики. Ждём отрисованную версию в панели.
  await expect(page.locator('#panelVersion')).toContainText('v');
  const panel = page.locator('#panel');
  if (await panel.evaluate((node) => node.hidden)) {
    await page.locator('#btnPanel').click();
  }
  await expect(panel).not.toHaveAttribute('hidden', '');
}

async function openAppCategory(page) {
  await openPanel(page);
  const head = page.locator('[data-cat-head="app"]');
  await expect(head).toBeVisible();
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
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

test('интерфейс: поиск настроек, масштаб, фокус, reduced motion и RTL', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-a11y-'));
  const stateFile = path.join(userData, 'octo-state.json');
  let app;

  try {
    app = await launch(userData);
    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );

    // --- Поиск по настройкам ------------------------------------------------
    await openPanel(page);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const ind = document.getElementById('settingsNavIndicator')?.getBoundingClientRect();
          const head = document.querySelector('[data-cat-head="page"]')?.getBoundingClientRect();
          return ind && head ? Math.abs(ind.top - head.top) : 999;
        }),
      )
      .toBeLessThan(2);

    await page.locator('#panelSearch').fill('прокси');
    await expect(page.locator('[data-cat="region"]')).not.toHaveClass(/is-filtered/);
    await expect(page.locator('[data-cat="player"]')).toHaveClass(/is-filtered/);
    await expect(page.locator('#panelNoResults')).toBeHidden();

    await page.locator('#panelSearch').fill('абракадабра');
    await expect(page.locator('#panelNoResults')).toBeVisible();
    await page.locator('#btnPanelSearchClear').click();

    // --- ARIA и фокус -------------------------------------------------------
    await openAppCategory(page);
    await expect(page.locator('[data-cat-head="app"]')).toHaveAttribute('aria-expanded', 'true');
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const ind = document.getElementById('settingsNavIndicator')?.getBoundingClientRect();
          const head = document.querySelector('[data-cat-head="app"]')?.getBoundingClientRect();
          return ind && head ? Math.abs(ind.top - head.top) : 999;
        }),
      )
      .toBeLessThan(2);
    await expect(page.locator('#offlineScreen')).toHaveAttribute('role', 'alert');

    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      const style = getComputedStyle(active);
      return {
        visible: active.matches(':focus-visible'),
        outline: style.outlineStyle,
        width: style.outlineWidth,
      };
    });
    expect(focus.visible).toBe(true);
    expect(focus.outline).toBe('solid');
    expect(parseFloat(focus.width)).toBeGreaterThan(0);

    // --- Reduced motion -----------------------------------------------------
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const transition = await page.evaluate(
      () => getComputedStyle(document.querySelector('.panel-row')).transitionDuration,
    );
    expect(parseFloat(transition)).toBeLessThan(0.01);

    // --- Масштаб интерфейса -------------------------------------------------
    const dprBefore = await page.evaluate(() => window.devicePixelRatio);
    await page.locator('#uiScaleSelect').selectOption('1.25');
    await waitForValue(
      () => (fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')).uiScale : 0),
      (value) => value === 1.25,
      'масштаб интерфейса сохранён',
    );
    const dprAfter = await page.evaluate(() => window.devicePixelRatio);
    expect(dprAfter).toBeGreaterThan(dprBefore);

    // --- RTL ----------------------------------------------------------------
    await page.evaluate(() => window.octo.cmd('language', 'ar'));
    await waitForValue(
      () => page.evaluate(() => document.documentElement.dir),
      (value) => value === 'rtl',
      'арабский интерфейс RTL',
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    // Масштаб переживает перезапуск.
    await app.close();
    app = await launch(userData);
    await app.firstWindow();
    const page2 = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка после перезапуска',
    );
    await openAppCategory(page2);
    await expect(page2.locator('#uiScaleSelect')).toHaveValue('1.25');
    expect(await page2.evaluate(() => window.devicePixelRatio)).toBeGreaterThan(1);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
