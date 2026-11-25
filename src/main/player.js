'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { evalInPage } = require('./page-eval');

/**
 * Настройки плеера, которых нет у сайта: скорость по умолчанию, старт без
 * звука, повтор видео, пауза в фоне, усиление громкости, эквалайзер, моно и
 * выбор аудиовыхода. Применяются к каждому новому <video>.
 *
 * Громкость выше 100 % и обработка звука идут через Web Audio. Chromium
 * глушит такой звук, если медиа пришло с чужого домена без CORS, поэтому
 * цепочка строится только для blob:/data:/своих источников или для видео с
 * атрибутом crossOrigin. Для остальных роликов громкость остаётся обычной.
 */

const DEFAULTS = {
  speed: 1,
  stickySpeed: true,
  volume: 1,
  startMuted: false,
  loop: false,
  pauseOnBlur: false,
  sinkId: '',
  equalizer: 'off',
  mono: false,
  brightness: 100,
  contrast: 100,
  warmth: 0,
  sharpness: 0,
  fit: 'auto',
};

const FIT_MODES = ['auto', 'contain', 'cover'];
const SPEEDS = [0.5, 1, 1.5, 2];
const MIN_SPEED = 0.5;
const MAX_SPEED = 3;
const MAX_VOLUME = 2;
const EQUALIZERS = ['off', 'speech', 'music'];
const BOOLEAN_KEYS = ['startMuted', 'loop', 'pauseOnBlur', 'mono', 'stickySpeed'];

let abLoop = { a: null, b: null, enabled: false };

const EQ_LABELS = {
  off: 'Эквалайзер выключен',
  speech: 'Эквалайзер: речь',
  music: 'Эквалайзер: музыка',
};

let blockedNotified = false;

function readSettings() {
  const saved = readState().player;
  const stored = saved && typeof saved === 'object' ? { ...saved } : {};
  // «Заполнить» раньше было значением по умолчанию и попадало в состояние при
  // любом сохранении настроек, даже если кадр никто не выбирал. Такие записи
  // возвращаем сайту; явный выбор пользователя помечаем fitChosen, чтобы
  // миграция не срабатывала повторно.
  if (stored.fit === 'cover' && stored.fitChosen !== true) {
    stored.fit = 'auto';
    stored.fitChosen = true;
    writeState({ player: { ...DEFAULTS, ...stored } });
  }
  return { ...DEFAULTS, ...stored };
}

function sync() {
  ctx.player = readSettings();
  ctx.abLoop = { ...abLoop };
}

function save(patch) {
  writeState({ player: { ...readSettings(), ...patch } });
  sync();
}

/** Конфиг страничного скрипта: настройки плеера плюс таймер сна и субтитры. */
function pageConfig() {
  const sleep = ctx.sleepPage || {};
  const captions = ctx.subtitles || {};
  return {
    ...ctx.player,
    sleepEndsAt: Number(sleep.endsAt) || 0,
    sleepStopAtEnd: sleep.stopAtEnd === true,
    sleepVideosLeft:
      sleep.videosLeft === null || sleep.videosLeft === undefined ? null : Number(sleep.videosLeft),
    sleepFade: sleep.fade === true,
    captionEnabled: captions.enabled === true,
    captionSize: Number(captions.size) || 100,
    captionBackground: captions.background !== false,
    captionOutline: captions.outline !== false,
    abLoop: { ...abLoop },
    // В PiP кадр всегда вписан: там важна целиком картинка, а не «заполнить».
    fit: ctx.pipActive ? 'contain' : FIT_MODES.includes(ctx.player.fit) ? ctx.player.fit : 'auto',
  };
}

