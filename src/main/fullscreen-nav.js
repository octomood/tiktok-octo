'use strict';

const { ipcMain } = require('electron');
const { ctx, layout, pushState } = require('./app-context');
const { evalInPage } = require('./page-eval');
const i18n = require('./i18n');

/**
 * Переключение видео внутри полноэкранного режима сайта (HTML5 fullscreen).
 *
 * Когда пользователь открывает широкий ролик на весь экран, сайт помещает в
 * :fullscreen только обёртку одного плеера. Из-за этого колёсико, стрелки и
 * кнопки «следующее/предыдущее» не работают или сбрасывают полный экран на
 * каждом ролике. Модуль перехватывает переключение, перелистывает ленту и
 * переносит :fullscreen на новый плеер без выхода из полноэкранного режима.
 */

const SWITCH_GRACE_MS = 2600;
const LEAVE_GRACE_MS = 1300;
const REENTER_STEP_MS = 120;

let switchingUntil = 0;
let leaveTimer = null;
let reenterTimer = null;

function contents() {
  const wc = ctx.view?.webContents;
  return wc && !wc.isDestroyed() ? wc : null;
}

function labels() {
  return {
    prev: i18n.t('Предыдущее видео'),
    next: i18n.t('Следующее видео'),
  };
}

/** Выполнить скрипт с пользовательским жестом для Element.requestFullscreen(). */
function runWithGesture(wc, script) {
  if (!wc || wc.isDestroyed()) return;
  if (!wc.isLoading()) {
    wc.executeJavaScript(script, true).catch(() => {
      /* страница уже ушла */
    });
    return;
  }
  evalInPage(wc, [script]);
}

function clearTimers() {
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
  if (reenterTimer) {
    clearInterval(reenterTimer);
    reenterTimer = null;
  }
}

function cancelSwitch() {
  const wasGrace = Boolean(leaveTimer);
  switchingUntil = 0;
  clearTimers();
  const wc = contents();
  if (wc) {
    evalInPage(wc, ['window.__octoFullscreenNav && window.__octoFullscreenNav.cancel()']);
  }
  if (wasGrace && ctx.htmlFullscreen) {
    ctx.htmlFullscreen = false;
    layout();
    pushState();
  }
}

function isSwitching() {
  if (ctx.pipActive || ctx.ambient) return false;
  return Date.now() < switchingUntil;
}

function markSwitching(duration = SWITCH_GRACE_MS) {
  switchingUntil = Date.now() + duration;
}

