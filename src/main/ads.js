'use strict';

const { ctx, pushState } = require('./app-context');
const { readState, writeState } = require('./store');
const { evalInPage } = require('./page-eval');

/**
 * Пропуск рекламы в ленте.
 *
 * Сайт не отдаёт признак «это реклама» в удобном виде, поэтому ищем метку
 * («Реклама», «Sponsored», data-e2e-атрибуты) в видимой части страницы и
 * перелистываем ленту на следующее видео. Всё выполняется в контексте
 * страницы, трафик и запросы не трогаем.
 *
 * По умолчанию выключено: автопрокрутка меняет поведение ленты, поэтому
 * решение остаётся за пользователем.
 */

const MARK = 'data-octo-ad-skip';

const PAGE_SCRIPT = `(() => {
  const MARK = '${MARK}';
  if (window.__octoAds) {
    window.__octoAds.start();
    return 0;
  }

  const LABELS = [
    'Реклама',
    'реклама',
    'Спонсор',
    'спонсор',
    'Промо',
    'промо',
    'Sponsored',
    'sponsored',
    'Promoted',
    'promoted',
    'Advertisement',
  ];

  const SKIP_TEXT = /^(?:пропустить(?: рекламу)?|skip(?: ad)?)(?:\\s*[›>»])?$/i;

  const NOTICE_ID = 'octo-ad-notice';
  const NOTICE_TEXT = 'Реклама пропущена';
  const noticed = new WeakSet();
  let noticeTimer = null;
  let noticeHideTimer = null;

  /** Короткая плашка поверх страницы (и поверх сцены PiP). */
  function showNotice() {
    if (!document.documentElement) return;

    let node = document.getElementById(NOTICE_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = NOTICE_ID;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      const set = (name, value) => node.style.setProperty(name, value, 'important');
      set('position', 'fixed');
      set('top', '24px');
      set('left', '50%');
      set('transform', 'translate(-50%, -8px)');
      set('z-index', '2147483647');
      set('padding', '10px 18px');
      set('border-radius', '999px');
      set('background', 'rgba(24, 24, 27, 0.92)');
      set('color', '#ffffff');
      set(
        'font',
        '500 14px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      );
      set('letter-spacing', '0.01em');
      set('white-space', 'nowrap');
      set('box-shadow', '0 8px 24px rgba(0, 0, 0, 0.35)');
      set('opacity', '0');
      set('pointer-events', 'none');
      set('transition', 'opacity 0.16s ease, transform 0.16s ease');
    }

    // Сцена PiP создаётся позже с тем же z-index — переносим плашку в конец,
    // чтобы она оказалась выше неё.
    document.documentElement.appendChild(node);
    node.textContent = NOTICE_TEXT;

    clearTimeout(noticeTimer);
    clearTimeout(noticeHideTimer);

    requestAnimationFrame(() => {
      node.style.setProperty('opacity', '1', 'important');
      node.style.setProperty('transform', 'translate(-50%, 0)', 'important');
    });

    noticeTimer = setTimeout(() => {
      node.style.setProperty('opacity', '0', 'important');
      node.style.setProperty('transform', 'translate(-50%, -8px)', 'important');
      noticeHideTimer = setTimeout(() => node.remove(), 240);
    }, 1100);
  }

  // Явные маркеры сайта: им можно доверять без дополнительных проверок.
  const AD_SELECTOR = [
    '[data-e2e="ad-label"]',
    '[data-e2e*="ad-label"]',
    '[data-e2e*="sponsored"]',
    '[data-e2e="video-ad-label"]',
    '[data-e2e="ad-badge"]',
    '[class*="AdLabel"]',
    '[class*="Sponsored"]',
  ].join(',');

  let running = true;
  let timer = null;
  let lastSkip = 0;
  const attempts = new WeakMap();

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) {
      return false;
    }
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };

  /** Контейнер ленты, в котором лежит метка. */
  function feedItem(node) {
    let el = node;
    for (let depth = 0; depth < 14 && el; depth += 1) {
      if (
        el.matches &&
        el.matches(
          '[data-e2e="recommend-list-item-container"], [data-e2e="browse-video"], [data-e2e="feed-item"], article',
        )
      ) {
        return el;
      }
      el = el.parentElement;
    }

    // Запасной вариант: ближайший предок с крупным видимым видео.
    el = node.parentElement;
    for (let depth = 0; depth < 8 && el; depth += 1) {
      const video = el.querySelector && el.querySelector('video');
      if (video) {
        const rect = video.getBoundingClientRect();
        if (rect.width >= 240 && rect.height >= 240) return el;
      }
      el = el.parentElement;
    }

    return null;
  }

  function fromSelector() {
    for (const el of document.querySelectorAll(AD_SELECTOR)) {
      if (!el.hasAttribute(MARK) && isVisible(el)) return el;
    }
    return null;
  }

  // Один XPath на все подписи: полный обход DOM 11 раз подряд слишком дорог.
  const TEXT_XPATH =
    '//*[self::span or self::div or self::p][' +
    LABELS.map((label) => 'normalize-space(.)="' + label + '"').join(' or ') +
    ']';

  /**
   * Текстовая метка: берём только короткие видимые элементы внутри ленты,
   * иначе «реклама» в комментарии или описании тоже считалась бы роликом.
   */
  function fromText() {
    let snapshot;
    try {
      snapshot = document.evaluate(
        TEXT_XPATH,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );
    } catch (err) {
      return null;
    }

    for (let index = 0; index < snapshot.snapshotLength; index += 1) {
      const el = snapshot.snapshotItem(index);
      if (!el || el.hasAttribute(MARK) || !isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width > 260 || rect.height > 64) continue;
      if (!feedItem(el)) continue;
      return el;
    }
    return null;
  }

  function scrollerFor(node) {
    let el = node.parentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 40) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function nextButton() {
    const selectors = [
      '[data-e2e="feed-navigation-next"]',
      '[data-e2e="arrow-down"]',
      '[data-e2e="feed-arrow-down"]',
      'button[class*="ArrowDown"]',
    ];

    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (isVisible(el) && !el.disabled) return el;
      }
    }
    return null;
  }

  function skip(marker, attempt) {
    const item = feedItem(marker) || marker;

    // Первая попытка: кнопка «Пропустить» внутри ролика или стрелка ленты.
    if (attempt === 0) {
      for (const button of item.querySelectorAll('button, [role="button"]')) {
        if (!isVisible(button)) continue;
        const text = (button.innerText || '').replace(/\\s+/g, ' ').trim();
        if (SKIP_TEXT.test(text)) {
          button.click();
          return true;
        }
      }

      const next = nextButton();
      if (next) {
        next.click();
        return true;
      }
    }

    // Вторая попытка: сайт сам обрабатывает ArrowDown в ленте.
    if (attempt <= 1) {
      for (const target of [document, window]) {
        target.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            code: 'ArrowDown',
            keyCode: 40,
            which: 40,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
      return true;
    }

    // Последняя попытка: прокручиваем контейнер ленты на один экран.
    const scroller = scrollerFor(item);
    if (scroller) {
      const step = Math.max(scroller.clientHeight, item.getBoundingClientRect().height);
      if (step > 0) {
        scroller.scrollBy({ top: step, behavior: 'smooth' });
        return true;
      }
    }

    window.scrollBy({
      top: Math.max(innerHeight, item.getBoundingClientRect().height),
      behavior: 'smooth',
    });
    return true;
  }

  function tick() {
    if (!running) return;

    const marker = fromSelector() || fromText();
    if (!marker) return;

    const tried = attempts.get(marker) || 0;
    if (tried >= 3) {
      marker.setAttribute(MARK, '');
      return;
    }

    // Не дёргаем ленту чаще раза в 1,2 с: smooth-скролл ещё в пути.
    const now = Date.now();
    if (now - lastSkip < 1200) return;

    lastSkip = now;
    attempts.set(marker, tried + 1);

    let acted = false;
    try {
      acted = skip(marker, tried);
    } catch (err) {
      /* лента перерисовалась между поиском и кликом */
    }

    if (acted && !noticed.has(marker)) {
      noticed.add(marker);
      showNotice();
    }
  }

  function start() {
    running = true;
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1200);
    tick();
  }

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
    if (noticeTimer) clearTimeout(noticeTimer);
    if (noticeHideTimer) clearTimeout(noticeHideTimer);
    noticeTimer = null;
    noticeHideTimer = null;
    const notice = document.getElementById(NOTICE_ID);
    if (notice) notice.remove();
    document.querySelectorAll('[' + MARK + ']').forEach((el) => el.removeAttribute(MARK));
    delete window.__octoAds;
  }

  window.__octoAds = { start, stop, tick };
  start();
  return 1;
})()`;

const CLEANUP_SCRIPT = `(() => {
  if (window.__octoAds) {
    window.__octoAds.stop();
    return;
  }
  document.querySelectorAll('[${MARK}]').forEach((el) => el.removeAttribute('${MARK}'));
})()`;

function isEnabled() {
  return ctx.adsSkip === true;
}

/** Читает настройку с диска один раз при старте приложения. */
function sync() {
  ctx.adsSkip = readState().adsSkip === true;
}

function apply() {
  const wc = ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  evalInPage(wc, [isEnabled() ? PAGE_SCRIPT : CLEANUP_SCRIPT]);
}

function setEnabled(value) {
  ctx.adsSkip = Boolean(value);
  writeState({ adsSkip: ctx.adsSkip });
  apply();
  pushState();
}

function toggle() {
  setEnabled(!isEnabled());
  return isEnabled();
}

sync();

module.exports = { isEnabled, sync, apply, setEnabled, toggle };
