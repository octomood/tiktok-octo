'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/** WebContentsView сайта появляется в списке окон Playwright не сразу. */
async function waitForView(app) {
  let view = app.windows().find((candidate) => candidate.url() === 'about:blank');
  for (let attempt = 0; attempt < 50 && !view; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    view = app.windows().find((candidate) => candidate.url() === 'about:blank');
  }
  return view;
}

/**
 * Сторож воспроизведения проверяется на поддельных видео в about:blank,
 * поэтому тест не зависит от сети.
 *
 * Два сценария:
 * 1. currentTime стоит — повторный play() и перезагрузка источника;
 * 2. звук и currentTime идут, а кадры не показываются (totalVideoFrames
 *    не растёт) — сначала сдвиг слоя, затем перезагрузка.
 * Осознанная пауза не должна трогаться ни в одном из них.
 */
test('зависшее видео восстанавливается, пауза не трогается', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-media-'));
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

    const view = await waitForView(app);
    expect(view, 'страница сайта не появилась').toBeTruthy();

    await expect.poll(() => view.evaluate(() => typeof window.__octoMedia)).toBe('object');

    const result = await view.evaluate(() => {
      const media = window.__octoMedia;
      const realNow = Date.now;

      let clock = 10_000;
      Date.now = () => clock;

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      const rect = () => ({
        width: 320,
        height: 568,
        top: 0,
        left: 0,
        right: 320,
        bottom: 568,
        x: 0,
        y: 0,
      });

      /** Видео с полностью управляемыми часами, кадрами и паузой. */
      const makeVideo = ({ source, time, frames }) => {
        const video = document.createElement('video');
        const control = { playCalls: 0, loadCalls: 0, time, frames, paused: false };

        Object.defineProperties(video, {
          paused: { get: () => control.paused },
          ended: { get: () => false },
          currentTime: {
            get: () => control.time,
            set: (value) => {
              control.time = value;
            },
          },
          readyState: { get: () => 4 },
          networkState: { get: () => 1 },
          error: { get: () => null },
          currentSrc: { get: () => source },
        });
        video.getVideoPlaybackQuality = () => ({ totalVideoFrames: control.frames });
        video.play = () => {
          control.playCalls += 1;
          return Promise.resolve();
        };
        video.load = () => {
          control.loadCalls += 1;
        };
        video.getBoundingClientRect = rect;
        document.body.appendChild(video);
        return { video, control };
      };

      // --- 1. currentTime не двигается ------------------------------------
      const first = makeVideo({ source: 'https://example.test/first.mp4', time: 12, frames: 300 });

      media.tick(); // знакомимся с видео
      clock += 5000;
      media.tick(); // 5 с без движения → повторный play()
      const firstPlay = first.control.playCalls;

      clock += 5000;
      media.tick(); // всё ещё стоит → перезагрузка источника
      const firstLoad = first.control.loadCalls;

      first.control.paused = true;
      clock += 30_000;
      media.tick(); // пользователь нажал паузу — не трогаем
      const pausedPlay = first.control.playCalls;
      const pausedLoad = first.control.loadCalls;

      first.video.remove();
      clock += 1000;

      // --- 2. время и звук идут, а кадры не показываются -------------------
      const second = makeVideo({
        source: 'https://example.test/second.mp4',
        time: 3,
        frames: 100,
      });

      media.tick(); // новое видео, запоминаем счётчик кадров
      clock += 1000;
      second.control.time += 1;
      media.tick(); // кадров не прибавилось, но ждём полный таймаут

      clock += 3500;
      second.control.time += 1;
      media.tick(); // кадры стоят → сдвиг слоя
      const kicked = second.video.style.transform.includes('translateZ');

      clock += 3500;
      second.control.time += 1;
      media.tick(); // не помогло → перезагрузка источника
      const frameLoads = second.control.loadCalls;

      // Кадры снова пошли: сторож успокаивается и больше не вмешивается.
      second.control.frames = 140;
      clock += 1000;
      second.control.time += 1;
      media.tick();
      const frameAttempts = media.info().frameAttempts;
      const frameLoadsAfter = second.control.loadCalls;

      second.video.remove();
      Date.now = realNow;
      delete document.visibilityState;

      return {
        firstPlay,
        firstLoad,
        pausedPlay,
        pausedLoad,
        kicked,
        frameLoads,
        frameAttempts,
        frameLoadsAfter,
      };
    });

    expect(result.firstPlay).toBeGreaterThan(0);
    expect(result.firstLoad).toBeGreaterThan(0);
    expect(result.pausedPlay).toBe(result.firstPlay);
    expect(result.pausedLoad).toBe(result.firstLoad);

    expect(result.kicked).toBe(true);
    expect(result.frameLoads).toBe(1);
    expect(result.frameAttempts).toBe(0);
    expect(result.frameLoadsAfter).toBe(result.frameLoads);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/**
 * Регрессия «звук от старого видео»: TikTok после смены ролика (в том числе
 * пока окно свёрнуто в трей) иногда оставляет играть предыдущий <video>.
 * На экране новый кадр, а звучит старый. Сторож должен оставить звук только
 * у ролика на экране и возобновить именно его после возврата окна.
 */
test('звук остаётся только у ролика на экране', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-media-sole-'));
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
    const view = await waitForView(app);
    expect(view, 'страница сайта не появилась').toBeTruthy();
    await expect.poll(() => view.evaluate(() => typeof window.__octoMedia)).toBe('object');

    const result = await view.evaluate(() => {
      const media = window.__octoMedia;
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      /** Ролик с управляемой паузой; top — положение на странице. */
      const make = ({ top, paused }) => {
        const video = document.createElement('video');
        const control = { paused, pauses: 0, plays: 0 };
        Object.defineProperties(video, {
          paused: { get: () => control.paused },
          ended: { get: () => false },
          currentTime: { get: () => 10, set: () => {} },
          readyState: { get: () => 4 },
          networkState: { get: () => 1 },
          error: { get: () => null },
          currentSrc: { get: () => 'https://example.test/video.mp4' },
        });
        video.getBoundingClientRect = () => ({
          width: 320,
          height: 568,
          left: 0,
          top,
          right: 320,
          bottom: top + 568,
          x: 0,
          y: top,
        });
        video.getVideoPlaybackQuality = () => ({ totalVideoFrames: 100 });
        video.pause = () => {
          control.pauses += 1;
          control.paused = true;
        };
        video.play = () => {
          control.plays += 1;
          control.paused = false;
          return Promise.resolve();
        };
        document.body.appendChild(video);
        return { video, control };
      };

      // Два ролика играют одновременно: прошлый остался за экраном.
      const stale = make({ top: 2000, paused: false });
      const shown = make({ top: 0, paused: false });
      media.tick();
      const stalePaused = stale.control.paused;
      const shownPaused = shown.control.paused;

      // Возврат окна: на экране новый ролик стоит на паузе, старый играет.
      stale.control.paused = false;
      shown.control.paused = true;
      media.resume();
      const afterResume = {
        stalePaused: stale.control.paused,
        shownPlaying: !shown.control.paused,
      };

      stale.video.remove();
      shown.video.remove();
      delete document.visibilityState;
      return { stalePaused, shownPaused, afterResume };
    });

    expect(result.stalePaused, 'старый ролик остался со звуком').toBe(true);
    expect(result.shownPaused, 'ролик на экране не должен вставать на паузу').toBe(false);
    expect(result.afterResume.stalePaused, 'старый звук после возврата окна').toBe(true);
    expect(result.afterResume.shownPlaying, 'видимый ролик не возобновился').toBe(true);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

/**
 * Регрессия «звук идёт, картинка стоит»: сторож плеера не должен трогать
 * playbackRate, если скорость и так нужная. Запись на play и повтор через
 * 600 мс пересоздавала видео-конвейер в Chromium.
 */
test('скорость не переписывается без необходимости', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-player-'));
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

    const view = await waitForView(app);
    expect(view, 'страница сайта не появилась').toBeTruthy();
    await expect.poll(() => view.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    const result = await view.evaluate(async () => {
      const video = document.createElement('video');
      let rate = 1;
      let sets = 0;
      Object.defineProperty(video, 'playbackRate', {
        get: () => rate,
        set: (value) => {
          rate = value;
          sets += 1;
        },
      });
      document.body.append(video);

      window.__octoPlayer.update({ speed: 1, loop: false, startMuted: false });
      video.dispatchEvent(new window.Event('play'));
      await new Promise((resolve) => setTimeout(resolve, 700));
      const unchanged = sets;

      window.__octoPlayer.update({ speed: 1.5 });
      const afterChange = sets;

      window.__octoPlayer.update({ speed: 1.5 });
      video.dispatchEvent(new window.Event('play'));
      await new Promise((resolve) => setTimeout(resolve, 700));

      const final = sets;
      video.remove();
      return { unchanged, afterChange, final };
    });

    expect(result.unchanged).toBe(0);
    expect(result.afterChange).toBe(1);
    expect(result.final).toBe(1);
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
