'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Чат сбоку: один клик по «Сообщениям» открывает панель поверх ленты,
 * двойной — обычную страницу сообщений на всё окно.
 *
 * Сайт не грузим: OCTO_HOME_URL и OCTO_CHAT_URL указывают на локальные
 * about:blank/data:-страницы, поэтому тест не зависит от TikTok и сети.
 * Клики синтетические: так проверяется наш перехватчик в странице, а не
 * навигация самого сайта.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

function views(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    return win.contentView.children.map((child) => ({
      url: child.webContents.getURL(),
      bounds: child.getBounds(),
      destroyed: child.webContents.isDestroyed(),
    }));
  });
}

test('чат открывается панелью слева, двойной клик — страницей', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-chat-'));
  const chatHtml = `<!doctype html>
<html><body style="margin:0;background:#fff;color:#111">
  <div class="DivSideNavContainer" id="site-nav">nav</div>
  <div class="DivHeaderContainer" id="site-header">header</div>
  <div class="DivBodyContainer"><p id="chat">chat</p></div>
</body></html>`;
  const chatUrl = `data:text/html,${encodeURIComponent(chatHtml)}`;
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_CHAT_URL: chatUrl,
      },
    });

    await app.firstWindow();

    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    const before = await views(app);
    expect(before).toHaveLength(1);
    expect(before[0].url).toBe('about:blank');

    // Ссылка «Сообщения» как на сайте: перехватчик должен открыть панель,
    // а не пустить роутер TikTok на отдельную страницу.
    await site.evaluate(() => {
      const link = document.createElement('a');
      link.id = 'octo-messages';
      link.href = 'https://www.tiktok.com/messages';
      link.textContent = 'Сообщения';
      document.body.append(link);
      // Сайт может открывать свой чат уже на pointerdown/click: проверяем,
      // что до его обработчиков событие не доходит.
      window.__siteOpened = false;
      link.addEventListener('pointerdown', () => {
        window.__siteOpened = true;
      });
      link.addEventListener('click', () => {
        window.__siteOpened = true;
      });
    });
    await site.click('#octo-messages');
    expect(await site.evaluate(() => window.__siteOpened)).toBe(false);

    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => (await views(app)).length, { message: 'панель чата не появилась' })
      .toBe(2);

    const withChat = await views(app);
    const chatView = withChat.find((view) => view.url.startsWith('data:text/html'));
    const feedView = withChat.find((view) => view.url === 'about:blank');
    expect(chatView, 'панель загрузила адрес чата').toBeTruthy();
    expect(feedView, 'лента осталась на своей странице').toBeTruthy();
    expect(chatView.bounds.width).toBe(420);
    // По умолчанию чат поджимает ленту, а не лежит поверх неё.
    expect(feedView.bounds.x).toBe(426);
    expect(chatView.bounds.x).toBe(0);

    // Панель — часть приложения: косметика и тёмная тема применяются и к ней.
    const chatPage = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('data:text/html'),
      'страница панели чата',
    );
    await expect
      .poll(() =>
        chatPage.evaluate(() => getComputedStyle(document.getElementById('site-nav')).display),
      )
      .toBe('none');
    await expect
      .poll(() =>
        chatPage.evaluate(() => getComputedStyle(document.getElementById('site-header')).display),
      )
      .toBe('none');
    await expect
      .poll(() =>
        chatPage.evaluate(() => getComputedStyle(document.getElementById('chat')).fontFamily),
      )
      .toContain('Inter');

    // Auto dark mode рисует белую страницу тёмной: проверяем реальный пиксель.
    const chatBrightness = () =>
      app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        const chat = win.contentView.children.find((child) =>
          child.webContents.getURL().startsWith('data:text/html'),
        );
        const image = await chat.webContents.capturePage();
        const size = image.getSize();
        const bitmap = image.toBitmap();
        const x = Math.max(0, size.width - 12);
        const y = Math.max(0, size.height - 12);
        const index = (y * size.width + x) * 4;
        return (bitmap[index] + bitmap[index + 1] + bitmap[index + 2]) / 3;
      });
    await expect
      .poll(
        async () => {
          try {
            return await chatBrightness();
          } catch {
            return 255;
          }
        },
        { message: 'тёмная тема не применилась к панели чата' },
      )
      .toBeLessThan(80);

    // Переключатель «Тёмная тема везде» действует и на панель чата.
    await page.evaluate(() => window.octo.cmd('cosmetic', 'dark-theme'));
    await expect
      .poll(async () => {
        try {
          return await chatBrightness();
        } catch {
          return 0;
        }
      })
      .toBeGreaterThan(200);
    await page.evaluate(() => window.octo.cmd('cosmetic', 'dark-theme'));
    await expect
      .poll(async () => {
        try {
          return await chatBrightness();
        } catch {
          return 255;
        }
      })
      .toBeLessThan(80);

    // Кнопка в полосе заголовка закрывает панель.
    await page.click('#btnChat');
    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await views(app)).length).toBe(1);

    // И открывает её снова — без клика по сайту.
    await page.click('#btnChat');
    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await views(app)).length).toBe(2);
    await page.click('#btnChat');
    await expect.poll(async () => (await views(app)).length).toBe(1);

    // Двойной клик: панель закрывается, сообщения открываются в ленте.
    // Переключение темы перезагрузило ленту — ссылку добавляем заново.
    await site.evaluate(() => {
      const link = document.createElement('a');
      link.id = 'octo-messages';
      link.href = 'https://www.tiktok.com/messages';
      link.textContent = 'Сообщения';
      document.body.append(link);
    });
    await site.evaluate(() => {
      const link = document.getElementById('octo-messages');
      link.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
      );
      link.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 }),
      );
    });

    await expect
      .poll(
        async () => {
          const list = await views(app);
          return list.length === 1 ? list[0].url : '';
        },
        { message: 'страница сообщений не открылась' },
      )
      .toMatch(/^data:text\/html/);
    await expect(page.locator('#btnChat')).toHaveAttribute('aria-pressed', 'false');
    expect(await views(app)).toHaveLength(1);
  } finally {
    if (app) await app.close();
  }
});
