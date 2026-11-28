'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Переключение видео внутри полноэкранного режима сайта (HTML5 fullscreen).
 *
 * Подменяем https://www.tiktok.com локальным ответом в протоколе сессии (без
 * выхода в сеть), чтобы браузер выдал штатное разрешение fullscreen как для
 * настоящего сайта. Проверяем переход по кнопке оверлея, стрелкам вверх/вниз,
 * колёсику мыши, команде feedPrev, восстановление после удаления старого
 * контейнера из DOM и немедленный выход по Esc.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

async function mountMockTikTok(app, site, targetUrl) {
  await app.evaluate(({ session }) => {
    const ses = session.fromPartition('persist:octo-tiktok');
    ses.protocol.handle('https', (request) => {
      const host = new URL(request.url).hostname;
      if (host === 'www.tiktok.com') {
        return new Response('<!doctype html><html><body></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return new Response('', { status: 404 });
    });
  });
  await site.goto(targetUrl);
  await expect.poll(() => site.evaluate(() => typeof window.__octoFullscreenNav)).toBe('object');
}

test('полноэкранный режим: переключение кнопками, стрелками, колесом, командой и выход по Esc', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-fs-nav-'));
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
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    await mountMockTikTok(app, site, 'https://www.tiktok.com/foryou');

    await site.evaluate(() => {
      document.body.style.margin = '0';

      const makeItem = (id, videoId, label) => {
        const item = document.createElement('div');
        item.dataset.e2e = 'recommend-list-item-container';
        item.style.height = '100vh';
        item.style.position = 'relative';

        const wrap = document.createElement('div');
        wrap.className = 'DivBasicPlayerWrapper';
        wrap.id = id;
        wrap.style.width = '640px';
        wrap.style.height = '360px';

        const video = document.createElement('video');
        video.id = videoId;
        video.dataset.label = label;
        let paused = videoId !== 'v1';
        Object.defineProperty(video, 'paused', {
          configurable: true,
          get: () => paused,
        });
        video.play = () => {
          paused = false;
          video.dispatchEvent(new window.Event('play', { bubbles: true }));
          return Promise.resolve();
        };
        video.pause = () => {
          paused = true;
          video.dispatchEvent(new window.Event('pause', { bubbles: true }));
        };
        video.style.width = '100%';
        video.style.height = '100%';

        wrap.append(video);
        item.append(wrap);
        return { item, wrap, video };
      };

      const first = makeItem('wrap1', 'v1', 'first');
      const second = makeItem('wrap2', 'v2', 'second');
      document.body.append(first.item, second.item);

      window.__currentIndex = 0;
      window.__detachOnNext = false;

      const switchTo = (nextIndex) => {
        window.__currentIndex = nextIndex;
        const items = [...document.querySelectorAll('[data-e2e="recommend-list-item-container"]')];
        items.forEach((el, idx) => {
          const vid = el.querySelector('video');
          if (!vid) return;
          if (idx === nextIndex) vid.play();
          else vid.pause();
        });
        const target = items[nextIndex];
        if (target) target.scrollIntoView({ block: 'center', behavior: 'auto' });
      };

      const nextBtn = document.createElement('button');
      nextBtn.dataset.e2e = 'feed-navigation-next';
      nextBtn.style.position = 'fixed';
      nextBtn.style.right = '8px';
      nextBtn.style.bottom = '48px';
      nextBtn.style.width = '24px';
      nextBtn.style.height = '24px';
      nextBtn.addEventListener('click', () => {
        if (window.__detachOnNext) {
          window.__detachOnNext = false;
          first.item.remove();
          second.item.remove();
          setTimeout(() => {
            const third = makeItem('wrap3', 'v3', 'third');
            document.body.append(third.item);
            third.video.play();
            third.item.scrollIntoView({ block: 'center', behavior: 'auto' });
          }, 150);
          return;
        }
        const items = document.querySelectorAll('[data-e2e="recommend-list-item-container"]');
        if (window.__currentIndex < items.length - 1) switchTo(window.__currentIndex + 1);
      });

      const prevBtn = document.createElement('button');
      prevBtn.dataset.e2e = 'feed-navigation-prev';
      prevBtn.style.position = 'fixed';
      prevBtn.style.right = '8px';
      prevBtn.style.bottom = '80px';
      prevBtn.style.width = '24px';
      prevBtn.style.height = '24px';
      prevBtn.addEventListener('click', () => {
        if (window.__currentIndex > 0) switchTo(window.__currentIndex - 1);
      });

      const enterBtn = document.createElement('button');
      enterBtn.id = 'enterFs';
      enterBtn.textContent = 'FS';
      enterBtn.style.position = 'fixed';
      enterBtn.style.left = '8px';
      enterBtn.style.top = '8px';
      enterBtn.addEventListener('click', () => {
        first.wrap.requestFullscreen();
      });

      document.body.append(nextBtn, prevBtn, enterBtn);
    });

    await site.click('#enterFs');
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null))
      .toBe('wrap1');
    await expect(site.locator('#octo-fs-nav')).toBeAttached();
    await expect
      .poll(() =>
        site.evaluate(() => document.getElementById('octo-fs-nav')?.parentElement?.id || null),
      )
      .toBe('wrap1');

    // 1. Клик по кнопке «Следующее видео» внутри полноэкранного оверлея.
    await site.locator('#octo-fs-next').click({ force: true });
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null))
      .toBe('wrap2');
    await expect
      .poll(() =>
        site.evaluate(() => ({
          v1Paused: document.getElementById('v1')?.paused,
          v2Paused: document.getElementById('v2')?.paused,
          navParent: document.getElementById('octo-fs-nav')?.parentElement?.id || null,
        })),
      )
      .toEqual({ v1Paused: true, v2Paused: false, navParent: 'wrap2' });

    // 2. Стрелка вверх возвращает предыдущее видео с сохранением fullscreen.
    await site.keyboard.press('ArrowUp');
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null))
      .toBe('wrap1');
    await expect.poll(() => site.evaluate(() => document.getElementById('v1')?.paused)).toBe(false);

    // 3. Колёсико мыши вниз перелистывает к следующему видео.
    await site.mouse.move(320, 240);
    await site.mouse.wheel(0, 120);
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null))
      .toBe('wrap2');

    // 4. Команда оболочки feedPrev (Ctrl+Shift+← / медиа-кнопка) тоже работает в fullscreen.
    await page.evaluate(() => window.octo.cmd('feedPrev'));
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null))
      .toBe('wrap1');

    // 5. Если сайт удалил старый контейнер из DOM во время переключения, полный экран
    // восстанавливается на новом плеере.
    await site.evaluate(() => {
      window.__detachOnNext = true;
    });
    await site.keyboard.press('ArrowDown');
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null), { timeout: 6000 })
      .toBe('wrap3');

    // 6. Escape (через before-input-event) сразу выходит из полноэкранного режима и убирает кнопки.
    const cdp = await site.context().newCDPSession(site);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
    await expect.poll(() => site.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(site.locator('#octo-fs-nav')).toHaveCount(0);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('полноэкранный режим: смена src внутри одного контейнера (режим просмотра)', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-fs-browse-'));
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
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url() === 'about:blank',
      'страница сайта',
    );

    await mountMockTikTok(app, site, 'https://www.tiktok.com/@user/video/1');

    await site.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.className = 'DivBasicPlayerWrapper';
      wrap.id = 'browseWrap';
      wrap.style.width = '640px';
      wrap.style.height = '360px';

      const video = document.createElement('video');
      video.id = 'browseVideo';
      video.setAttribute('src', 'https://example.invalid/1.mp4');
      video.play = () => Promise.resolve();
      wrap.append(video);

      const nextArrow = document.createElement('button');
      nextArrow.dataset.e2e = 'arrow-right';
      nextArrow.style.width = '24px';
      nextArrow.style.height = '24px';
      nextArrow.addEventListener('click', () => {
        video.setAttribute('src', 'https://example.invalid/2.mp4');
      });

      const enterBtn = document.createElement('button');
      enterBtn.id = 'enterBrowseFs';
      enterBtn.addEventListener('click', () => wrap.requestFullscreen());

      document.body.append(wrap, nextArrow, enterBtn);
    });

    await site.click('#enterBrowseFs');
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null))
      .toBe('browseWrap');

    await site.keyboard.press('ArrowDown');
    await expect
      .poll(() => site.evaluate(() => document.getElementById('browseVideo')?.getAttribute('src')))
      .toBe('https://example.invalid/2.mp4');
    await expect
      .poll(() => site.evaluate(() => document.fullscreenElement?.id || null))
      .toBe('browseWrap');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