function pageScript(config) {
  return `(() => {
    const next = ${JSON.stringify(config)};

    if (window.__octoPlayer) {
      window.__octoPlayer.update(next);
      return 0;
    }

    const MAX_GAIN = ${MAX_VOLUME};
    // Затухание занимает последние 20 секунд таймера сна.
    const FADE_MS = 20000;
    // После остановки держим паузу недолго: сайт не должен включить следующий ролик.
    const HALT_MS = 2500;
    const EQ = {
      off: [0, 0, 0],
      speech: [-5, 4, -2],
      music: [3, -1, 2],
    };

    let current = next;
    const seen = new WeakSet();
    // Видео, которым мы сами выставили object-fit: при возврате к «как на
    // сайте» снимаем только своё, не трогая инлайн-стиль самого сайта.
    const fitted = new WeakSet();
    const graphs = new WeakMap();
    // Последняя громкость, которую выставили мы: по ней отличаем свою запись
    // от того, что сайт вернул сам.
    const appliedVolume = new WeakMap();
    const appliedRate = new WeakMap();
    const state = {
      blocked: false,
      graphs: 0,
      ended: 0,
      done: false,
      haltedUntil: 0,
      videosLeft: next.sleepVideosLeft,
      ticker: null,
    };

    const videos = () => [...document.querySelectorAll('video')];

    const visible = (video) => {
      if (!video || !video.isConnected) return false;
      const rect = video.getBoundingClientRect();
      return rect.width > 40 && rect.height > 40;
    };

    const activeVideo = () =>
      videos().find((video) => !video.paused && visible(video)) ||
      videos().find(visible) ||
      videos()[0] ||
      null;

    /**
     * MediaElementSource для чужого домена без CORS даёт тишину. Поэтому
     * строим цепочку только там, где браузер не считает медиа «чужим».
     */
    const allowed = (video) => {
      const source = video.currentSrc || video.getAttribute('src') || '';
      if (!source) return true;
      if (/^(?:blob:|data:|mediastream:)/i.test(source)) return true;
      if (video.crossOrigin) return true;
      try {
        return new URL(source, location.href).origin === location.origin;
      } catch (err) {
        return false;
      }
    };

    let sharedContext = null;

    /** Один AudioContext на страницу: несколько медиа-источников хватает. */
    const audioContext = () => {
      if (sharedContext) return sharedContext;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      sharedContext = new Context();
      return sharedContext;
    };

    const buildGraph = (video) => {
      const existing = graphs.get(video);
      if (existing) return existing;
      if (!allowed(video)) return null;

      try {
        const context = audioContext();
        if (!context) return null;
        const source = context.createMediaElementSource(video);
        const low = context.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 140;
        const mid = context.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 1800;
        mid.Q.value = 0.9;
        const high = context.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 5200;
        const splitter = context.createChannelSplitter(2);
        const left = context.createGain();
        const right = context.createGain();
        // Моно — это (L+R)/2, а не громкая сумма двух каналов.
        left.gain.value = 0.5;
        right.gain.value = 0.5;
        const merger = context.createChannelMerger(1);
        const gain = context.createGain();

        source.connect(low);
        low.connect(mid);
        mid.connect(high);

        const entry = {
          context,
          source,
          low,
          mid,
          high,
          splitter,
          left,
          right,
          merger,
          gain,
          mono: null,
        };
        graphs.set(video, entry);
        state.graphs += 1;
        return entry;
      } catch (err) {
        return null;
      }
    };

    const route = (entry, mono) => {
      if (entry.mono === mono) return;
      try {
        entry.high.disconnect();
        entry.splitter.disconnect();
        entry.left.disconnect();
        entry.right.disconnect();
        entry.merger.disconnect();
        entry.gain.disconnect();
      } catch (err) {
        /* узлы уже отключены */
      }

      if (mono) {
        entry.high.connect(entry.splitter);
        entry.splitter.connect(entry.left, 0, 0);
        entry.splitter.connect(entry.right, 1, 0);
        entry.left.connect(entry.merger, 0, 0);
        entry.right.connect(entry.merger, 0, 0);
        entry.merger.connect(entry.gain);
      } else {
        entry.high.connect(entry.gain);
      }
      entry.gain.connect(entry.context.destination);
      entry.mono = mono;
    };

    const applyEq = (entry, preset) => {
      const bands = EQ[preset] || EQ.off;
      entry.low.gain.value = bands[0];
      entry.mid.gain.value = bands[1];
      entry.high.gain.value = bands[2];
    };

    /** Аудиовыход: у Web Audio-цепочки свой выход, у обычного видео — свой. */
    const applySink = (video, entry) => {
      const sink = typeof current.sinkId === 'string' ? current.sinkId : '';
      const target = entry ? entry.context : video;
      if (!target || typeof target.setSinkId !== 'function') return;
      if (target.__octoSink === sink) return;
      target.__octoSink = sink;
      try {
        const result = target.setSinkId(sink);
        if (result && typeof result.catch === 'function') {
          result.catch(() => {
            target.__octoSink = null;
          });
        }
      } catch (err) {
        target.__octoSink = null;
      }
    };

    const fadeFactor = () => {
      const endsAt = Number(current.sleepEndsAt) || 0;
      if (!current.sleepFade || endsAt <= 0) return 1;
      return Math.max(0, Math.min(1, (endsAt - Date.now()) / FADE_MS));
    };

    const sleeping = () => {
      const endsAt = Number(current.sleepEndsAt) || 0;
      const left = current.sleepVideosLeft;
      return endsAt > 0 || Boolean(current.sleepStopAtEnd) || (left !== null && left !== undefined);
    };

    const halt = () => {
      state.done = true;
      state.haltedUntil = Date.now() + HALT_MS;
      videos().forEach((video) => {
        try {
          video.pause();
        } catch (err) {
          /* элемент уже выгружен */
        }
      });
    };

    const apply = (video) => {
      if (!video) return;

      // Пишем скорость только при реальном отличии. Лишняя запись playbackRate
      // перезапускает видео-конвейер: на Linux звук продолжается, а кадры
      // замирают на первой секунде.
      if (Math.abs(video.playbackRate - current.speed) > 0.001) {
        try {
          appliedRate.set(video, current.speed);
          video.playbackRate = current.speed;
        } catch (err) {
          /* некоторые видео запрещают смену скорости */
        }
      }

      const raw = Number(current.volume);
      const volume = Math.min(MAX_GAIN, Math.max(0, Number.isFinite(raw) ? raw : 1));
      const needsGraph = volume > 1.001 || current.equalizer !== 'off' || Boolean(current.mono);
      if (!needsGraph) state.blocked = false;

      let entry = graphs.get(video) || null;
      if (!entry && needsGraph) entry = buildGraph(video);

      const factor = fadeFactor();
      if (entry) {
        route(entry, Boolean(current.mono));
        applyEq(entry, current.equalizer);
        const target = volume * factor;
        if (Math.abs(entry.gain.gain.value - target) > 0.001) entry.gain.gain.value = target;
        if (Math.abs(video.volume - 1) > 0.001) {
          video.volume = 1;
          appliedVolume.set(video, 1);
        }
        if (entry.context.state === 'suspended') {
          const resumed = entry.context.resume();
          if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
        }
        applySink(video, entry);
      } else {
        if (needsGraph) state.blocked = true;
        const target = Math.min(1, volume) * factor;
        if (Math.abs(video.volume - target) > 0.001) {
          video.volume = target;
          appliedVolume.set(video, target);
        }
        applySink(video, null);
      }

      if (video.loop !== Boolean(current.loop)) video.loop = Boolean(current.loop);
      if (state.haltedUntil > Date.now() && !video.paused) video.pause();
      applyPicture(video);
    };

    // --- Картинка: фильтр и кадрирование -----------------------------------
    // Резкость — свёртка по SVG-фильтру: она подчёркивает контуры уже
    // отрисованного кадра и не требует доступа к пикселям чужого видео.
    // Фильтр живёт в документе один и обновляется при смене ползунка.
    const sharpenFilter = (fraction) => {
      try {
        let svg = document.getElementById('octo-sharpen-svg');
        if (!svg) {
          const ns = 'http://www.w3.org/2000/svg';
          svg = document.createElementNS(ns, 'svg');
          svg.id = 'octo-sharpen-svg';
          svg.setAttribute('width', '0');
          svg.setAttribute('height', '0');
          svg.setAttribute('aria-hidden', 'true');
          svg.style.setProperty('position', 'absolute');
          svg.style.setProperty('width', '0');
          svg.style.setProperty('height', '0');
          svg.style.setProperty('overflow', 'hidden');
          svg.style.setProperty('pointer-events', 'none');

          const defs = document.createElementNS(ns, 'defs');
          const filter = document.createElementNS(ns, 'filter');
          filter.id = 'octo-sharpen';
          filter.setAttribute('color-interpolation-filters', 'sRGB');
          filter.setAttribute('x', '-5%');
          filter.setAttribute('y', '-5%');
          filter.setAttribute('width', '110%');
          filter.setAttribute('height', '110%');

          const convolve = document.createElementNS(ns, 'feConvolveMatrix');
          convolve.setAttribute('order', '3');
          convolve.setAttribute('preserveAlpha', 'true');
          convolve.setAttribute('edgeMode', 'duplicate');
          convolve.setAttribute('divisor', '1');

          filter.appendChild(convolve);
          defs.appendChild(filter);
          svg.appendChild(defs);
          (document.body || document.documentElement).appendChild(svg);
        }

        const convolve = svg.querySelector('feConvolveMatrix');
        if (!convolve) return false;
        // Сумма ядра равна 1, поэтому яркость кадра не меняется.
        const amount = Math.max(0, Math.min(0.5, fraction * 0.5));
        const kernel = [
          0,
          -amount,
          0,
          -amount,
          1 + 4 * amount,
          -amount,
          0,
          -amount,
          0,
        ].join(' ');
        convolve.setAttribute('kernelMatrix', kernel);
        return true;
      } catch (err) {
        return false;
      }
    };

    // Ставим только своё: при настройках по умолчанию ничего не трогаем,
    // чтобы не сбрасывать фильтры сайта.
    const applyPicture = (video) => {
      const brightness = Math.min(150, Math.max(50, Number(current.brightness) || 100));
      const contrast = Math.min(150, Math.max(50, Number(current.contrast) || 100));
      const warmth = Math.min(100, Math.max(0, Number(current.warmth) || 0));
      const sharpness = Math.min(100, Math.max(0, Number(current.sharpness) || 0));
      const parts = [];
      if (brightness !== 100) parts.push('brightness(' + brightness / 100 + ')');
      if (contrast !== 100) parts.push('contrast(' + contrast / 100 + ')');
      if (warmth > 0) {
        parts.push('sepia(' + (warmth / 100) * 0.35 + ')');
        parts.push('saturate(' + (1 + (warmth / 100) * 0.25) + ')');
      }
      if (sharpness > 0 && sharpenFilter(sharpness / 100)) {
        parts.push('url("#octo-sharpen")');
      }
      try {
        if (parts.length) video.style.setProperty('filter', parts.join(' '), 'important');
        else if (video.style.getPropertyValue('filter')) video.style.removeProperty('filter');
      } catch (err) {
        /* инлайн-стиль недоступен */
      }

      try {
        // По умолчанию кадр остаётся таким, каким его показывает сайт:
        // принудительный cover обрезал и «увеличивал» ролики без причины.
        const fit = current.fit === 'contain' || current.fit === 'cover' ? current.fit : '';
        if (fit) {
          fitted.add(video);
          if (video.style.getPropertyValue('object-fit') !== fit) {
            video.style.setProperty('object-fit', fit, 'important');
          }
        } else if (fitted.has(video)) {
          video.style.removeProperty('object-fit');
          fitted.delete(video);
        }
      } catch (err) {
        /* инлайн-стиль недоступен */
      }
    };

    // --- Субтитры ----------------------------------------------------------
    // Сайт сам решает, как называть кнопку и разметку субтитров, поэтому ищем
    // по нескольким признака и жмём только явно выключенную кнопку. Если
    // сигнала нет, оставляем как есть — лучше не гасить включённые субтитры.
    const captionButton = () => {
      const selectors = [
        '[data-e2e="subtitle"]',
        '[data-e2e*="subtitle"]',
        '[data-e2e*="caption"]',
        'button[aria-label*="aption" i]',
        'button[aria-label*="убтитр" i]',
        '[role="button"][aria-label*="aption" i]',
        'button[title*="aption" i]',
      ];
      const visible = (node) => {
        if (!node || node.tagName === 'STYLE') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const clickable = (node) => {
        if (!node || typeof node.closest !== 'function') return false;
        const target = node.closest('button, [role="button"], a');
        if (!target) return false;
        return visible(target) ? target : false;
      };

      for (const selector of selectors) {
        let list = [];
        try {
          list = [...document.querySelectorAll(selector)];
        } catch (err) {
          continue;
        }
        for (const node of list) {
          const button = clickable(node);
          if (button) return button;
        }
      }
      return null;
    };

    const captionOff = (button) => {
      if (button.getAttribute('aria-pressed') === 'false') return true;
      if (button.getAttribute('aria-pressed') === 'true') return false;
      if (button.getAttribute('data-state') === 'off') return true;
      if (button.getAttribute('data-state') === 'on') return false;
      const classes = typeof button.className === 'string' ? button.className : '';
      if (/(^|\\s)(off|is-off)(\\s|$)/.test(classes)) return true;
      return false;
    };

    let captionsAt = 0;
    const ensureCaptions = () => {
      if (!current.captionEnabled) return;
      const now = Date.now();
      if (now - captionsAt < 2500) return;
      const button = captionButton();
      if (!button || !captionOff(button)) return;
      captionsAt = now;
      try {
        button.click();
      } catch (err) {
        /* кнопка уже исчезла */
      }
    };

    const captionStyles = () => {
      let node = document.getElementById('octo-caption-style');
      if (!current.captionEnabled) {
        if (node) node.remove();
        return;
      }
      if (!node) {
        node = document.createElement('style');
        node.id = 'octo-caption-style';
        (document.head || document.documentElement).appendChild(node);
      }
      const size = Math.min(150, Math.max(75, Number(current.captionSize) || 100));
      const rules = [
        '[data-e2e*="caption"], [data-e2e*="subtitle"], [class*="DivCaption"], [class*="DivSubtitle"], [class*="captions"] {',
        '  font-size: ' + Math.round((16 * size) / 100) + 'px !important;',
      ];
      if (current.captionBackground) {
        rules.push('  background: rgba(0, 0, 0, 0.62) !important;');
        rules.push('  border-radius: 6px !important;');
        rules.push('  padding: 2px 6px !important;');
      }
      if (current.captionOutline) {
        rules.push('  text-shadow: 0 1px 2px #000, 0 0 4px #000 !important;');
      }
      rules.push('}');
      node.textContent = rules.join('\\n');
    };

    /** Дата публикации: сайт показывает её не везде, поэтому несколько вариантов. */
    const publishDate = () => {
      const selectors = [
        '[data-e2e="browse-video-date"]',
        '[data-e2e*="publish-date"]',
        '[data-e2e*="date"]',
        'time',
      ];
      for (const selector of selectors) {
        let list = [];
        try {
          list = [...document.querySelectorAll(selector)];
        } catch (err) {
          continue;
        }
        for (const node of list) {
          const datetime = node.getAttribute ? node.getAttribute('datetime') : '';
          const text = (node.textContent || '').trim();
          if (datetime) return datetime;
          if (text) return text.slice(0, 40);
        }
      }
      return '';
    };

    // --- Диагностика качества ----------------------------------------------
    // Битрейт TikTok пишет в query как bt в кбит/с. Кодек отдельно не отдаёт,
    // зато Chromium честно сообщает, доступен ли системный декодер HEVC.
    const bitrateOf = (video) => {
      try {
        const source = video.currentSrc || video.src || '';
        if (source) {
          const bt = Number(new URL(source, location.href).searchParams.get('bt'));
          if (Number.isFinite(bt) && bt > 0) return bt;
        }
      } catch (err) {
        /* источник может быть blob: или уже выгружен */
      }

      // TikTok часто играет через MSE: у <video> тогда blob:, а настоящий
      // адрес сегмента виден в записях performance. Берём самый свежий.
      try {
        const entries = performance.getEntriesByType('resource');
        for (let index = entries.length - 1; index >= 0; index -= 1) {
          const name = entries[index] && entries[index].name;
          if (!name || name.indexOf('/video/tos/') === -1) continue;
          const bt = Number(new URL(name).searchParams.get('bt'));
          if (Number.isFinite(bt) && bt > 0) return bt;
        }
      } catch (err) {
        /* performance может быть ограничен политикой страницы */
      }
      return 0;
    };

    let hevcSupported = null;
    const hevcAvailable = () => {
      if (hevcSupported !== null) return hevcSupported;
      try {
        const probe = document.createElement('video');
        const type = 'video/mp4; codecs="hvc1.1.6.L93.B0"';
        hevcSupported = Boolean(
          probe.canPlayType(type) ||
            (window.MediaSource && window.MediaSource.isTypeSupported(type)),
        );
      } catch (err) {
        hevcSupported = false;
      }
      return hevcSupported;
    };

    const onEnded = (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement) || video.loop) return;

      state.ended += 1;

      if (current.sleepStopAtEnd) {
        halt();
        return;
      }

      const left = current.sleepVideosLeft;
      if (left === null || left === undefined || !Number.isFinite(Number(left))) return;
      if (Number(left) <= 0) return;

      current.sleepVideosLeft = Number(left) - 1;
      state.videosLeft = current.sleepVideosLeft;
      if (current.sleepVideosLeft <= 0) halt();
    };

    const tick = () => {
      if (!sleeping()) return;
      const endsAt = Number(current.sleepEndsAt) || 0;
      if (endsAt > 0 && Date.now() >= endsAt) {
        halt();
        return;
      }
      const video = activeVideo();
      if (video) apply(video);
    };

    const syncTicker = () => {
      if (sleeping() && !state.ticker) {
        state.ticker = setInterval(tick, 500);
      } else if (!sleeping() && state.ticker) {
        clearInterval(state.ticker);
        state.ticker = null;
      }
    };

    const handle = (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;

      if (!seen.has(video)) {
        seen.add(video);
        if (current.startMuted && !video.muted) video.muted = true;
      }

      apply(video);
      ensureCaptions();
      captionStyles();
      // Сайт иногда выставляет свою скорость уже после play.
      setTimeout(() => apply(video), 600);
    };

    /**
     * TikTok возвращает свою громкость у нового ролика уже после play — обычно
     * когда снимает mute с автозапуска. Свою запись отличаем по appliedVolume,
     * поэтому «записали → volumechange → записали» не зацикливается.
     */
    const handleVolume = (event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      const own = appliedVolume.get(video);
      if (own !== undefined && Math.abs(video.volume - own) <= 0.01) return;
      apply(video);
    };

    const handleRate = (event) => {
      if (!current.stickySpeed) return;
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      const own = appliedRate.get(video);
      if (own !== undefined && Math.abs(video.playbackRate - own) <= 0.001) return;
      if (Math.abs(video.playbackRate - current.speed) > 0.001) apply(video);
    };

    const onTimeUpdate = (event) => {
      const ab = current.abLoop;
      if (!ab || !ab.enabled || ab.a === null || ab.b === null || !(ab.b > ab.a)) return;
      const video = event.target;
      if (!(video instanceof HTMLVideoElement) || video !== activeVideo()) return;
      const now = Number(video.currentTime) || 0;
      if (now >= ab.b || now < ab.a - 0.15) {
        try {
          video.currentTime = ab.a;
        } catch {
          /* перемотка недоступна */
        }
      }
    };

    document.addEventListener('play', handle, true);
    document.addEventListener('loadedmetadata', handle, true);
    document.addEventListener('volumechange', handleVolume, true);
    document.addEventListener('ratechange', handleRate, true);
    document.addEventListener('timeupdate', onTimeUpdate, true);
    document.addEventListener('ended', onEnded, true);

    window.__octoPlayer = {
      update(configuration) {
        const beforeEnds = Number(current.sleepEndsAt) || 0;
        const beforeLeft = current.sleepVideosLeft;
        const beforeStop = Boolean(current.sleepStopAtEnd);
        current = { ...current, ...configuration };

        if (
          (Number(current.sleepEndsAt) || 0) !== beforeEnds ||
          current.sleepVideosLeft !== beforeLeft ||
          Boolean(current.sleepStopAtEnd) !== beforeStop
        ) {
          state.done = false;
          state.haltedUntil = 0;
        }
        state.videosLeft = current.sleepVideosLeft;

        document.querySelectorAll('video').forEach((video) => {
          seen.add(video);
          if (current.startMuted && !video.muted) video.muted = true;
          apply(video);
        });
        syncTicker();
        captionStyles();
        ensureCaptions();
      },
      stop() {
        clearInterval(state.ticker);
        state.ticker = null;
        document.removeEventListener('play', handle, true);
        document.removeEventListener('loadedmetadata', handle, true);
        document.removeEventListener('volumechange', handleVolume, true);
        document.removeEventListener('ratechange', handleRate, true);
        document.removeEventListener('timeupdate', onTimeUpdate, true);
        document.removeEventListener('ended', onEnded, true);
        document.querySelectorAll('video').forEach((video) => {
          video.playbackRate = 1;
          video.loop = false;
        });
        delete window.__octoPlayer;
      },
      nudge(seconds) {
        const video = activeVideo();
        if (!video) return false;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const target = Math.max(0, (Number(video.currentTime) || 0) + (Number(seconds) || 0));
        try {
          video.currentTime = duration > 0 ? Math.min(duration, target) : target;
        } catch (err) {
          return false;
        }
        return true;
      },
      stepFrame(direction) {
        const video = activeVideo();
        if (!video) return false;
        const dir = Number(direction) < 0 ? -1 : 1;
        try {
          if (!video.paused) video.pause();
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          const step = 1 / 30;
          const target = Math.max(0, (Number(video.currentTime) || 0) + dir * step);
          video.currentTime = duration > 0 ? Math.min(duration, target) : target;
        } catch (err) {
          return false;
        }
        return true;
      },
      seekPercent(fraction) {
        const video = activeVideo();
        if (!video) return false;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (!(duration > 0)) return false;
        const value = Math.max(0, Math.min(1, Number(fraction) || 0));
        try {
          video.currentTime = duration * value;
        } catch (err) {
          return false;
        }
        return true;
      },
      seekTo(seconds) {
        const video = activeVideo();
        if (!video) return false;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const target = Math.max(0, Number(seconds) || 0);
        try {
          video.currentTime = duration > 0 ? Math.min(duration, target) : target;
        } catch (err) {
          return false;
        }
        return true;
      },
      status() {
        const video = activeVideo();
        return {
          blocked: Boolean(state.blocked),
          graphs: state.graphs,
          done: Boolean(state.done),
          ended: state.ended,
          videosLeft: state.videosLeft,
          time: video ? Number(video.currentTime) || 0 : 0,
          duration: video && Number.isFinite(video.duration) ? video.duration : 0,
          volume: video ? video.volume : 0,
          date: publishDate(),
          width: video ? Number(video.videoWidth) || 0 : 0,
          height: video ? Number(video.videoHeight) || 0 : 0,
          bitrate: video ? bitrateOf(video) : 0,
          hevc: hevcAvailable(),
        };
      },
    };

    document.querySelectorAll('video').forEach((video) => {
      seen.add(video);
      if (current.startMuted) video.muted = true;
      apply(video);
    });
    syncTicker();
    return 1;
  })()`;
}

