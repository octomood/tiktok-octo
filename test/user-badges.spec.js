'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Бейджи сообщества у ников:
 * проверяем встроенный бейдж создателя (`churros_dev`), удалённую загрузку
 * `badges.json` по локальному HTTP-серверу, отсутствие дубликатов, открытие
 * MD3-модалки с описанием по клику (без перехода по ссылке) и снятие при
 * выключении правила в косметике.
 */

const MOCK_BADGES = {
  version: 2,
  roles: {
    supporter: {
      icon: '09_heart_pulse',
      title: 'Поддержал проект',
      description: 'Поддержал TikTok Octo материально — спасибо ему!',
      accent: 'tertiary',
    },
  },
  users: {
    supporter_test: {
      role: 'supporter',
      description: 'Поддержал развитие клиента на старте. Огромное спасибо!',
      since: 'с 2025',
    },
  },
};

const SITE_PAGE = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>TikTok Badges Test</title>
  </head>
  <body>
    <nav>
      <a href="/@churros_dev" data-e2e="nav-profile">Профиль</a>
    </nav>
    <header>
      <h1 data-e2e="user-title">Churros</h1>
      <h2 data-e2e="user-subtitle">churros_dev</h2>
    </header>
    <section id="comments">
      <div data-e2e="comment-username-1">
        <a href="/@supporter_test" id="supporterLink"><span>supporter_test</span></a>
      </div>
      <div data-e2e="comment-username-2">
        <a href="/@ordinary_user" id="ordinaryLink"><span>ordinary_user</span></a>
      </div>
    </section>
  </body>
</html>`;

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('бейджи сообщества отображаются у ников и показывают описание по клику', async () => {
  const server = http.createServer((request, response) => {
    if (request.url === '/badges.json') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        etag: '"badges-v2"',
      });
      response.end(JSON.stringify(MOCK_BADGES));
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(SITE_PAGE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-badges-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: `${baseUrl}/@churros_dev`,
        OCTO_BADGES_URL: `${baseUrl}/badges.json`,
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
      (candidate) => candidate.url().startsWith(baseUrl),
      'страница сайта',
    );

    await expect.poll(() => site.evaluate(() => typeof window.__octoBadges)).toBe('object');

    // Профиль создателя churros_dev получает значок кода, обычный пользователь — нет.
    const creatorBadge = site.locator(
      '[data-e2e="user-subtitle"] .octo-user-badge[data-octo-badge-user="churros_dev"]',
    );
    await expect(creatorBadge).toHaveCount(1);
    await expect(creatorBadge).toHaveAttribute('data-octo-badge-icon', '01_code_brackets');
    const badgeBg = await creatorBadge.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(badgeBg).toBe('rgba(0, 0, 0, 0)');

    // Навигационный пункт сайдбара не должен получать бейдж.
    await expect(site.locator('[data-e2e="nav-profile"] .octo-user-badge')).toHaveCount(0);
    await expect(site.locator('#ordinaryLink .octo-user-badge')).toHaveCount(0);

    // Удалённо загруженный бейдж сторонника появляется в комментариях.
    const supporterBadge = site.locator(
      '#supporterLink .octo-user-badge[data-octo-badge-user="supporter_test"]',
    );
    await expect(supporterBadge).toHaveCount(1);
    await expect(supporterBadge).toHaveAttribute('data-octo-badge-icon', '09_heart_pulse');

    // Клик по бейджу создателя открывает компактный MD3-поповер сверху с ролью и описанием.
    await creatorBadge.click();
    const modal = site.locator('#octo-badge-modal');
    await expect(modal).toBeVisible();
    const box = await modal.boundingBox();
    expect(box.width).toBeLessThanOrEqual(380);
    expect(box.height).toBeLessThanOrEqual(280);
    await expect(modal.locator('#octo-badge-modal-handle')).toHaveText('@churros_dev');
    await expect(modal.locator('#octo-badge-modal-title')).toHaveText('Создатель TikTok Octo');
    await expect(modal.locator('#octo-badge-modal-desc')).toContainText('TikTok Octo');
    await expect(modal.locator('#octo-badge-modal-emblem-shape')).toBeVisible();
    await expect(modal.locator('#octo-badge-modal-since')).toHaveCount(0);
    const modalBorder = await modal.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(modalBorder).toBe('0px');
    await site.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);

    // Клик по бейджу внутри ссылки <a href="/@supporter_test"> не уводит со страницы.
    const urlBefore = site.url();
    await supporterBadge.click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('#octo-badge-modal-handle')).toHaveText('@supporter_test');
    await expect(modal.locator('#octo-badge-modal-since')).toHaveText('с 2025');
    await expect(modal.locator('#octo-badge-modal-title')).toHaveText('Поддержал проект');
    await expect(modal.locator('#octo-badge-modal-desc')).toContainText('Поддержал развитие');
    const supporterAccent = await modal.evaluate((el) =>
      el.style.getPropertyValue('--octo-badge-accent'),
    );
    expect(supporterAccent).toContain('--octo-md-tertiary');
    expect(site.url()).toBe(urlBefore);
    await modal.locator('#octo-badge-modal-close').click();
    await expect(modal).toHaveCount(0);

    // Клик вне карточки также закрывает окно.
    await creatorBadge.click();
    await expect(modal).toBeVisible();
    await site.locator('[data-e2e="user-title"]').click();
    await expect(modal).toHaveCount(0);

    // «Уменьшить движение»: без пружины у значка, перехода у кнопки закрытия и
    // анимации появления окна; без настройки анимации остаются прежними.
    const badgeMotion = () =>
      site.evaluate(() => {
        const badge = document.querySelector(
          '.octo-user-badge[data-octo-badge-user="churros_dev"]',
        );
        const box = document.getElementById('octo-badge-modal');
        const close = document.getElementById('octo-badge-modal-close');
        return {
          badge: getComputedStyle(badge).transitionDuration,
          close: close ? getComputedStyle(close).transitionDuration : '',
          modal: box ? getComputedStyle(box).animationName : '',
        };
      });
    await creatorBadge.click();
    await expect(modal).toBeVisible();
    expect(await badgeMotion()).toEqual({
      badge: '0.2s, 0.15s',
      close: '0.14s, 0.14s',
      modal: 'octo-badge-pop',
    });
    await site.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await site.emulateMedia({ reducedMotion: 'reduce' });
    await creatorBadge.click();
    await expect(modal).toBeVisible();
    expect(await badgeMotion()).toEqual({ badge: '0s', close: '0s', modal: 'none' });
    await site.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await site.emulateMedia({ reducedMotion: 'no-preference' });

    // Переключатель в косметике убирает и возвращает бейджи.
    await page.evaluate(() => window.octo.cmd('cosmetic', 'user-badges'));
    await expect(site.locator('.octo-user-badge')).toHaveCount(0);
    await page.evaluate(() => window.octo.cmd('cosmetic', 'user-badges'));
    await expect(creatorBadge).toHaveCount(1);
    await expect(supporterBadge).toHaveCount(1);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
