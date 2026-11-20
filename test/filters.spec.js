'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Фильтры контента: ключевое слово в описании перелистывает ленту, обычный
 * ролик не трогается. Проверяем только видимый DOM поддельной страницы.
 */

async function waitForWindow(app, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('окно не появилось');
}

function feedItem(description) {
  return `(() => {
    const item = document.createElement('div');
    item.setAttribute('data-e2e', 'recommend-list-item-container');
    item.style.cssText = 'position: relative; width: 360px; height: 300px;';
    const video = document.createElement('video');
    video.style.cssText = 'width: 320px; height: 280px;';
    const caption = document.createElement('span');
    caption.textContent = ${JSON.stringify(description)};
    caption.style.cssText = 'position: absolute; top: 6px; left: 6px; width: 200px; height: 18px;';
    item.append(video, caption);
    document.body.append(item);
    return item;
  })()`;
}

/** Ролик с ссылкой на автора: фильтр по @nick смотрит на href. */
function feedItemWithLink(description, href) {
  return `(() => {
    const item = document.createElement('div');
    item.setAttribute('data-e2e', 'recommend-list-item-container');
    item.style.cssText = 'position: relative; width: 360px; height: 300px;';
    const video = document.createElement('video');
    video.style.cssText = 'width: 320px; height: 280px;';
    const caption = document.createElement('span');
    caption.textContent = ${JSON.stringify(description)};
    caption.style.cssText = 'position: absolute; top: 6px; left: 6px; width: 200px; height: 18px;';
    const link = document.createElement('a');
    link.href = ${JSON.stringify(href)};
    link.textContent = 'author';
    link.style.cssText = 'position: absolute; top: 30px; left: 6px;';
    item.append(video, caption, link);
    document.body.append(item);
    return item;
  })()`;
}

test('фильтры: слово в ролике перелистывает ленту, обычный — нет', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-filters-'));
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
    const page = await waitForWindow(app, (candidate) => candidate.url().startsWith('file://'));
    const site = await waitForWindow(app, (candidate) => candidate.url() === 'about:blank');

    await site.evaluate(() => {
      window.__filterClicks = 0;
      const next = document.createElement('button');
      next.setAttribute('data-e2e', 'feed-navigation-next');
      next.style.cssText = 'position: fixed; right: 10px; bottom: 10px; width: 40px; height: 40px;';
      next.addEventListener('click', () => {
        window.__filterClicks += 1;
      });
      document.body.append(next);
    });

    // Списки сохраняются без символов # и @ — так их удобнее сравнивать.
    await page.evaluate(() =>
      window.octo.cmd('filtersSet', {
        keywords: 'спойлер',
        hashtags: '#сериал',
        authors: '@octo',
      }),
    );
    await page.evaluate(() => window.octo.cmd('filtersToggle'));
    await expect(page.locator('#rowFilters')).toHaveAttribute('aria-checked', 'true');

    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'octo-state.json'), 'utf8'));
    expect(saved.filters.enabled).toBe(true);
    expect(saved.filters.keywords).toEqual(['спойлер']);
    expect(saved.filters.hashtags).toEqual(['сериал']);
    expect(saved.filters.authors).toEqual(['octo']);

    // Ролик с запрещённым словом — перелистывание.
    await site.evaluate(feedItem('Спойлер в конце!'));
    await expect.poll(() => site.evaluate(() => window.__filterClicks), { timeout: 6000 }).toBe(1);

    // Обычный ролик остаётся: тот же обработчик, но нет совпадения.
    await site.evaluate(() => {
      document.querySelectorAll('[data-e2e="recommend-list-item-container"]').forEach((node) => {
        node.remove();
      });
    });
    await site.evaluate(feedItem('Обычный ролик про кота'));
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect(await site.evaluate(() => window.__filterClicks)).toBe(1);

    // Границы: #кот не режет #котики, @bob — @bobby.
    await site.evaluate(() => {
      document.querySelectorAll('[data-e2e="recommend-list-item-container"]').forEach((node) => {
        node.remove();
      });
    });
    await page.evaluate(() =>
      window.octo.cmd('filtersSet', { keywords: '', hashtags: '#кот', authors: '@bob' }),
    );
    await site.evaluate(feedItemWithLink('#котики', 'https://www.tiktok.com/@bobby/video/1'));
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect(await site.evaluate(() => window.__filterClicks)).toBe(1);

    await site.evaluate(() => {
      document.querySelectorAll('[data-e2e="recommend-list-item-container"]').forEach((node) => {
        node.remove();
      });
    });
    await site.evaluate(feedItemWithLink('#кот', 'https://www.tiktok.com/@bob/video/1'));
    await expect.poll(() => site.evaluate(() => window.__filterClicks), { timeout: 6000 }).toBe(2);

    await page.evaluate(() => window.octo.cmd('filtersToggle'));
    await expect(page.locator('#rowFilters')).toHaveAttribute('aria-checked', 'false');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