function contents() {
  const wc = ctx.view?.webContents;
  return wc && !wc.isDestroyed() ? wc : null;
}

function apply() {
  const wc = contents();
  if (!wc) return;
  evalInPage(wc, [pageScript(pageConfig())]);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

function setSpeed(value) {
  const raw = Number(value) || 1;
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(raw * 4) / 4));
  save({ speed });
  apply();
  pushState();
}

/**
 * Громкость 0…2: сайт не даёт своего ползунка, поэтому задаём её у каждого
 * <video>, а выше 100 % — усилением в Web Audio-цепочке.
 */
function setVolume(value) {
  const volume = Math.min(MAX_VOLUME, Math.max(0, Number(value) || 0));
  save({ volume: Math.round(volume * 100) / 100 });
  apply();
  pushState();
  if (volume > 1.001) probeBlocked();
}

function setEqualizer(value) {
  const name = EQUALIZERS.includes(value) ? value : 'off';
  save({ equalizer: name });
  apply();
  pushState();
  toast(EQ_LABELS[name]);
  if (name !== 'off') probeBlocked();
}

/** Картинка: яркость, контраст, тёплый оттенок и резкость. */
function setPicture(patch) {
  if (!patch || typeof patch !== 'object') return;
  const next = { ...readSettings() };

  if ('brightness' in patch) {
    next.brightness = Math.min(150, Math.max(50, Math.round(Number(patch.brightness) || 100)));
  }
  if ('contrast' in patch) {
    next.contrast = Math.min(150, Math.max(50, Math.round(Number(patch.contrast) || 100)));
  }
  if ('warmth' in patch) {
    next.warmth = Math.min(100, Math.max(0, Math.round(Number(patch.warmth) || 0)));
  }
  if ('sharpness' in patch) {
    next.sharpness = Math.min(100, Math.max(0, Math.round(Number(patch.sharpness) || 0)));
  }

  writeState({ player: next });
  sync();
  apply();
  pushState();
}

