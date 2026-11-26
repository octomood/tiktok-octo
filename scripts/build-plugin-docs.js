'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Сборка документации для встроенного окна (и для статического сайта).
 *
 *   node scripts/build-plugin-docs.js
 *   node scripts/build-plugin-docs.js --out docs/plugins/site
 *
 * Источники — docs/plugins/README.md и PUBLISHING.md. Никаких внешних
 * зависимостей и CDN: получается автономный набор HTML, CSS и небольшого JS.
 */

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'plugins');
const DEFAULT_OUT = path.join(ROOT, 'src', 'renderer', 'plugins-docs');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const args = process.argv.slice(2);
let OUT = DEFAULT_OUT;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--out') {
    OUT = path.resolve(args[index + 1] || DEFAULT_OUT);
    index += 1;
  }
}

const PAGES = [
  {
    source: path.join(DOCS, 'README.md'),
    output: 'index.html',
    title: 'Плагины TikTok Octo',
    description:
      'Руководство разработчика: манифест, API, разрешения, безопасность, сборка, подписи и обновления.',
    active: 'guide',
  },
  {
    source: path.join(DOCS, 'PUBLISHING.md'),
    output: 'publishing.html',
    title: 'Правила публикации плагинов',
    description: 'Строгие требования каталога TikTok Octo: безопасность, код, подписи и ревью.',
    active: 'rules',
  },
];

const TRANSLIT = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .split('')
    .map((char) => (TRANSLIT[char] !== undefined ? TRANSLIT[char] : char))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function safeHref(raw) {
  const href = String(raw || '').trim();
  if (!href) return '#';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('#')) return href;
  if (href === 'PUBLISHING.md') return 'publishing.html';
  if (href === 'README.md') return 'index.html';
  if (/^[a-z0-9._/-]+\.md$/i.test(href)) return href.replace(/\.md$/i, '.html');
  if (/^[a-z0-9._/-]+$/i.test(href)) return href;
  return '#';
}

function inline(raw) {
  const tokens = [];
  const token = (html) => `\u0000${tokens.push(html) - 1}\u0000`;

  let value = String(raw);

  // Код в первую очередь: внутри него не должно быть ссылок и жирного.
  value = value.replace(/`([^`]+)`/g, (_match, code) => token(`<code>${escapeHtml(code)}</code>`));

  // Markdown-ссылки.
  value = value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) =>
    token(`<a href="${escapeHtml(safeHref(href))}">${inline(label)}</a>`),
  );

  // Голые URL.
  value = value.replace(/https?:\/\/[^\s<)]+[^\s<).,;:!?]/g, (url) =>
    token(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`),
  );

  value = escapeHtml(value);

  // Разрешённые inline-теги документации.
  value = value.replace(/&lt;(\/?)(kbd|br|sub|sup)\s*\/?&gt;/gi, (_match, close, tag) => {
    const name = tag.toLowerCase();
    if (name === 'br') return '<br>';
    return `<${close ? '/' : ''}${name}>`;
  });

  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  value = value.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');

  return value.replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)] || '');
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableStart(lines, index) {
  const line = lines[index];
  const next = lines[index + 1];
  if (!line || !line.includes('|') || !next || !next.includes('|')) return false;
  const cells = splitRow(next);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
}