function pageScript(textLabels) {
  return `(() => {
    const LABELS = ${JSON.stringify(textLabels)};
    if (window.__octoFullscreenNav) {
      window.__octoFullscreenNav.updateLabels(LABELS);
      window.__octoFullscreenNav.sync();
      return 0;
    }

    const NAV_ID = 'octo-fs-nav';
    const PREV_ID = 'octo-fs-prev';
    const NEXT_ID = 'octo-fs-next';
    const STYLE_ID = 'octo-fs-nav-style';
    const ITEM_SELECTOR = [
      '[data-e2e="recommend-list-item-container"]',
      '[data-e2e="feed-item"]',
      '[data-e2e="browse-video"]',
      '[class*="DivItemContainerV2"]',
      'article',
    ].join(', ');
    const HOST_SELECTOR = [
      '[class*="DivBasicPlayerWrapper"]',
      '[class*="DivVideoWrapper"]',
      '[data-e2e="feed-video"]',
      '[data-e2e="browse-video"]',
      '[class*="PlayerWrapper"]',
    ].join(', ');

    const state = {
      labels: LABELS,
      pending: null,
      lastNavAt: 0,
      hideTimer: null,
      watchTimer: null,
      followTimer: null,
      observer: null,
      hovering: false,
      boundFsEl: null,
    };

    const ensureStyle = () => {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = \`
        #\${NAV_ID} {
          position: fixed !important;
          inset-inline-end: 20px !important;
          top: 50% !important;
          transform: translateY(-50%) translateX(6px) !important;
          z-index: 2147483647 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          background: transparent !important;
          opacity: 0 !important;
          pointer-events: none !important;
          transition:
            opacity 180ms cubic-bezier(0.2, 0, 0, 1),
            transform 220ms cubic-bezier(0.2, 0, 0, 1) !important;
        }
        #\${NAV_ID}[data-visible="true"],
        #\${NAV_ID}:hover,
        #\${NAV_ID}:focus-within {
          opacity: 1 !important;
          pointer-events: auto !important;
          transform: translateY(-50%) translateX(0) !important;
        }
        #\${NAV_ID} button {
          all: unset !important;
          box-sizing: border-box !important;
          width: 44px !important;
          height: 44px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          color: var(--octo-md-on-surface, #f3edf7) !important;
          background: color-mix(in srgb, var(--octo-md-surface-container-high, #2b2738) 86%, transparent) !important;
          box-shadow:
            0 4px 16px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant, rgba(255, 255, 255, 0.22)) 60%, transparent) !important;
          backdrop-filter: blur(10px) !important;
          transition:
            background-color 150ms cubic-bezier(0.2, 0, 0, 1),
            border-radius 180ms cubic-bezier(0.2, 0, 0, 1),
            transform 140ms cubic-bezier(0.2, 0, 0, 1) !important;
        }
        #\${PREV_ID} {
          border-radius: 22px 22px 6px 6px !important;
        }
        #\${NEXT_ID} {
          border-radius: 6px 6px 22px 22px !important;
        }
        #\${NAV_ID} button:hover {
          background: var(--octo-md-secondary-container, rgba(208, 188, 255, 0.28)) !important;
          color: var(--octo-md-on-secondary-container, #ffffff) !important;
        }
        #\${PREV_ID}:hover {
          border-radius: 22px 22px 12px 12px !important;
        }
        #\${NEXT_ID}:hover {
          border-radius: 12px 12px 22px 22px !important;
        }
        #\${NAV_ID} button:active {
          transform: scale(0.94) !important;
        }
        #\${NAV_ID} button:focus-visible {
          outline: 2px solid var(--octo-md-primary, #d0bcff) !important;
          outline-offset: 2px !important;
        }
        #\${NAV_ID} svg {
          width: 22px !important;
          height: 22px !important;
          display: block !important;
          pointer-events: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          #\${NAV_ID},
          #\${NAV_ID} button {
            transition: none !important;
          }
        }
      \`;
      (document.head || document.documentElement).appendChild(style);
    };

    const createIcon = (up) => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 20 20');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.9');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', up ? 'M5 12.5 10 7.5l5 5' : 'M5 7.5 10 12.5l5-5');
      svg.appendChild(path);
      return svg;
    };

    const stopBubble = (event) => {
      event.stopPropagation();
    };

    const applyButtonLabels = (nav) => {
      const prevBtn = nav.querySelector('#' + PREV_ID);
      const nextBtn = nav.querySelector('#' + NEXT_ID);
      if (prevBtn) {
        prevBtn.setAttribute('aria-label', state.labels.prev);
        prevBtn.setAttribute('title', state.labels.prev + ' (↑)');
      }
      if (nextBtn) {
        nextBtn.setAttribute('aria-label', state.labels.next);
        nextBtn.setAttribute('title', state.labels.next + ' (↓)');
      }
    };

    const showNavTemporarily = () => {
      const nav = document.getElementById(NAV_ID);
      if (!nav) return;
      nav.setAttribute('data-visible', 'true');
      clearTimeout(state.hideTimer);
      state.hideTimer = setTimeout(() => {
        if (!state.hovering) nav.removeAttribute('data-visible');
      }, 2200);
    };

    const ensureNav = () => {
      let nav = document.getElementById(NAV_ID);
      if (nav) {
        applyButtonLabels(nav);
        return nav;
      }

      nav = document.createElement('div');
      nav.id = NAV_ID;
      nav.setAttribute('role', 'group');

      const prevBtn = document.createElement('button');
      prevBtn.id = PREV_ID;
      prevBtn.type = 'button';
      prevBtn.appendChild(createIcon(true));

      const nextBtn = document.createElement('button');
      nextBtn.id = NEXT_ID;
      nextBtn.type = 'button';
      nextBtn.appendChild(createIcon(false));

      for (const evt of ['pointerdown', 'mousedown', 'mouseup', 'dblclick']) {
        nav.addEventListener(evt, stopBubble);
      }

      nav.addEventListener('mouseenter', () => {
        state.hovering = true;
        clearTimeout(state.hideTimer);
        nav.setAttribute('data-visible', 'true');
      });
      nav.addEventListener('mouseleave', () => {
        state.hovering = false;
        showNavTemporarily();
      });
      nav.addEventListener('focusin', () => {
        state.hovering = true;
        clearTimeout(state.hideTimer);
        nav.setAttribute('data-visible', 'true');
      });
      nav.addEventListener('focusout', () => {
        state.hovering = false;
        showNavTemporarily();
      });

      prevBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.detail > 0) prevBtn.blur();
        navigate('prev');
      });
      nextBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.detail > 0) nextBtn.blur();
        navigate('next');
      });

      nav.append(prevBtn, nextBtn);
      applyButtonLabels(nav);
      return nav;
    };

    const removeNav = () => {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
      state.hovering = false;
      const nav = document.getElementById(NAV_ID);
      if (nav) nav.remove();
    };

    const videos = () => [...document.querySelectorAll('video')];

    const videoSource = (video) => {
      if (!video) return '';
      return video.currentSrc || video.getAttribute('src') || video.src || '';
    };

    const isCentered = (el) => {
      if (!el || !el.isConnected) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return false;
      const midY = rect.top + rect.height / 2;
      return midY >= 0 && midY <= innerHeight && rect.bottom > 40 && rect.top < innerHeight - 40;
    };

    const findVideoIn = (root) => {
      if (!root) return null;
      if (root.tagName === 'VIDEO') return root;
      return root.querySelector('video');
    };

    const activeVideo = () => {
      const list = videos().filter((video) => video.isConnected);
      return (
        list.find((video) => !video.paused && isCentered(video)) ||
        list.find((video) => isCentered(video)) ||
        list.find((video) => !video.paused) ||
        list[0] ||
        null
      );
    };

    const feedItems = () =>
      [...document.querySelectorAll(ITEM_SELECTOR)].filter((el) => el.querySelector('video'));

    const itemOf = (el) => {
      if (!el || typeof el.closest !== 'function') return null;
      return el.closest(ITEM_SELECTOR);
    };

    const detectFsKind = (el) => {
      if (!el) return 'wrapper';
      if (el.tagName === 'VIDEO') return 'video';
      if (typeof el.matches === 'function') {
        if (el.matches('[class*="DivBasicPlayerWrapper"]')) return 'basic-player';
        if (el.matches('[class*="DivVideoWrapper"]')) return 'video-wrapper';
        if (el.matches('[data-e2e="feed-video"]')) return 'feed-video';
        if (el.matches('[data-e2e="browse-video"]')) return 'browse-video';
      }
      return 'wrapper';
    };

    const resolveHost = (video, kind) => {
      if (!video) return null;
      if (kind === 'video') return video;
      const byKind = {
        'basic-player': '[class*="DivBasicPlayerWrapper"]',
        'video-wrapper': '[class*="DivVideoWrapper"]',
        'feed-video': '[data-e2e="feed-video"]',
        'browse-video': '[data-e2e="browse-video"]',
      };
      if (byKind[kind]) {
        const matched = video.closest(byKind[kind]);
        if (matched) return matched;
      }
      return video.closest(HOST_SELECTOR) || video.parentElement || video;
    };

    const findNavButton = (direction, fsEl) => {
      const next = direction === 'next';
      const selectors = next
        ? ['[data-e2e="feed-navigation-next"]', '[data-e2e="arrow-down"]', '[data-e2e="arrow-right"]']
        : ['[data-e2e="feed-navigation-prev"]', '[data-e2e="arrow-up"]', '[data-e2e="arrow-left"]'];

      for (const selector of selectors) {
        const candidates = document.querySelectorAll(selector);
        for (const el of candidates) {
          if (el.id && el.id.startsWith('octo-')) continue;
          if (fsEl && fsEl.contains(el)) continue;
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
          if (
            (selector.includes('arrow-right') || selector.includes('arrow-left')) &&
            el.closest('[class*="DivBasicPlayerWrapper"], [class*="DivVideoWrapper"]')
          ) {
            continue;
          }
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          return el;
        }
      }
      return null;
    };

    const mountNav = (fsEl) => {
      if (!fsEl || !fsEl.isConnected || fsEl.tagName === 'VIDEO') {
        removeNav();
        return;
      }
      ensureStyle();
      const nav = ensureNav();
      if (nav.parentNode !== fsEl) fsEl.appendChild(nav);
    };

    const stopWatchers = () => {
      clearInterval(state.watchTimer);
      state.watchTimer = null;
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
    };

    const clearPending = () => {
      state.pending = null;
      state.lastNavAt = 0;
      stopWatchers();
    };

    const requestHostFullscreen = (host) => {
      if (!host || !host.isConnected || typeof host.requestFullscreen !== 'function') {
        return Promise.resolve(false);
      }
      if (document.fullscreenElement === host) {
        mountNav(host);
        showNavTemporarily();
        return Promise.resolve(true);
      }
      try {
        const result = host.requestFullscreen();
        if (result && typeof result.then === 'function') {
          return result
            .then(() => {
              mountNav(host);
              showNavTemporarily();
              return true;
            })
            .catch(() => false);
        }
        mountNav(host);
        showNavTemporarily();
        return Promise.resolve(true);
      } catch (err) {
        return Promise.resolve(false);
      }
    };

    const pickNextVideo = (pending) => {
      const list = videos().filter((video) => video.isConnected);
      const prev = pending.prevVideo;

      // В модальном просмотре сайт иногда меняет src у того же <video>.
      if (prev && prev.isConnected) {
        const currentSrc = videoSource(prev);
        if (currentSrc && pending.prevSrc && currentSrc !== pending.prevSrc) {
          return { video: prev, sameElement: true };
        }
      }

      // 1. Новое видео уже заиграло (не тихая фоновая предзагрузка).
      const playing = list.find(
        (video) => video !== prev && !video.paused && (!video.muted || isCentered(video)),
      );
      if (playing) return { video: playing, sameElement: false };

      // 2. Ожидаемый элемент ленты уже в центре или старое видео остановилось/ушло.
      let targetItem = pending.targetItem;
      if (!targetItem || !targetItem.isConnected) {
        const items = feedItems();
        const prevIdx = pending.prevItem ? items.indexOf(pending.prevItem) : -1;
        if (prevIdx >= 0) {
          targetItem = items[prevIdx + (pending.direction === 'next' ? 1 : -1)] || null;
          pending.targetItem = targetItem;
        }
      }
      if (targetItem && targetItem.isConnected) {
        const candidate = findVideoIn(targetItem);
        const prevStopped = !prev || !prev.isConnected || prev.paused || !isCentered(prev);
        if (
          candidate &&
          candidate !== prev &&
          (prevStopped || isCentered(targetItem) || Date.now() - pending.startedAt >= 160)
        ) {
          return { video: candidate, sameElement: false };
        }
      }

      // 3. Любое новое видео в центре экрана, если прежнее уже ушло/на паузе.
      const prevGone = !prev || !prev.isConnected || prev.paused || !isCentered(prev);
      if (prevGone) {
        let best = null;
        let bestDist = Infinity;
        for (const video of list) {
          if (video === prev) continue;
          const rect = video.getBoundingClientRect();
          if (rect.width < 40 || rect.height < 40) continue;
          const dist = Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
          if (dist < bestDist && rect.bottom > 40 && rect.top < innerHeight - 40) {
            best = video;
            bestDist = dist;
          }
        }
        if (best) return { video: best, sameElement: false };
      }

      return null;
    };

    const tryFinishSwitch = () => {
      const pending = state.pending;
      if (!pending) return false;
      if (Date.now() > pending.expiresAt) {
        clearPending();
        return false;
      }

      const found = pickNextVideo(pending);
      if (!found || !found.video) return false;

      const nextVideo = found.video;
      if (!found.sameElement && pending.prevVideo && pending.prevVideo.isConnected) {
        try {
          if (!pending.prevVideo.paused) pending.prevVideo.pause();
        } catch (err) {
          /* элемент уже выгружен */
        }
      }

      if (nextVideo.paused) {
        nextVideo.play().catch(() => {});
      }

      const host = found.sameElement
        ? document.fullscreenElement || resolveHost(nextVideo, pending.fsKind)
        : resolveHost(nextVideo, pending.fsKind);

      if (!host) return false;

      if (document.fullscreenElement === host) {
        clearPending();
        mountNav(host);
        showNavTemporarily();
        return true;
      }

      requestHostFullscreen(host).then((ok) => {
        if (ok && state.pending === pending) {
          clearPending();
        }
      });
      return true;
    };

    const startWatchers = () => {
      stopWatchers();
      state.watchTimer = setInterval(() => {
        if (!state.pending) {
          stopWatchers();
          return;
        }
        tryFinishSwitch();
      }, 80);

      if (document.body) {
        state.observer = new MutationObserver(() => {
          if (state.pending) tryFinishSwitch();
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    const navigate = (direction) => {
      const next = direction !== 'prev';
      const dir = next ? 'next' : 'prev';
      const now = Date.now();
      if (state.pending && now - state.lastNavAt < 80) return false;

      const fsEl = document.fullscreenElement;
      if (!fsEl && !state.pending) return false;
      state.lastNavAt = now;

      const baseEl = state.pending?.targetItem || fsEl;
      const prevVideo =
        (state.pending?.targetItem && findVideoIn(state.pending.targetItem)) ||
        findVideoIn(fsEl) ||
        activeVideo();
      const prevItem = itemOf(baseEl || prevVideo);
      const items = feedItems();
      const idx = prevItem ? items.indexOf(prevItem) : -1;
      const targetItem = idx >= 0 ? items[idx + (next ? 1 : -1)] || null : null;

      state.pending = {
        direction: dir,
        fsKind: fsEl ? detectFsKind(fsEl) : state.pending?.fsKind || 'wrapper',
        prevFsEl: fsEl || state.pending?.prevFsEl || null,
        prevVideo,
        prevSrc: videoSource(prevVideo),
        prevItem,
        targetItem,
        startedAt: now,
        expiresAt: now + ${SWITCH_GRACE_MS},
        scrolled: false,
      };

      const button = findNavButton(dir, fsEl);
      if (button) {
        button.click();
      } else {
        const key = next ? 'ArrowDown' : 'ArrowUp';
        const code = next ? 40 : 38;
        for (const target of [document, window]) {
          target.dispatchEvent(
            new KeyboardEvent('keydown', {
              key,
              code: key,
              keyCode: code,
              which: code,
              bubbles: true,
              cancelable: true,
            }),
          );
        }
        if (targetItem) {
          const expected = state.pending;
          setTimeout(() => {
            if (state.pending !== expected || expected.scrolled) return;
            if (!targetItem.isConnected) return;
            const current = findVideoIn(targetItem);
            if (!current || current.paused || !isCentered(targetItem)) {
              expected.scrolled = true;
              targetItem.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
          }, 90);
        }
      }

      startWatchers();
      setTimeout(() => {
        if (state.pending) tryFinishSwitch();
      }, 60);
      return true;
    };

    const autoFollow = () => {
      const fsEl = document.fullscreenElement;
      if (!fsEl || state.pending) return;
      const curVideo = findVideoIn(fsEl);
      if (!curVideo || (!curVideo.paused && !curVideo.ended)) return;
      if (isCentered(curVideo)) return;

      const playing = videos().find(
        (video) =>
          video !== curVideo &&
          video.isConnected &&
          !video.paused &&
          !video.ended &&
          (!video.muted || isCentered(video)),
      );
      if (!playing) return;

      const host = resolveHost(playing, detectFsKind(fsEl));
      if (host && host !== fsEl) {
        requestHostFullscreen(host);
      }
    };

    const onPointerMove = () => {
      if (document.fullscreenElement) showNavTemporarily();
    };

    const bindFullscreenElement = (fsEl) => {
      if (state.boundFsEl && state.boundFsEl !== fsEl) {
        state.boundFsEl.removeEventListener('mousemove', onPointerMove);
        state.boundFsEl.removeEventListener('pointermove', onPointerMove);
        state.boundFsEl = null;
      }
      if (fsEl && state.boundFsEl !== fsEl) {
        fsEl.addEventListener('mousemove', onPointerMove, { passive: true });
        fsEl.addEventListener('pointermove', onPointerMove, { passive: true });
        state.boundFsEl = fsEl;
      }
    };

    const sync = () => {
      const fsEl = document.fullscreenElement;
      bindFullscreenElement(fsEl);
      if (fsEl) {
        mountNav(fsEl);
        showNavTemporarily();
        if (!state.followTimer) {
          state.followTimer = setInterval(autoFollow, 600);
        }
      } else {
        removeNav();
        clearInterval(state.followTimer);
        state.followTimer = null;
      }
    };

    const onVideoPlay = () => {
      if (state.pending) tryFinishSwitch();
    };

    document.addEventListener('fullscreenchange', sync, true);
    document.addEventListener('play', onVideoPlay, true);
    document.addEventListener('playing', onVideoPlay, true);
    document.addEventListener('loadeddata', onVideoPlay, true);

    window.__octoFullscreenNav = {
      updateLabels(nextLabels) {
        if (nextLabels && typeof nextLabels === 'object') {
          state.labels = { ...state.labels, ...nextLabels };
        }
      },
      sync,
      navigate,
      next: () => navigate('next'),
      prev: () => navigate('prev'),
      reenter: () => tryFinishSwitch(),
      cancel: () => {
        clearPending();
        sync();
      },
    };

    sync();
    return 1;
  })()`;
}

