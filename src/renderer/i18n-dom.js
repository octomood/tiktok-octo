'use strict';

/**
 * Перевод собственного интерфейса без ручной разметки каждого элемента.
 *
 * Main присылает словарь «русская строка → перевод». Скрипт обходит текстовые
 * узлы и атрибуты (title, placeholder, aria-label, alt), переводит их и следит
 * за DOM через MutationObserver. Шаблоны с {0}, {1} подставляют значения из
 * строк, собранных в рантайме: «Плагин «Foo» включён» → «Plugin “Foo” enabled».
 *
 * Элементы с data-i18n-skip не трогаем: там данные сайта и имена плагинов.
 */
(() => {
  const bridge = window.octo || window.octoPlugins || {};
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'KBD', 'PRE']);

  let lang = 'ru';
  let dir = 'ltr';
  let dict = {};
  let fallback = {};
  let patterns = [];
  let fallbackPatterns = [];
  let observer = null;
  let reapplying = false;
  let titleSource = '';

  const textSources = new WeakMap();
  const lastText = new WeakMap();
  const attrSources = new WeakMap();
  const lastAttrs = new WeakMap();

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function compile(source) {
    const exact = new Map();
    const list = [];
    for (const [key, value] of Object.entries(source || {})) {
      if (typeof value !== 'string') continue;
      if (/\{\d+\}/.test(key)) {
        list.push({
          regex: new RegExp(
            `^${escapeRegExp(key).replace(/\\\{(\d+)\\\}/g, '([\\s\\S]+?)')}$`,
            's',
          ),
          value,
          weight: key.replace(/\{\d+\}/g, '').length,
        });
      } else {
        exact.set(key, value);
      }
    }
    list.sort((left, right) => right.weight - left.weight);
    return { exact, patterns: list };
  }

  function translateWith(source, compiled) {
    if (!source) return source;
    const exact = compiled.exact.get(source);
    if (exact !== undefined) return exact;
    for (const pattern of compiled.patterns) {
      const match = source.match(pattern.regex);
      if (!match) continue;
      return pattern.value.replace(/\{(\d+)\}/g, (_all, index) => match[Number(index) + 1] ?? '');
    }
    return null;
  }

  /** Русский исходник текста: перевод не должен становиться новым ключом. */
  function sourceOf(node) {
    if (!node) return '';
    if (node.nodeType === 3) return textSources.get(node) || node.nodeValue || '';
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();
    while (text && !text.nodeValue.trim()) text = walker.nextNode();
    return text ? textSources.get(text) || text.nodeValue || '' : '';
  }

  function translate(source) {
    if (lang === 'ru' || !source) return source;
    const current = { exact: currentCompiled.exact, patterns };
    let value = translateWith(source, current);
    if (value === null && lang !== 'en') {
      value = translateWith(source, { exact: fallbackCompiled.exact, patterns: fallbackPatterns });
    }
    if (value === null) return source;
    if (source.includes('TikTok octo')) {
      value = value.replace(/TikTok\s+[^\s.,:;!?)«»]+/u, 'TikTok octo');
    }
    return value;
  }

  let currentCompiled = { exact: new Map(), patterns: [] };
  let fallbackCompiled = { exact: new Map(), patterns: [] };

  function normalize(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  function skipped(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element) return true;
    if (SKIP_TAGS.has(element.tagName)) return true;
    return Boolean(element.closest('[data-i18n-skip]'));
  }

  function translateTextNode(node, force) {
    if (!node || node.nodeType !== 3) return;
    if (skipped(node)) return;

    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    if (!force && raw === lastText.get(node)) return;

    const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return;
    const core = normalize(match[2]);
    if (!core) return;

    let source = textSources.get(node);
    if (force && source) {
      // оставляем исходную русскую строку
    } else if (raw !== lastText.get(node) || !source) {
      source = core;
      textSources.set(node, source);
    }

    const translated = translate(source);
    const next = match[1] + translated + match[3];
    lastText.set(node, next);
    if (raw !== next) node.nodeValue = next;
  }

  function translateAttribute(element, attr, force) {
    if (!element || element.nodeType !== 1 || skipped(element)) return;
    const raw = element.getAttribute(attr);
    if (!raw || !raw.trim()) return;

    let sources = attrSources.get(element);
    if (!sources) {
      sources = new Map();
      attrSources.set(element, sources);
    }
    let lasts = lastAttrs.get(element);
    if (!lasts) {
      lasts = new Map();
      lastAttrs.set(element, lasts);
    }

    if (!force && lasts.get(attr) === raw) return;

    let source = sources.get(attr);
    if (force && source) {
      // исходное значение уже записано
    } else if (!source || lasts.get(attr) !== raw) {
      source = normalize(raw);
      sources.set(attr, source);
    }

    const translated = translate(source);
    lasts.set(attr, translated);
    if (translated !== raw) element.setAttribute(attr, translated);
  }

  function scan(root, force = false) {
    if (!root || skipped(root)) return;

    if (root.nodeType === 3) {
      translateTextNode(root, force);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;

    if (root.nodeType === 1) {
      for (const attr of ATTRS) translateAttribute(root, attr, force);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === 3) {
        translateTextNode(node, force);
      } else if (node.nodeType === 1) {
        if (!skipped(node)) {
          for (const attr of ATTRS) translateAttribute(node, attr, force);
        }
      }
      node = walker.nextNode();
    }
  }

  function translateTitle() {
    if (!titleSource) titleSource = document.title;
    const translated = translate(titleSource);
    if (translated && translated !== document.title) document.title = translated;
  }

  function setI18n(payload) {
    if (!payload || typeof payload !== 'object') return;
    lang = payload.lang || 'ru';
    dir = payload.dir || 'ltr';
    dict = payload.dict || {};
    fallback = payload.fallback || {};

    currentCompiled = compile(dict);
    patterns = currentCompiled.patterns;
    fallbackCompiled = compile(fallback);
    fallbackPatterns = fallbackCompiled.patterns;

    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body?.classList.toggle('is-rtl', dir === 'rtl');

    reapplying = true;
    try {
      if (document.body) scan(document.body, true);
      translateTitle();
    } finally {
      observer?.takeRecords();
      reapplying = false;
    }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (reapplying) return;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target, false);
        } else if (mutation.type === 'attributes') {
          translateAttribute(mutation.target, mutation.attributeName, false);
        } else if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) scan(node, false);
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }

  window.octoI18n = {
    translate,
    source: sourceOf,
    set: setI18n,
    refresh: () => setI18n({ lang, dir, dict, fallback }),
    current: () => ({ lang, dir }),
  };

  if (bridge.i18n) setI18n(bridge.i18n);
  bridge.onI18n?.(setI18n);
  startObserver();
})();
