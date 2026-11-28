'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

const TEST_PAGE = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Rainbow MD3 Test</title></head>
  <body style="margin:0;background:#ffffff;color:#111111;">
    <button id="btnLogin" data-e2e="top-login-button" style="background:#fe2c55;color:#fff;">Войти</button>
    <div id="shadowHost"></div>
    <script>
      const root = document.getElementById('shadowHost').attachShadow({ mode: 'open' });
      const btn = document.createElement('button');
      btn.id = 'shadowBtn';
      btn.setAttribute('data-e2e', 'top-login-button');
      btn.style.cssText = 'background:#fe2c55;color:#fff;';
      btn.textContent = 'Shadow';
      root.appendChild(btn);
    </script>
  </body>
</html>`;

async function findWindow(app, predicate) {
  let found = app.windows().find(predicate);
  for (let attempt = 0; attempt < 80 && !found; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    found = app.windows().find(predicate);
  }
  return found;
}

function readState(userData) {
  try {
    return JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
  } catch {
    return {};
  }
}

test('переливание цветов интерфейса в косметике работает на оболочке, сайте и в AMOLED', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(TEST_PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-rainbow-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: url,
      },
    });

    await app.firstWindow();
    const page = await findWindow(app, (candidate) => candidate.url().startsWith('file://'));
    expect(page, 'окно оболочки не появилось').toBeTruthy();
    const site = await findWindow(app, (candidate) => candidate.url().startsWith(url));
    expect(site, 'страница сайта не появилась').toBeTruthy();

    await page.waitForLoadState('load');
    await site.waitForLoadState('load');

    await page.click('#btnPanel');
    await page.locator('[data-cat-head="experimental"]').click();

    const rainbowSwitch = page.locator('#panelExperimental [data-cosmetic="rainbow-theme"]');
    await expect(rainbowSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#rainbowSettingsBox')).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-rainbow', 'true');

    await rainbowSwitch.click();
    await expect(rainbowSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#rainbowSettingsBox')).toBeVisible();
    await expect(page.locator('#rainbowHueFromVal')).toHaveText('0°');
    await expect(page.locator('#rainbowHueToVal')).toHaveText('360°');
    await expect(page.locator('#rainbowSpeedVal')).toHaveText('1.0×');
    await expect.poll(() => readState(userData).cosmetics?.['rainbow-theme']).toBe(true);

    await expect(page.locator('html')).toHaveAttribute('data-rainbow', 'true');
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-octo-rainbow')))
      .toBe('true');

    const readShellColors = () =>
      page.evaluate(() => {
        const probe = document.getElementById('btnPanel');
        return {
          hue: document.documentElement.style.getPropertyValue('--octo-hue').trim(),
          primary: getComputedStyle(document.documentElement)
            .getPropertyValue('--md-primary')
            .trim(),
          btnBg: probe ? getComputedStyle(probe).backgroundColor : '',
        };
      });

    const readSiteColors = () =>
      site.evaluate(() => ({
        hue: document.documentElement.style.getPropertyValue('--octo-hue').trim(),
        loginBg: getComputedStyle(document.getElementById('btnLogin')).backgroundColor,
        shadowBg: getComputedStyle(
          document.getElementById('shadowHost').shadowRoot.getElementById('shadowBtn'),
        ).backgroundColor,
      }));

    const firstShell = await readShellColors();
    const firstSite = await readSiteColors();
    expect(firstShell.hue).not.toBe('');
    expect(firstSite.hue).not.toBe('');
    expect(firstShell.primary).toContain('oklch');

    // Через короткую паузу угол спектра и итоговые цвета в оболочке, на сайте и в Shadow DOM меняются.
    await expect
      .poll(async () => {
        const nextShell = await readShellColors();
        const nextSite = await readSiteColors();
        return (
          nextShell.hue !== firstShell.hue &&
          nextSite.hue !== firstSite.hue &&
          nextSite.loginBg !== firstSite.loginBg &&
          nextSite.shadowBg !== firstSite.shadowBg
        );
      })
      .toBe(true);

    // При включении AMOLED-режима фон остаётся чисто чёрным, а переливание акцентов продолжается.
    await page.locator('[data-cat-head="cosmetics"]').click();
    await page.click('#rowThemeAmoled');
    await expect(page.locator('html')).toHaveAttribute('data-amoled', 'true');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--md-surface').trim(),
        ),
      )
      .toBe('#000000');
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe('rgb(0, 0, 0)');
    await page.click('#rowThemeAmoled');
    await expect(page.locator('html')).toHaveAttribute('data-amoled', 'false');
    await page.locator('[data-cat-head="experimental"]').click();

    // Пресеты оттенков, свой интервал и скорость меняют диапазон переливания и сохраняются.
    await page.click('[data-rainbow-preset="sunset"]');
    await expect(page.locator('#rainbowHueFromVal')).toHaveText('335°');
    await expect(page.locator('#rainbowHueToVal')).toHaveText('50°');
    await expect
      .poll(() => readState(userData).themeRainbow)
      .toEqual({
        hueFrom: 335,
        hueTo: 50,
        speed: 1,
      });
    await expect
      .poll(async () => {
        const shellHue = Number((await readShellColors()).hue);
        const siteHue = Number((await readSiteColors()).hue);
        const inSunset = (h) => (h >= 335 && h <= 360) || (h >= 0 && h <= 50);
        return inSunset(shellHue) && inSunset(siteHue);
      })
      .toBe(true);

    await page.locator('#rainbowHueFrom').fill('120');
    await page.locator('#rainbowHueTo').fill('180');
    await page.locator('#rainbowSpeed').fill('2.5');
    await expect(page.locator('#rainbowHueFromVal')).toHaveText('120°');
    await expect(page.locator('#rainbowHueToVal')).toHaveText('180°');
    await expect(page.locator('#rainbowSpeedVal')).toHaveText('2.5×');
    await expect
      .poll(() => readState(userData).themeRainbow)
      .toEqual({
        hueFrom: 120,
        hueTo: 180,
        speed: 2.5,
      });
    await expect
      .poll(async () => {
        const shellHue = Number((await readShellColors()).hue);
        const siteHue = Number((await readSiteColors()).hue);
        return shellHue >= 120 && shellHue <= 180 && siteHue >= 120 && siteHue <= 180;
      })
      .toBe(true);

    // Выключение возвращает статичную палитру и убирает --octo-hue.
    await rainbowSwitch.click();
    await expect(rainbowSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#rainbowSettingsBox')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-rainbow', 'false');
    await expect
      .poll(() => site.evaluate(() => document.documentElement.hasAttribute('data-octo-rainbow')))
      .toBe(false);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          hue: document.documentElement.style.getPropertyValue('--octo-hue').trim(),
          primary: getComputedStyle(document.documentElement)
            .getPropertyValue('--md-primary')
            .trim(),
        })),
      )
      .toEqual({ hue: '', primary: '#8c84a9' });
    await expect
      .poll(() =>
        site.evaluate(() => ({
          hue: document.documentElement.style.getPropertyValue('--octo-hue').trim(),
          loginBg: getComputedStyle(document.getElementById('btnLogin')).backgroundColor,
        })),
      )
      .toEqual({ hue: '', loginBg: 'rgb(140, 132, 169)' });
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