/** «Как на сайте», «вписать» или «заполнить окно». */
function setFit(value) {
  const fit = FIT_MODES.includes(value) ? value : 'auto';
  save({ fit, fitChosen: true });
  apply();
  pushState();
}

/**
 * Быстрый пресет: чуть больше контраста и заметная резкость. Разрешение
 * ролика это не поднимает, но размытый 540p-поток TikTok выглядит чётче.
 */
function enhancePicture() {
  save({ sharpness: 45, contrast: 108 });
  apply();
  pushState();
  toast('Картинка стала чётче');
}

function resetPicture() {
  save({ brightness: 100, contrast: 100, warmth: 0, sharpness: 0, fit: 'auto', fitChosen: true });
  apply();
  pushState();
  toast('Картинка сброшена');
}

let panelTimer = null;

/**
 * Пока панель открыта, обновляем дату публикации: она меняется при
 * пролистывании ленты, а своих событий сайт не присылает.
 */
function watchPanel(active) {
  if (!active) {
    if (panelTimer) clearInterval(panelTimer);
    panelTimer = null;
    return;
  }
  if (panelTimer) return;

  const refresh = async () => {
    const wc = contents();
    if (!wc || wc.isLoading()) return;
    const info = await status();
    if (!info) return;
    let changed = false;

    const date = typeof info.date === 'string' ? info.date : '';
    if (date !== ctx.videoDate) {
      ctx.videoDate = date;
      changed = true;
    }

    // Панель показывает, что реально играет: разрешение, битрейт и доступен
    // ли системный HEVC. Это помогает проверить аппаратное декодирование.
    const quality = {
      width: Number(info.width) || 0,
      height: Number(info.height) || 0,
      bitrate: Number(info.bitrate) || 0,
      hevc: info.hevc === true,
    };
    const previous = ctx.videoQuality || {};
    if (
      quality.width !== previous.width ||
      quality.height !== previous.height ||
      quality.bitrate !== previous.bitrate ||
      quality.hevc !== previous.hevc
    ) {
      ctx.videoQuality = quality;
      changed = true;
    }

    if (changed) pushState();
  };

  // Не ждём первого тика: при открытии панели значения должны быть сразу.
  refresh();
  panelTimer = setInterval(refresh, 2000);
  if (typeof panelTimer.unref === 'function') panelTimer.unref();
}

