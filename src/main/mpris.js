'use strict';

const { app } = require('electron');
const { ctx } = require('./app-context');
const playerApi = require('./player');

/**
 * MPRIS для Linux: «сейчас играет» и кнопки в GNOME/KDE/playerctl.
 *
 * Модуль полностью необязательный: без D-Bus, пакета или сессии он молча
 * выключается, приложение продолжает работать.
 */

let player = null;
let metadataTimer = null;
let metadataPending = false;
let positionTimer = null;
let positionPending = false;
let lastMeta = { title: '', artist: '', art: '', duration: 0 };
let lastPosition = 0;

const PAUSE_ALL_JS = 'document.querySelectorAll("video").forEach((video) => video.pause())';

const PLAY_ACTIVE_JS = `(() => {
  const videos = [...document.querySelectorAll('video')];
  const video =
    videos.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 120 && rect.height > 120;
    }) || videos[0];
  if (video) video.play();
})()`;

const TOGGLE_JS = `(() => {
  const videos = [...document.querySelectorAll('video')];
  if (videos.some((video) => !video.paused)) {
    videos.forEach((video) => video.pause());
    return;
  }
  const video =
    videos.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 120 && rect.height > 120;
    }) || videos[0];
  if (video) video.play();
})()`;

function contents() {
  const wc = ctx.view?.webContents;
  return wc && !wc.isDestroyed() ? wc : null;
}

function runInPage(script, userGesture = false) {
  const wc = contents();
  if (!wc) return;
  wc.executeJavaScript(script, userGesture).catch(() => {
    /* страница ещё грузится */
  });
}

function setPlaying(playing) {
  if (!player) return;
  player.playbackStatus = playing ? 'Playing' : 'Paused';
}

/** Заголовок страницы доступен без executeJavaScript — обновляемся им. */
function setTitle(title) {
  const value = (title || '').replace(/\s+/g, ' ').trim();
  if (!value) return;

  // Не затираем уже полученное описание видео общим заголовком страницы.
  if (lastMeta.title && lastMeta.title !== 'TikTok' && lastMeta.title !== 'about:blank') return;

  const wc = contents();
  publishMetadata(value, lastMeta.artist || 'TikTok', wc?.getURL() || '');
}

function navigate(direction) {
  const wc = contents();
  if (!wc) return;

  const selector =
    direction === 'next'
      ? '[data-e2e="feed-navigation-next"]'
      : '[data-e2e="feed-navigation-prev"]';

  wc.executeJavaScript(
    `(() => {
       const button = document.querySelector('${selector}');
       if (!button) return false;
       button.click();
       return true;
     })()`,
    true,
  )
    .then((clicked) => {
      if (clicked) return;
      // Запасной путь: у ленты работают стрелки.
      const keyCode = direction === 'next' ? 'ArrowDown' : 'ArrowUp';
      wc.sendInputEvent({ type: 'keyDown', keyCode });
      wc.sendInputEvent({ type: 'keyUp', keyCode });
    })
    .catch(() => {});
}

function publishMetadata(title, artist, url, art = '', duration = 0) {
  if (!player) return;
  const safeTitle = (title || 'TikTok').replace(/\s+/g, ' ').slice(0, 140);
  const safeArtist = (artist || 'TikTok').replace(/\s+/g, ' ').slice(0, 70);
  const safeArt = typeof art === 'string' && /^https?:\/\//i.test(art) ? art.slice(0, 1000) : '';
  const durationValue = Number(duration);
  const safeDuration = Number.isFinite(durationValue) && durationValue > 0 ? durationValue : 0;
  if (
    safeTitle === lastMeta.title &&
    safeArtist === lastMeta.artist &&
    safeArt === lastMeta.art &&
    safeDuration === lastMeta.duration
  ) {
    return;
  }
  lastMeta = { title: safeTitle, artist: safeArtist, art: safeArt, duration: safeDuration };

  try {
    player.metadata = {
      'mpris:trackid': '/com/octo/tiktok/current',
      'xesam:title': safeTitle,
      'xesam:artist': [safeArtist],
      'xesam:url': url || '',
      ...(safeArt ? { 'mpris:artUrl': safeArt } : {}),
      ...(safeDuration ? { 'mpris:length': Math.round(safeDuration * 1e6) } : {}),
    };
  } catch (err) {
    console.warn('[octo] MPRIS metadata failed:', err.message);
  }
}

/** Перемотка по запросу MPRIS: секунды, не микросекунды. */
function seekTo(seconds) {
  const wc = contents();
  const num = Number(seconds);
  const target = Number.isFinite(num) ? Math.max(0, num) : 0;
  if (!wc || wc.isDestroyed()) return;
  lastPosition = target;
  runInPage(
    `(() => {
      const videos = [...document.querySelectorAll('video')];
      const video =
        videos.find((item) => {
          const rect = item.getBoundingClientRect();
          return rect.width > 120 && rect.height > 120;
        }) || videos[0];
      if (!video) return;
      try {
        const limit = Number.isFinite(video.duration) ? video.duration : ${target};
        video.currentTime = Math.min(limit, ${target});
      } catch (err) {
        /* видео не допускает перемотку */
      }
    })()`,
    true,
  );
  if (player) player.seeked(Math.round(target * 1e6));
}

const INVISIBLE = /[\u200B-\u200F\uFEFF]/g;

