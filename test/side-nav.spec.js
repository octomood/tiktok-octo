'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

function viewBounds(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith('/index.html'),
    );
    if (!win) return null;
    const view = win.contentView.children[0];
    return view ? { url: view.webContents.getURL(), bounds: view.getBounds() } : null;
  });
}

test('кастомное левое меню навигации: поиск, разделы, сворачивание и скрытие нативного меню', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-sidenav-'));
  const stateFile = path.join(userData, 'octo-state.json');
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
      'главное окно',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    // Мокаем https://www.tiktok.com, чтобы не ходить в сеть.
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/index.html'),
      );
      const ses = win.contentView.children[0].webContents.session;
      ses.protocol.handle('https', (req) => {
        const u = new URL(req.url);
        if (u.hostname === 'www.tiktok.com') {
          return new Response(
            `<!doctype html><html><head><title>(5) TikTok</title></head><body>
              <aside class="DivSideNavContainer" id="nativeSideNav">
                <a data-e2e="nav-foryou" href="/foryou">For You</a>
                <a data-e2e="nav-profile" href="/@octo_user">Profile</a>
              </aside>
              <main id="mockMain" data-path="${u.pathname}${u.search}">OK ${u.pathname}${u.search}</main>
            </body></html>`,
            { headers: { 'content-type': 'text/html; charset=utf-8' } },
          );
        }
        return new Response('ok', { headers: { 'content-type': 'text/html; charset=utf-8' } });
      });
    });

    // 1. Меню видно, занимает 240 px, сдвигает WebContentsView и подсвечивает «Рекомендации».
    await expect(page.locator('#appSideNav')).toBeVisible();
    const navBox = await page.locator('#appSideNav').boundingBox();
    expect(Math.round(navBox.width)).toBe(240);
    const navBorders = await page.evaluate(() => ({
      nav: getComputedStyle(document.getElementById('appSideNav')).borderRightWidth,
      search: getComputedStyle(document.getElementById('sideNavSearchBar')).borderTopWidth,
    }));
    expect(navBorders).toEqual({ nav: '0px', search: '0px' });
    await expect.poll(async () => (await viewBounds(app))?.bounds?.x).toBe(240);
    await expect(page.locator('[data-sidenav="foryou"]')).toHaveClass(/is-current/);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const ind = document.getElementById('appSideNavIndicator')?.getBoundingClientRect();
          const btn = document.querySelector('[data-sidenav="foryou"]')?.getBoundingClientRect();
          return ind && btn ? Math.abs(ind.top - btn.top) : 999;
        }),
      )
      .toBeLessThan(2);

    // 2. Переходы по разделам, профиль через скрытый data-e2e и поиск.
    await page.locator('[data-sidenav="explore"]').click();
    await expect
      .poll(async () => (await viewBounds(app))?.url)
      .toBe('https://www.tiktok.com/explore');
    await expect(page.locator('[data-sidenav="explore"]')).toHaveClass(/is-current/);

    // Нативное меню TikTok на загруженной странице полностью скрыто.
    await expect
      .poll(() =>
        site.evaluate(() => getComputedStyle(document.getElementById('nativeSideNav')).display),
      )
      .toBe('none');

    // Счётчик непрочитанных из заголовка страницы отражается на пункте «Сообщения».
    await expect(page.locator('#sideNavUnread')).toHaveText('5');

    // Профиль читает /@octo_user из скрытого [data-e2e="nav-profile"].
    await page.locator('[data-sidenav="profile"]').click();
    await expect
      .poll(async () => (await viewBounds(app))?.url)
      .toBe('https://www.tiktok.com/@octo_user');
    await expect(page.locator('[data-sidenav="profile"]')).toHaveClass(/is-current/);

    // Поиск переходит на /search?q=...
    await page.locator('#sideNavSearch').fill('cats');
    await expect(page.locator('#btnSideNavSearchClear')).toBeVisible();
    await page.locator('#sideNavSearch').press('Enter');
    await expect
      .poll(async () => (await viewBounds(app))?.url)
      .toBe('https://www.tiktok.com/search?q=cats');

    // 3. «Сообщения» в меню открывают полный экран, а кнопка сверху — сбоку.
    await page.locator('[data-sidenav="messages"]').click();
    await expect
      .poll(async () => (await viewBounds(app))?.url)
      .toBe('https://www.tiktok.com/messages');
    await expect(page.locator('[data-sidenav="messages"]')).toHaveClass(/is-current/);
    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'false');

    await site.evaluate(() => window.history.pushState({}, '', '/business-suite/messages'));
    await expect(page.locator('[data-sidenav="messages"]')).toHaveClass(/is-current/);
    await site.evaluate(() => window.history.pushState({}, '', '/inbox'));
    await expect(page.locator('[data-sidenav="messages"]')).toHaveClass(/is-current/);

    await page.locator('[data-sidenav="foryou"]').click();
    await expect
      .poll(async () => (await viewBounds(app))?.url)
      .toBe('https://www.tiktok.com/foryou');

    await page.click('#btnChat');
    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-sidenav="foryou"]')).toHaveClass(/is-current/);
    await page.click('#btnChat');
    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'false');

    // 4. Косметика скрывает «Трансляция» и «Мини-сериалы» в кастомном меню.
    await page.locator('[data-sidenav="settings"]').click();
    await expect(page.locator('#panel')).toBeVisible();
    await page.locator('[data-cat-head="cosmetics"]').click();
    await page.locator('#panelCosmetics [data-cosmetic="hide-live-nav"]').click();
    await page.locator('#panelCosmetics [data-cosmetic="hide-drama-nav"]').click();
    await page.click('#btnPanelClose');
    await expect(page.locator('[data-sidenav="live"]')).toBeHidden();
    await expect(page.locator('[data-sidenav="short-drama"]')).toBeHidden();

    // 5. Сворачивание до узкого рельса (72 px), сохранение и разворот через иконку поиска.
    await page.locator('#btnSideNavToggle').click();
    await expect(page.locator('#appSideNav')).toHaveClass(/is-collapsed/);
    await expect.poll(async () => (await viewBounds(app))?.bounds?.x).toBe(72);
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(saved.sideNavCollapsed).toBe(true);

    await page.locator('#btnSideNavSearch').click();
    await expect(page.locator('#appSideNav')).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('#sideNavSearch')).toBeFocused();
    await expect.poll(async () => (await viewBounds(app))?.bounds?.x).toBe(240);

    // 6. В режиме «только полоса» кастомное меню скрывается и возвращается при выходе.
    await page.evaluate(() => window.octo.cmd('barOnly'));
    await expect(page.locator('#appSideNav')).toBeHidden();
    await page.evaluate(() => window.octo.cmd('barExit'));
    await expect(page.locator('#appSideNav')).toBeVisible();
    await expect.poll(async () => (await viewBounds(app))?.bounds?.x).toBe(240);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