function setSink(value) {
  const sinkId = typeof value === 'string' ? value : '';
  save({ sinkId });
  apply();
  pushState();
  toast(sinkId ? 'Звук выведен на выбранное устройство' : 'Звук идёт на устройство системы');
}

const DEVICES_SCRIPT = `(async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'audiooutput')
      .map((device) => ({ id: device.deviceId, label: device.label || '' }));
  } catch (err) {
    return [];
  }
})()`;

/** Список аудиовыходов нужен и панели, и палитре команд. */
async function refreshDevices() {
  const wc = contents();
  if (!wc) return [];
  let devices = [];
  try {
    const result = await withTimeout(wc.executeJavaScript(DEVICES_SCRIPT, false), 2000);
    if (Array.isArray(result)) {
      devices = result
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => ({ id: item.id, label: String(item.label || '') }));
    }
  } catch {
    devices = [];
  }
  ctx.audioDevices = devices;
  pushState();
  return devices;
}

async function status() {
  const wc = contents();
  if (!wc) return null;
  try {
    const info = await withTimeout(
      wc.executeJavaScript(
        `(() => (window.__octoPlayer && window.__octoPlayer.status ? window.__octoPlayer.status() : null))()`,
        false,
      ),
      1500,
    );
    return info && typeof info === 'object' ? info : null;
  } catch {
    return null;
  }
}

