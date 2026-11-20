'use strict';

/**
 * «Градиентная обводка» — переливающаяся рамка вокруг ролика в ленте или по
 * краю окна приложения.
 *
 * Вся работа — один блок CSS, который собирается из настроек плагина и
 * вставляется через octo.page.injectCSS. Никаких скриптов на странице, сети и
 * доступа к её данным: только оформление. Вставленный CSS остаётся на странице
 * до выключения плагина, поэтому каждая новая настройка добавляет блок, который
 * перекрывает предыдущий, а не пытается удалить старое.
 */

// data-e2e у TikTok стабильнее хешированных классов. article:has(video) —
// запасной вариант для разметки, где обёртку переименовали.
const FEED_TARGETS = [
  '[data-e2e="recommend-list-item-container"]',
  '[data-e2e="browse-video"]',
  '[data-e2e="feed-item"]',
  '[data-e2e="feed-video"]',
  'article:has(video)',
];

const FEED_PSEUDO = FEED_TARGETS.map((selector) => `${selector}::after`).join(', ');
const RESET_TARGETS = `${FEED_PSEUDO}, html::after`;

const SCOPES = ['feed', 'window', 'both'];
const MODES = ['spin', 'flow', 'pulse', 'none'];

const PRESETS = {
  tiktok: ['#25f4ee', '#fe2c55', '#8a2be2'],
  neon: ['#00f5d4', '#00bbf9', '#f15bb5'],
  sunset: ['#ffd166', '#ff6b6b', '#9b5de5'],
  ocean: ['#7ae7c7', '#00bbf9', '#004e92'],
  aurora: ['#00ffa3', '#00c2ff', '#b967ff'],
  mono: ['#ffffff', '#b9c2cc', '#ffffff'],
};

const DEFAULT_COLORS = PRESETS.tiktok;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

let effect = null;
let lastCss = '';
let applied = false;
let applyTimer = null;

function pickNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function pickColor(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return HEX_COLOR_RE.test(text) ? text : fallback;
}

function readSettings(raw) {
  const values = raw && typeof raw === 'object' ? raw : {};
  const scope = SCOPES.includes(values.scope) ? values.scope : 'feed';
  const mode = MODES.includes(values.mode) ? values.mode : 'spin';
  const palette =
    values.palette === 'custom' || Object.prototype.hasOwnProperty.call(PRESETS, values.palette)
      ? values.palette
      : 'tiktok';
  const colors =
    palette === 'custom'
      ? [
          pickColor(values.color_one, DEFAULT_COLORS[0]),
          pickColor(values.color_two, DEFAULT_COLORS[1]),
          pickColor(values.color_three, DEFAULT_COLORS[2]),
        ]
      : PRESETS[palette].slice();

  effect = {
    enabled: values.enabled !== false,
    scope,
    mode,
    colors,
    thickness: Math.round(pickNumber(values.thickness, 1, 24, 4)),
    radius: Math.round(pickNumber(values.radius, 0, 80, 18)),
    offset: Math.round(pickNumber(values.offset, 0, 24, 0)),
    speed: pickNumber(values.speed, 0.5, 20, 4),
    glow: Math.round(pickNumber(values.glow, 0, 60, 12)),
    opacity: pickNumber(values.opacity, 0.05, 1, 0.9),
    reduceMotion: values.reduce_motion !== false,
  };
}

function gradientFor(current) {
  const [first, second, third] = current.colors;
  if (current.mode === 'flow') {
    return (
      `linear-gradient(115deg, ${first} 0%, ${second} 25%, ${third} 50%, ` +
      `${second} 75%, ${first} 100%)`
    );
  }
  if (current.mode === 'none') {
    return `conic-gradient(from 135deg, ${first}, ${second}, ${third}, ${first})`;
  }
  return `conic-gradient(from var(--octo-gf-angle), ${first}, ${second}, ${third}, ${first})`;
}

function glowFor(current) {
  if (current.glow <= 0) return 'none';
  const inner = Math.max(1, Math.round(current.glow * 0.45));
  return (
    `drop-shadow(0 0 ${inner}px ${current.colors[0]}) ` +
    `drop-shadow(0 0 ${current.glow}px ${current.colors[1]})`
  );
}