function apply() {
  const wc = contents();
  if (!wc) return;
  evalInPage(wc, [pageScript(labels())]);
}

function navigate(direction) {
  const wc = contents();
  if (!wc || ctx.pipActive || ctx.ambient) return false;
  const dir = direction === 'prev' ? 'prev' : 'next';
  markSwitching();
  runWithGesture(
    wc,
    `${pageScript(labels())}; window.__octoFullscreenNav && window.__octoFullscreenNav.navigate('${dir}')`,
  );
  return true;
}

function next() {
  return navigate('next');
}

function prev() {
  return navigate('prev');
}

function onEnterFullscreen() {
  clearTimers();
  switchingUntil = 0;
  apply();
}

/**
 * Если во время переключения сайт удалил старый контейнер из DOM, Chromium
 * кратковременно сбрасывает HTML-fullscreen. Удерживаем состояние оболочки и
 * дожимаем повторный вход на новый ролик с пользовательским жестом.
 */
function onLeaveFullscreen() {
  if (!isSwitching()) {
    clearTimers();
    const wc = contents();
    if (wc) evalInPage(wc, ['window.__octoFullscreenNav && window.__octoFullscreenNav.sync()']);
    return false;
  }

  if (leaveTimer) return true;
  const wc = contents();
  if (!wc) {
    switchingUntil = 0;
    return false;
  }

  reenterTimer = setInterval(() => {
    const targetWc = contents();
    if (!targetWc || !isSwitching()) {
      clearInterval(reenterTimer);
      reenterTimer = null;
      return;
    }
    runWithGesture(targetWc, 'window.__octoFullscreenNav && window.__octoFullscreenNav.reenter()');
  }, REENTER_STEP_MS);

  leaveTimer = setTimeout(() => {
    leaveTimer = null;
    clearInterval(reenterTimer);
    reenterTimer = null;
    switchingUntil = 0;
    if (ctx.htmlFullscreen) {
      ctx.htmlFullscreen = false;
      layout();
      pushState();
    }
  }, LEAVE_GRACE_MS);

  return true;
}

function syncLabels() {
  const wc = contents();
  if (!wc) return;
  evalInPage(wc, [
    `window.__octoFullscreenNav && window.__octoFullscreenNav.updateLabels(${JSON.stringify(labels())})`,
  ]);
}

function install() {
  ipcMain.on('octo:fullscreen-nav', (event, direction) => {
    const wc = contents();
    if (!wc || event.sender !== wc) return;
    if (ctx.pipActive || ctx.ambient) return;
    navigate(direction === 'prev' ? 'prev' : 'next');
  });

  ipcMain.on('octo:fullscreen-switching', (event) => {
    const wc = contents();
    if (!wc || event.sender !== wc) return;
    if (ctx.pipActive || ctx.ambient) return;
    markSwitching();
  });
}

install();

module.exports = {
  apply,
  next,
  prev,
  syncLabels,
  onEnterFullscreen,
  onLeaveFullscreen,
  cancelSwitch,
  isSwitching,
};