/** Перемотка клавиатурной лентой: ±секунды, кадры и доля ролика. */
function nudge(seconds) {
  const wc = contents();
  if (!wc) return;
  const step = Number(seconds) || 0;
  evalInPage(wc, [`window.__octoPlayer && window.__octoPlayer.nudge(${step})`]);
}

function stepFrame(direction) {
  const wc = contents();
  if (!wc) return;
  const dir = Number(direction) < 0 ? -1 : 1;
  evalInPage(wc, [`window.__octoPlayer && window.__octoPlayer.stepFrame(${dir})`]);
}

function formatSec(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${m}:${rem}`;
}

async function setAbPoint(which) {
  const info = await status();
  if (!info || !(info.duration > 0)) {
    toast('Откройте видео для настройки цикла A–B');
    return false;
  }
  const time = Math.max(0, Math.round((Number(info.time) || 0) * 10) / 10);
  if (which === 'a') {
    abLoop.a = time;
    if (abLoop.b !== null && abLoop.b <= abLoop.a) abLoop.b = null;
  } else if (which === 'b') {
    if (abLoop.a !== null && time <= abLoop.a) {
      abLoop.b = abLoop.a;
      abLoop.a = time;
    } else {
      abLoop.b = time;
    }
  }
  abLoop.enabled = abLoop.a !== null && abLoop.b !== null && abLoop.b > abLoop.a;
  ctx.abLoop = { ...abLoop };
  apply();
  pushState();
  if (abLoop.enabled) {
    toast(`Цикл A–B: ${formatSec(abLoop.a)} – ${formatSec(abLoop.b)}`);
  } else {
    toast(which === 'a' ? `Точка A: ${formatSec(abLoop.a)}` : `Точка B: ${formatSec(abLoop.b)}`);
  }
  return true;
}

function clearAbLoop({ silent = false } = {}) {
  if (abLoop.a === null && abLoop.b === null && !abLoop.enabled) return;
  abLoop = { a: null, b: null, enabled: false };
  ctx.abLoop = { ...abLoop };
  apply();
  pushState();
  if (!silent) toast('Цикл A–B сброшен');
}

function seekPercent(fraction) {
  const wc = contents();
  if (!wc) return;
  const value = Math.min(1, Math.max(0, Number(fraction) || 0));
  evalInPage(wc, [`window.__octoPlayer && window.__octoPlayer.seekPercent(${value})`]);
}

/** Вернуться на секунду сохранённого ролика: сайт грузится не мгновенно. */
function seekTo(seconds) {
  const target = Math.max(0, Math.round(Number(seconds) || 0));
  if (!target) return;
  let attempt = 0;
  const trySeek = () => {
    attempt += 1;
    const wc = contents();
    if (!wc || wc.isDestroyed()) return;
    evalInPage(wc, [`window.__octoPlayer && window.__octoPlayer.seekTo(${target})`]);
    if (attempt < 4) setTimeout(trySeek, 900);
  };
  trySeek();
}

/**
 * Включили усиление или обработку звука: если ролик пришёл с чужого домена,
 * честно предупреждаем, что приложение оставит обычную громкость.
 */
async function probeBlocked() {
  if (blockedNotified) return;
  const info = await status();
  if (!info || !info.blocked || blockedNotified) return;
  blockedNotified = true;
  toast('Усиление свыше 100 % недоступно для этого видео');
}

function toggle(key) {
  if (!BOOLEAN_KEYS.includes(key)) return;
  save({ [key]: !ctx.player[key] });
  apply();
  pushState();
  if (key === 'mono' && ctx.player.mono) probeBlocked();
}

/** Пауза при потере фокуса/сворачивании — только если включено. */
function pauseForBackground() {
  if (!ctx.player.pauseOnBlur) return;
  const wc = contents();
  if (!wc) return;
  evalInPage(wc, [`document.querySelectorAll('video').forEach((video) => video.pause())`]);
}

sync();

module.exports = {
  SPEEDS,
  EQUALIZERS,
  MAX_VOLUME,
  apply,
  setSpeed,
  setVolume,
  setEqualizer,
  setSink,
  setPicture,
  setFit,
  enhancePicture,
  resetPicture,
  watchPanel,
  refreshDevices,
  status,
  nudge,
  stepFrame,
  setAbPoint,
  clearAbLoop,
  seekPercent,
  seekTo,
  toggle,
  pauseForBackground,
  pageConfig,
};