function renderTable(lines, index) {
  const header = splitRow(lines[index]);
  let cursor = index + 2;
  const rows = [];
  while (
    cursor < lines.length &&
    lines[cursor].trim() &&
    lines[cursor].includes('|') &&
    !/^```/.test(lines[cursor])
  ) {
    rows.push(splitRow(lines[cursor]));
    cursor += 1;
  }

  const head = header.map((cell) => `<th>${inline(cell)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell || '')}</td>`).join('')}</tr>`)
    .join('');

  return {
    index: cursor,
    html: `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
  };
}

function isBlockStart(lines, index) {
  const line = lines[index];
  return (
    /^#{1,6}\s+/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^-{3,}\s*$/.test(line.trim()) ||
    isTableStart(lines, index)
  );
}

function renderBlocks(lines, headings, headingState) {
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^```\s*([^\s]*)\s*$/.exec(line);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : '';
      output.push(`<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(4, heading[1].length);
      const text = heading[2].trim();
      let id = slugify(text) || `section-${headingState.count + 1}`;
      headingState.count += 1;
      const base = id;
      let suffix = 2;
      while (headingState.used.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      headingState.used.add(id);
      if (level >= 2 && level <= 3) headings.push({ level, text, id });
      output.push(`<h${level} id="${escapeHtml(id)}">${inline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^-{3,}\s*$/.test(line.trim())) {
      output.push('<hr>');
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = renderTable(lines, index);
      output.push(table.html);
      index = table.index;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      output.push(
        `<blockquote>${renderBlocks(quote, [], { used: new Set(), count: 0 })}</blockquote>`,
      );
      continue;
    }

    const unordered = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items = [];
      while (index < lines.length) {
        const match = isOrdered
          ? /^\d+\.\s+(.*)$/.exec(lines[index])
          : /^[-*]\s+(.*)$/.exec(lines[index]);
        if (!match) break;
        let item = match[1].trim();
        index += 1;
        // Продолжение пункта: строки с отступом, не являющиеся новым пунктом.
        while (
          index < lines.length &&
          /^\s{2,}\S/.test(lines[index]) &&
          !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[index])
        ) {
          item += ` ${lines[index].trim()}`;
          index += 1;
        }
        const checkbox = /^\[([ xX])\]\s+(.*)$/.exec(item);
        if (checkbox) {
          item = `${checkbox[1].toLowerCase() === 'x' ? '☑' : '☐'} ${checkbox[2]}`;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      output.push(`<${isOrdered ? 'ol' : 'ul'}>${items.join('')}</${isOrdered ? 'ol' : 'ul'}>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  return output.join('\n');
}

function renderMarkdown(markdown) {
  const headings = [];
  const body = renderBlocks(markdown.replace(/\r\n/g, '\n').split('\n'), headings, {
    used: new Set(),
    count: 0,
  });
  return { body, headings };
}

function navLink(href, label, active, key) {
  return `<a class="top-link top-page${active === key ? ' is-active' : ''}" href="${href}">${label}</a>`;
}

function tocHtml(headings) {
  if (!headings.length) return '<p class="toc-empty">Разделы не найдены</p>';
  return headings
    .map(
      (heading) =>
        `<a class="toc-link toc-level-${heading.level}" href="#${escapeHtml(heading.id)}">${inline(
          heading.text,
        )}</a>`,
    )
    .join('');
}

function layout({ title, description, body, headings, active, output }) {
  const isRules = active === 'rules';
  return `<!doctype html>
<html lang="ru" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:;"
    />
    <meta name="color-scheme" content="dark light" />
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(title)} — TikTok Octo</title>
    <link rel="stylesheet" href="style.css" />
    <script src="site.js" defer></script>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="index.html">
        <span class="brand-mark" aria-hidden="true">◈</span>
        <span class="brand-text">TikTok <b>octo</b> <span>docs</span></span>
      </a>
      <nav class="topnav" aria-label="Документация">
        ${navLink('index.html', 'Руководство', active, 'guide')}
        ${navLink('publishing.html', 'Правила публикации', active, 'rules')}
        <a class="top-link" href="https://github.com/octomood/tiktok-octo">GitHub</a>
        <a class="top-link" href="https://github.com/octomood/tiktok-octo/releases">Релизы</a>
        <button class="theme-toggle" id="themeToggle" type="button" title="Тема" aria-label="Переключить тему">
          <span class="theme-dark">☾</span><span class="theme-light">☀</span>
        </button>
      </nav>
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="Разделы">☰</button>
    </header>

    <div class="layout" id="layout">
      <aside class="sidebar">
        <p class="sidebar-title">На этой странице</p>
        <nav class="toc" id="toc" aria-label="Содержание">
          ${tocHtml(headings)}
        </nav>
        <div class="sidebar-foot">
          <a href="https://github.com/octomood/tiktok-octo/tree/main/docs/plugins">Исходники документации</a>
          <a href="https://github.com/octomood/tiktok-octo/blob/main/plugins/examples/hello-octo">Пример плагина</a>
          <span class="version">v${escapeHtml(VERSION)}</span>
        </div>
      </aside>

      <main class="content">
        <article class="doc">
          ${body}
        </article>
        <footer class="page-foot">
          <span>TikTok Octo · ${isRules ? 'правила каталога' : 'руководство разработчика'}</span>
          <span><a href="https://github.com/octomood/tiktok-octo">Исходный код</a> · MIT</span>
        </footer>
      </main>
    </div>
  </body>
</html>
`;
}

const STYLE = `/* Статическая документация TikTok Octo. */
:root {
  --bg: #0d1117;
  --bg-soft: #11161d;
  --panel: #161b22;
  --panel-2: #1c232c;
  --fg: #e6edf3;
  --muted: #8b949e;
  --muted-2: #b1bac4;
  --line: #30363d;
  --accent: #ff5d8f;
  --accent-soft: rgba(255, 93, 143, 0.12);
  --code: #0a0f14;
  --shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
}

html[data-theme='light'] {
  --bg: #fbfbfd;
  --bg-soft: #f4f4f8;
  --panel: #ffffff;
  --panel-2: #f1f2f6;
  --fg: #1b1b22;
  --muted: #6b7280;
  --muted-2: #4b5563;
  --line: #e2e4ea;
  --accent: #d81b60;
  --accent-soft: rgba(216, 27, 96, 0.09);
  --code: #f4f5f8;
  --shadow: 0 18px 40px rgba(25, 20, 35, 0.09);
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', sans-serif;
  font-size: 15px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 22px;
  height: 64px;
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(14px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fg);
  font-size: 15px;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.brand:hover { text-decoration: none; }

.brand-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(145deg, #ff8fb1, #7d2948);
  color: #fff;
  font-size: 16px;
  box-shadow: 0 4px 14px rgba(255, 93, 143, 0.22);
}

.brand b { color: var(--accent); font-weight: 700; }
.brand-text > span { color: var(--muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }

.topnav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.top-link {
  padding: 7px 11px;
  border-radius: 8px;
  color: var(--muted-2);
  font-size: 13px;
  white-space: nowrap;
}

.top-link:hover { background: var(--panel-2); color: var(--fg); text-decoration: none; }
.top-link.is-active { background: var(--accent-soft); color: var(--accent); }

.theme-toggle,
.menu-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: transparent;
  color: var(--muted-2);
  font: inherit;
  cursor: pointer;
}

.theme-toggle:hover,
.menu-toggle:hover { background: var(--panel-2); color: var(--fg); }
.theme-light { display: none; }
html[data-theme='light'] .theme-dark { display: none; }
html[data-theme='light'] .theme-light { display: inline; }
.menu-toggle { display: none; }

.layout {
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  gap: 48px;
  width: min(1180px, calc(100% - 56px));
  margin: 0 auto;
  padding: 38px 0 80px;
}

.sidebar {
  position: sticky;
  top: 92px;
  align-self: start;
  max-height: calc(100vh - 110px);
  overflow: auto;
  padding-right: 10px;
  scrollbar-width: thin;
}

.sidebar-title {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.toc { display: flex; flex-direction: column; gap: 2px; }

.toc-link {
  padding: 6px 10px;
  border-left: 2px solid transparent;
  border-radius: 0 7px 7px 0;
  color: var(--muted-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.toc-link:hover { background: var(--panel-2); color: var(--fg); text-decoration: none; }
.toc-link.is-active { border-left-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.toc-level-3 { padding-left: 24px; font-size: 12px; }
.toc-empty { color: var(--muted); font-size: 12px; }

.sidebar-foot {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  font-size: 11.5px;
}

.sidebar-foot a { color: var(--muted); }
.sidebar-foot a:hover { color: var(--fg); }
.version { margin-top: 4px; color: var(--muted); opacity: 0.65; }

.content { min-width: 0; }

.doc h1 {
  margin: 0 0 18px;
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 750;
  letter-spacing: -0.035em;
  line-height: 1.12;
}

.doc h2 {
  margin: 44px 0 14px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.25;
  scroll-margin-top: 84px;
}

.doc h3 {
  margin: 30px 0 10px;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.015em;
  scroll-margin-top: 84px;
}

.doc h4 {
  margin: 22px 0 8px;
  font-size: 15px;
  font-weight: 650;
  scroll-margin-top: 84px;
}

.doc p { margin: 0 0 14px; }
.doc strong { color: var(--fg); font-weight: 650; }
.doc em { color: var(--muted-2); }

.doc ul,
.doc ol { margin: 0 0 16px; padding-left: 24px; }
.doc li { margin: 5px 0; }
.doc li > p { margin: 0; }

.doc blockquote {
  margin: 20px 0;
  padding: 12px 18px;
  border-left: 3px solid var(--accent);
  border-radius: 0 10px 10px 0;
  background: var(--accent-soft);
  color: var(--muted-2);
}

.doc blockquote p { margin: 0; }

.doc code {
  padding: 0.15em 0.38em;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel-2);
  color: var(--fg);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.86em;
}

.doc pre {
  position: relative;
  margin: 18px 0;
  padding: 16px 18px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--code);
  line-height: 1.55;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.doc pre code {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 12.5px;
  white-space: pre;
}

.copy-code {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.doc pre:hover .copy-code,
.copy-code:focus-visible { opacity: 1; }
.copy-code:hover { color: var(--fg); }

.doc kbd {
  display: inline-block;
  min-width: 1.6em;
  padding: 0.1em 0.4em;
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--panel-2);
  color: var(--muted-2);
  font-family: inherit;
  font-size: 0.78em;
  text-align: center;
}

.doc hr { margin: 34px 0; border: 0; border-top: 1px solid var(--line); }

.table-wrap { margin: 18px 0; overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
.doc table { width: 100%; border-collapse: collapse; font-size: 13px; }
.doc th,
.doc td { padding: 9px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.doc th { background: var(--panel-2); color: var(--muted); font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
.doc tr:last-child td { border-bottom: 0; }
.doc td code { white-space: nowrap; }

.doc img { max-width: 100%; border-radius: 10px; }

.page-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  margin-top: 54px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 11.5px;
}

@media (max-width: 920px) {
  .layout { grid-template-columns: 1fr; gap: 24px; width: min(100% - 36px, 760px); padding-top: 26px; }
  .sidebar {
    position: static;
    max-height: none;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel);
    display: none;
  }
  .layout.nav-open .sidebar { display: block; }
  .menu-toggle { display: grid; }
  .topnav .top-link { display: none; }
  .topnav .top-link.top-page { display: inline-block; }
}

@media (max-width: 560px) {
  .topbar { height: 58px; padding: 0 14px; gap: 10px; }
  .brand-text > span { display: none; }
  .doc h1 { font-size: 28px; }
  .doc h2 { font-size: 21px; }
  .doc h3 { font-size: 17px; }
  .page-foot { flex-direction: column; }
}
`;

const SCRIPT = `(() => {
  const root = document.documentElement;
  const storage = (() => {
    try { return window.localStorage; } catch { return null; }
  })();
  const saved = storage ? storage.getItem('octo-docs-theme') : null;
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  else root.dataset.theme = prefersLight ? 'light' : 'dark';

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      if (storage) storage.setItem('octo-docs-theme', next);
    });
  }

  const menu = document.getElementById('menuToggle');
  const layout = document.getElementById('layout');
  if (menu && layout) {
    menu.addEventListener('click', () => layout.classList.toggle('nav-open'));
  }

  for (const pre of document.querySelectorAll('.doc pre')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = 'Copy';
    button.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      try {
        await navigator.clipboard.writeText(code ? code.innerText : pre.innerText);
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy'; }, 1200);
      } catch {
        button.textContent = 'Ctrl+C';
      }
    });
    pre.append(button);
  }

  const links = [...document.querySelectorAll('.toc-link')];
  const byId = new Map(links.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
  const headings = [...document.querySelectorAll('.doc h2[id], .doc h3[id]')];
  if (headings.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const link = byId.get(entry.target.id);
          if (!link) continue;
          for (const item of links) item.classList.remove('is-active');
          link.classList.add('is-active');
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    for (const heading of headings) observer.observe(heading);
  }
})();
`;

function main() {
  const pages = PAGES.map((page) => {
    const markdown = fs.readFileSync(page.source, 'utf8');
    const rendered = renderMarkdown(markdown);
    return {
      ...page,
      ...rendered,
      html: layout({ ...page, ...rendered }),
    };
  });

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const page of pages) {
    fs.writeFileSync(path.join(OUT, page.output), page.html);
  }
  fs.writeFileSync(path.join(OUT, 'style.css'), STYLE);
  fs.writeFileSync(path.join(OUT, 'site.js'), SCRIPT);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(
    path.join(OUT, '404.html'),
    `<!doctype html><meta charset="utf-8"><title>404</title><meta http-equiv="refresh" content="0; url=index.html"><p><a href="index.html">Документация TikTok Octo</a></p>`,
  );

  console.log(`Документация собрана: ${OUT}`);
  for (const page of pages) {
    console.log(`  ${page.output} — ${page.headings.length} разделов`);
  }
}

main();