function cleanArtist(value) {
  const line =
    (value || '')
      .replace(INVISIBLE, '')
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) || '';
  return line
    .replace(/(?:Подписаться|Follow)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(value, artist) {
  let title = (value || '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  title = title.replace(/\s*(?:Подписаться|Follow)\s*$/i, '').trim();

  // Иногда в fallback-слое описание идёт вместе с автором и кнопкой подписки.
  if (artist && title.toLowerCase().startsWith(artist.toLowerCase())) {
    title = title
      .slice(artist.length)
      .replace(/^\s*(?:Подписаться|Follow)?\s*/i, '')
      .trim();
  }
  return title;
}

async function refreshMetadata() {
  const wc = contents();
  if (!wc || !player || metadataPending) return;

  // executeJavaScript во время навигации копит слушатели did-stop-loading
  // внутри Electron — во время загрузки просто пропускаем опрос.
  if (wc.isLoading()) {
    scheduleMetadata(1500);
    return;
  }

  metadataPending = true;
  try {
    // Сначала публикуем хотя бы заголовок страницы — «сейчас играет» должно
    // существовать даже если DOM ещё не отдал описание видео.
    const fallback = wc.getTitle() || 'TikTok';
    publishMetadata(fallback, 'TikTok', wc.getURL());

    const info = await wc.executeJavaScript(`(() => {
      const videos = [...document.querySelectorAll('video')];
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 120 && rect.height > 120;
      };
      const video = videos.find((el) => visible(el) && !el.paused) || videos.find(visible);
      const scope =
        video?.closest('[data-e2e="recommend-list-item-container"]') ||
        video?.closest('article') ||
        document;

      const pick = (selectors) => {
        for (const selector of selectors) {
          const el = scope.querySelector(selector);
          const text = el && (el.innerText || '').trim();
          if (text) return text;
        }
        return '';
      };

      const authorLink = [...scope.querySelectorAll('a[href^="/@"]')].find(
        (el) => (el.innerText || '').trim().length > 0,
      );

      return {
        art:
          (video && video.poster) ||
          (document.querySelector('meta[property="og:image"]')?.content || ''),
        time: video ? Number(video.currentTime) || 0 : 0,
        duration: video ? Number(video.duration) || 0 : 0,
        title: pick([
          '[data-e2e="video-desc"]',
          '[data-e2e="anchoring-description-layer"]',
          '[data-e2e="browse-video-desc"]',
        ]),
        artist:
          pick(['[data-e2e="browse-username"]', '[data-e2e="cinema-creator-identity"]']) ||
          (authorLink ? authorLink.innerText : ''),
      };
    })()`);

    const artist = cleanArtist(info.artist) || 'TikTok';
    const title = cleanTitle(info.title || fallback, artist === 'TikTok' ? '' : artist) || fallback;

    lastPosition = Number(info.time) || 0;
    publishMetadata(title, artist, wc.getURL(), info.art, info.duration);
  } catch {
    /* DOM ещё не готов */
  } finally {
    metadataPending = false;
  }
}

function scheduleMetadata(delay = 800) {
  if (!player) return;
  clearTimeout(metadataTimer);
  metadataTimer = setTimeout(() => {
    refreshMetadata();
  }, delay);
}

function initMpris() {
  if (process.platform !== 'linux' || process.env.OCTO_E2E) return;
  if (!process.env.DBUS_SESSION_BUS_ADDRESS) return;

  let Player;
  try {
    Player = require('mpris-service');
  } catch (err) {
    console.warn('[octo] MPRIS package unavailable:', err.message);
    return;
  }

  try {
    player = Player({
      name: 'tiktok_octo',
      identity: 'TikTok octo',
      supportedUriSchemes: [],
      supportedMimeTypes: [],
    });
  } catch (err) {
    console.warn('[octo] MPRIS unavailable:', err.message);
    player = null;
    return;
  }

  player.canQuit = true;
  player.canRaise = true;
  player.canPlay = true;
  player.canPause = true;
  player.canGoNext = true;
  player.canGoPrevious = true;
  player.canSeek = true;
  player.playbackStatus = 'Paused';
  player.getPosition = () => Math.round(lastPosition * 1e6);

  // MPRIS читает Position по запросу, а metadata обновляется только по
  // событиям. Без опроса виджет показывает 0:00 до следующего ролика.
  positionTimer = setInterval(() => {
    if (positionPending || !ctx.playing) return;
    const currentWc = contents();
    if (!currentWc || currentWc.isLoading()) return;
    positionPending = true;
    playerApi
      .status()
      .then((info) => {
        const time = Number(info?.time);
        if (Number.isFinite(time)) lastPosition = Math.max(0, time);
      })
      .catch(() => {})
      .finally(() => {
        positionPending = false;
      });
  }, 1000);
  if (typeof positionTimer.unref === 'function') positionTimer.unref();

  // Метаданные должны существовать сразу, даже если DOM ещё грузится:
  // иначе клиенты (playerctl, GNOME) считают плеер «без трека».
  const wc = contents();
  publishMetadata(wc?.getTitle() || 'TikTok', 'TikTok', wc?.getURL() || '');

  player.on('play', () => runInPage(PLAY_ACTIVE_JS, true));
  player.on('pause', () => runInPage(PAUSE_ALL_JS));
  player.on('playpause', () => runInPage(TOGGLE_JS, true));
  player.on('stop', () => {
    runInPage(PAUSE_ALL_JS);
    setPlaying(false);
  });
  player.on('next', () => navigate('next'));
  player.on('previous', () => navigate('prev'));
  player.on('seek', (offset) => seekTo(lastPosition + Number(offset || 0) / 1e6));
  player.on('position', (event) => {
    if (!event || event.trackId !== '/com/octo/tiktok/current') return;
    seekTo(Number(event.position || 0) / 1e6);
  });

  player.on('raise', () => {
    if (!ctx.win) return;
    ctx.win.show();
    ctx.win.focus();
  });

  player.on('quit', () => {
    ctx.quitting = true;
    app.quit();
  });

  scheduleMetadata(1200);
}

function isActive() {
  return Boolean(player);
}

module.exports = { initMpris, setPlaying, setTitle, scheduleMetadata, isActive };