function animationFor(current) {
  if (current.mode === 'spin') return `octo-gf-spin ${current.speed}s linear infinite`;
  if (current.mode === 'flow') return `octo-gf-flow ${current.speed}s linear infinite`;
  if (current.mode === 'pulse') {
    return `octo-gf-pulse ${current.speed}s ease-in-out infinite alternate`;
  }
  return '';
}

function ringDeclarations(current, position) {
  return [
    "content: '' !important",
    `position: ${position} !important`,
    `inset: ${current.offset}px !important`,
    'box-sizing: border-box !important',
    `padding: ${current.thickness}px !important`,
    `border-radius: ${current.radius}px !important`,
    `background: ${gradientFor(current)} !important`,
    'background-size: 300% 100% !important',
    'background-position: 0% 50%',
    '-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0) !important',
    '-webkit-mask-composite: xor !important',
    'mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0) !important',
    'mask-composite: exclude !important',
    `opacity: ${current.opacity}`,
    `--octo-gf-opacity: ${current.opacity}`,
    `filter: ${glowFor(current)} !important`,
    'pointer-events: none !important',
    'z-index: 2147483000 !important',
  ].join(';\n    ');
}

function buildCss() {
  const current = effect;
  if (!current) return '';
  const reset = [
    `${RESET_TARGETS} {`,
    '    content: none !important;',
    '    animation: none !important;',
    '    filter: none !important;',
    '    background: none !important;',
    '    opacity: 0;',
    '    pointer-events: none !important;',
    '  }',
  ].join('\n');

  if (!current.enabled) return reset;

  const blocks = [reset];
  const drawFeed = current.scope === 'feed' || current.scope === 'both';
  const drawWindow = current.scope === 'window' || current.scope === 'both';

  if (drawFeed) {
    blocks.push(`${FEED_TARGETS.join(',\n  ')} {\n    position: relative !important;\n  }`);
    blocks.push(`${FEED_PSEUDO} {\n    ${ringDeclarations(current, 'absolute')};\n  }`);
  }
  if (drawWindow) {
    blocks.push(`html::after {\n    ${ringDeclarations(current, 'fixed')};\n  }`);
  }

  const animation = animationFor(current);
  if (animation) {
    const target =
      drawFeed && drawWindow
        ? `${FEED_PSEUDO}, html::after`
        : drawFeed
          ? FEED_PSEUDO
          : 'html::after';
    const rule = `${target} {\n    animation: ${animation} !important;\n  }`;
    if (current.reduceMotion) {
      blocks.push(`@media (prefers-reduced-motion: no-preference) {\n  ${rule}\n}`);
    } else {
      blocks.push(rule);
    }
  }

  blocks.push(
    [
      '@property --octo-gf-angle {',
      "  syntax: '<angle>';",
      '  inherits: false;',
      '  initial-value: 0deg;',
      '}',
      '@keyframes octo-gf-spin {',
      '  to {',
      '    --octo-gf-angle: 360deg;',
      '  }',
      '}',
      '@keyframes octo-gf-flow {',
      '  to {',
      '    background-position: -300% 50%;',
      '  }',
      '}',
      '@keyframes octo-gf-pulse {',
      '  from {',
      '    opacity: calc(var(--octo-gf-opacity) * 0.35);',
      '  }',
      '  to {',
      '    opacity: var(--octo-gf-opacity);',
      '  }',
      '}',
    ].join('\n'),
  );

  return blocks.join('\n\n');
}

async function applyCss() {
  const css = buildCss();
  if (applied && css === lastCss) return;
  try {
    await octo.page.injectCSS(css);
    lastCss = css;
    applied = true;
  } catch (error) {
    applied = false;
    octo.log('Не удалось применить обводку:', error && error.message ? error.message : error);
  }
}

function scheduleApply() {
  if (applyTimer) clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    applyTimer = null;
    applyCss();
  }, 180);
}

octo.onActivate(() => {
  readSettings(octo.settings.get());
});

octo.onPageReady(() => {
  if (!effect) readSettings(octo.settings.get());
  scheduleApply();
});

octo.onSettingsChange((values) => {
  readSettings(values);
  scheduleApply();
});

octo.onDeactivate(() => {
  if (applyTimer) clearTimeout(applyTimer);
  applyTimer = null;
});
