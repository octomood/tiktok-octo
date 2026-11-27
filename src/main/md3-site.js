'use strict';

/**
 * Оформление всего сайта TikTok в стиле Material Design 3 Expressive.
 *
 * Палитра (#3e3854 / #8c84a9 / #ddd2e0) совпадает с оболочкой приложения в
 * `src/renderer/styles.css` и автоматически переключается между тёмным и
 * светлым вариантом вслед за настройкой темы.
 *
 * Стили вставляются как user-origin CSS (`cssOrigin: 'user'`), пробрасываются
 * во вложенные фреймы (Business Suite, Studio) и открытые Shadow DOM-корни
 * (TUX-компоненты). Для границ используем `box-shadow: inset`, чтобы не менять
 * геометрию и не ломать сетку сайта.
 *
 * Важно про обёртки TUX: библиотека TikTok вешает классы вроде
 * `TUXTooltip-reference` и `TUXPopover-reference` прямо вокруг кнопок и
 * пунктов сайдбара. Поэтому тултипы, меню и модалки стилизуются по семантическим
 * ARIA-ролям (`[role="tooltip"]`, `[role="menu"]`, `[role="dialog"]`), а не
 * широкими масками `[class*="TUXTooltip"]`, чтобы никогда не красить обёртки.
 */

const { DEFAULT_PALETTE, getPaletteTokens } = require('./md3-palettes');

const MD3_ATTR = 'data-octo-md3';
const ACCENT_ATTR = 'data-octo-md3-accent';
const NAV_ATTR = 'data-octo-md3-nav';
const POS_ATTR = 'data-octo-md3-pos';
const BTN_GROUP_ATTR = 'data-octo-md3-btn';
const ICON_ATTR = 'data-octo-md3-icon';
const ACTION_ATTR = 'data-octo-md3-action';
const SURFACE_ATTR = 'data-octo-md3-surface';
const FG_ATTR = 'data-octo-md3-fg';
const CHAT_LAYOUT_ATTR = 'data-octo-md3-chat-layout';

const DARK_TOKENS = getPaletteTokens(DEFAULT_PALETTE, true);
const LIGHT_TOKENS = getPaletteTokens(DEFAULT_PALETTE, false);

function tokenDeclarations(dark, paletteId = DEFAULT_PALETTE) {
  const t = getPaletteTokens(paletteId, dark);
  return `
    color-scheme: ${t.scheme} !important;
    --octo-md-primary: ${t.primary} !important;
    --octo-md-on-primary: ${t.onPrimary} !important;
    --octo-md-primary-container: ${t.primaryContainer} !important;
    --octo-md-on-primary-container: ${t.onPrimaryContainer} !important;
    --octo-md-secondary: ${t.secondary} !important;
    --octo-md-on-secondary: ${t.onSecondary} !important;
    --octo-md-secondary-container: ${t.secondaryContainer} !important;
    --octo-md-on-secondary-container: ${t.onSecondaryContainer} !important;
    --octo-md-tertiary: ${t.tertiary} !important;
    --octo-md-on-tertiary: ${t.onTertiary} !important;
    --octo-md-tertiary-container: ${t.tertiaryContainer} !important;
    --octo-md-on-tertiary-container: ${t.onTertiaryContainer} !important;
    --octo-md-error: ${t.error} !important;
    --octo-md-on-error: ${t.onError} !important;
    --octo-md-error-container: ${t.errorContainer} !important;
    --octo-md-on-error-container: ${t.onErrorContainer} !important;
    --octo-md-surface-dim: ${t.surfaceDim} !important;
    --octo-md-surface: ${t.surface} !important;
    --octo-md-surface-container-lowest: ${t.surfaceContainerLowest} !important;
    --octo-md-surface-container-low: ${t.surfaceContainerLow} !important;
    --octo-md-surface-container: ${t.surfaceContainer} !important;
    --octo-md-surface-container-high: ${t.surfaceContainerHigh} !important;
    --octo-md-surface-container-highest: ${t.surfaceContainerHighest} !important;
    --octo-md-on-surface: ${t.onSurface} !important;
    --octo-md-on-surface-variant: ${t.onSurfaceVariant} !important;
    --octo-md-outline: ${t.outline} !important;
    --octo-md-outline-variant: ${t.outlineVariant} !important;
    --octo-md-inverse-surface: ${t.inverseSurface} !important;
    --octo-md-inverse-on-surface: ${t.inverseOnSurface} !important;
    --octo-md-state-hover: ${t.stateHover} !important;
    --octo-md-state-pressed: ${t.statePressed} !important;
    --octo-md-scrim: ${t.scrim} !important;
    --octo-md-elevation-1: ${t.elevation1} !important;
    --octo-md-elevation-2: ${t.elevation2} !important;
    --octo-md-elevation-3: ${t.elevation3} !important;
    --octo-md-ease: cubic-bezier(0.2, 0, 0, 1);
    --octo-md-motion-scale: 1 !important;

    /* TUX (TikTok UI Kit) — системная перекраска встроенных компонентов */
    --tux-colorBGPrimary: ${t.surface} !important;
    --tux-colorBGSecondary: ${t.surfaceContainerLow} !important;
    --tux-colorBGTertiary: ${t.surfaceContainer} !important;
    --tux-colorBGQuaternary: ${t.surfaceContainerHigh} !important;
    --tux-colorBGView: ${t.surfaceContainerLow} !important;
    --tux-colorBGView2: ${t.surfaceContainer} !important;
    --tux-colorBGReverse: ${t.surfaceContainerHighest} !important;
    --tux-colorBGInput: ${t.surfaceContainerHigh} !important;
    --tux-colorBGInput2: ${t.surfaceContainerHighest} !important;
    --tux-colorBGPlaceholderOpaque: ${t.surfaceContainerHigh} !important;
    --tux-colorBGPlaceholderDefault: ${t.surfaceContainer} !important;
    --tux-colorBGCreation: ${t.surfaceContainerLow} !important;
    --tux-colorBGCreation2: ${t.surfaceContainer} !important;
    --tux-colorBGCreation3: ${t.surfaceContainerHigh} !important;
    --tux-colorBGBrand: ${t.primary} !important;
    --tux-colorBGBrand2: ${t.primaryContainer} !important;
    --tux-colorFillBrand: ${t.primary} !important;
    --tux-colorBrand: ${t.primary} !important;
    --tux-colorPrimary: ${t.primary} !important;
    --tux-colorPrimary2: ${t.primary} !important;
    --tux-colorPrimaryTint: ${t.primaryContainer} !important;
    --tux-colorPrimaryOpacity12: ${t.statePressed} !important;
    --tux-colorPrimaryOpacity8: ${t.stateHover} !important;
    --tux-colorLink: ${t.primary} !important;
    --tux-colorTextBrand: ${t.primary} !important;
    --tux-colorAssistColorRed: ${t.primary} !important;
    --tux-colorAssistColorBlue: ${t.primary} !important;
    --tux-colorSecondary: ${t.secondary} !important;
    --tux-colorTextPrimary: ${t.onSurface} !important;
    --tux-colorTextSecondary: ${t.onSurfaceVariant} !important;
    --tux-colorTextTertiary: ${t.outline} !important;
    --tux-colorTextQuaternary: ${t.outline} !important;
    --tux-colorTextPrimaryInverse: ${t.inverseOnSurface} !important;
    --tux-colorTextConstWhite: #ffffff !important;
    --tux-colorLinePrimary: ${t.outlineVariant} !important;
    --tux-colorLineSecondary: ${t.outlineVariant} !important;
    --tux-colorLineInput: ${t.outline} !important;
    --tux-colorSDPrimary: ${t.scrim} !important;
    --tux-colorSDSecondary: ${t.scrim} !important;
    --tux-colorToast: ${t.inverseSurface} !important;
    --ui-bg-primary: ${t.surface} !important;
    --ui-bg-secondary: ${t.surfaceContainerLow} !important;
    --ui-text-primary: ${t.onSurface} !important;
    --ui-text-secondary: ${t.onSurfaceVariant} !important;
    --ui-color-primary: ${t.primary} !important;

    /* live_new / Tailwind v4 & TUX v2 (Трансляции) */
    --bg-base: ${t.surfaceContainerLow} !important;
    --bg-creation: ${t.surfaceContainerLow} !important;
    --bg-primary: ${t.surfaceContainerLow} !important;
    --bg-secondary-2: ${t.surfaceContainer} !important;
    --bg-tertiary: ${t.surfaceContainer} !important;
    --bg-quaternary: ${t.surfaceContainerHigh} !important;
    --bg-quinary: ${t.surfaceContainerHighest} !important;
    --bg-view: ${t.surfaceContainerLow} !important;
    --bg-input: ${t.surfaceContainerHigh} !important;
    --bg-input-2: ${t.surfaceContainer} !important;
    --bg-inverse-3: color-mix(in srgb, ${t.surfaceContainerHigh} 78%, transparent) !important;
    --BG-Dark-BGLevitation: ${t.surfaceContainerHigh} !important;
    --primary: ${t.primary} !important;
    --primary-2: ${t.onSurface} !important;
    --live-color-start: ${t.primary} !important;
    --live-color-end: ${t.secondary} !important;
    --text-primary: ${t.onSurface} !important;
    --text-secondary: ${t.onSurfaceVariant} !important;
    --text-tertiary: ${t.outline} !important;
    --text-tertiary-2: ${t.onSurfaceVariant} !important;
    --text-tertiary-alt: ${t.onSurfaceVariant} !important;
    --text-quaternary: ${t.outline} !important;
    --text-reverse: ${t.onSurface} !important;
    --text-reverse-2: ${t.onSurfaceVariant} !important;
    --const-text-primary: ${t.inverseOnSurface} !important;
    --line-primary: color-mix(in srgb, ${t.outlineVariant} 45%, transparent) !important;
    --line-primary-2: color-mix(in srgb, ${t.outlineVariant} 55%, transparent) !important;
    --line-secondary: color-mix(in srgb, ${t.outlineVariant} 42%, transparent) !important;
    --line-reverse-2: color-mix(in srgb, ${t.outlineVariant} 42%, transparent) !important;
    --ui-page-flat-1: ${t.surface} !important;
    --ui-page-flat-2: ${t.surfaceContainerLow} !important;
    --ui-page-flat-3: ${t.surfaceContainer} !important;
    --ui-page-grouped-1: ${t.surface} !important;
    --ui-page-grouped-2: ${t.surfaceContainerLow} !important;
    --ui-page-grouped-3: ${t.surfaceContainer} !important;
    --ui-sheet-flat-1: ${t.surfaceContainerLow} !important;
    --ui-sheet-flat-2: ${t.surfaceContainer} !important;
    --ui-sheet-flat-3: ${t.surfaceContainerHigh} !important;
    --ui-sheet-grouped-1: ${t.surfaceContainerLow} !important;
    --ui-sheet-grouped-2: ${t.surfaceContainer} !important;
    --ui-sheet-grouped-3: ${t.surfaceContainerHigh} !important;
    --ui-shape-primary: ${t.primary} !important;
    --ui-shape-primary-2: color-mix(in srgb, ${t.primary} 60%, transparent) !important;
    --ui-shape-primary-3: color-mix(in srgb, ${t.primary} 42%, transparent) !important;
    --ui-shape-primary-4: color-mix(in srgb, ${t.primary} 24%, transparent) !important;
    --ui-shape-text-1-on-primary: ${t.onPrimary} !important;
    --ui-shape-neutral: ${t.onSurface} !important;
    --ui-shape-neutral-2: color-mix(in srgb, ${t.onSurface} 24%, transparent) !important;
    --ui-shape-neutral-3: color-mix(in srgb, ${t.onSurface} 14%, transparent) !important;
    --ui-shape-neutral-4: color-mix(in srgb, ${t.onSurface} 8%, transparent) !important;
    --ui-shape-text-1-on-neutral: ${t.surface} !important;
    --ui-text-1: ${t.onSurface} !important;
    --ui-text-1-display: ${t.onSurface} !important;
    --ui-text-2: ${t.onSurfaceVariant} !important;
    --ui-text-3: ${t.outline} !important;
    --ui-text-placeholder: ${t.outline} !important;
    --ui-text-primary: ${t.primary} !important;
    --ui-text-primary-display: ${t.primary} !important;
    --tux-v2-color-ui-page-flat-1: ${t.surface} !important;
    --tux-v2-color-ui-page-flat-2: ${t.surfaceContainerLow} !important;
    --tux-v2-color-ui-page-flat-3: ${t.surfaceContainer} !important;
    --tux-v2-color-ui-page-grouped-1: ${t.surface} !important;
    --tux-v2-color-ui-page-grouped-2: ${t.surfaceContainerLow} !important;
    --tux-v2-color-ui-page-grouped-3: ${t.surfaceContainer} !important;
    --tux-v2-color-ui-sheet-flat-1: ${t.surfaceContainerLow} !important;
    --tux-v2-color-ui-sheet-flat-2: ${t.surfaceContainer} !important;
    --tux-v2-color-ui-sheet-flat-3: ${t.surfaceContainerHigh} !important;
    --tux-v2-color-ui-sheet-grouped-1: ${t.surfaceContainerLow} !important;
    --tux-v2-color-ui-sheet-grouped-2: ${t.surfaceContainer} !important;
    --tux-v2-color-ui-sheet-grouped-3: ${t.surfaceContainerHigh} !important;
    --tux-v2-color-ui-sheet-backdrop-1: ${t.scrim} !important;
    --tux-v2-color-ui-sheet-backdrop-2: color-mix(in srgb, ${t.scrim} 72%, transparent) !important;
    --tux-v2-color-ui-shape-primary: ${t.primary} !important;
    --tux-v2-color-ui-shape-primary-2: color-mix(in srgb, ${t.primary} 60%, transparent) !important;
    --tux-v2-color-ui-shape-primary-3: color-mix(in srgb, ${t.primary} 42%, transparent) !important;
    --tux-v2-color-ui-shape-primary-4: color-mix(in srgb, ${t.primary} 24%, transparent) !important;
    --tux-v2-color-ui-shape-text-1-on-primary: ${t.onPrimary} !important;
    --tux-v2-color-ui-shape-text-2-on-primary: ${t.onPrimaryContainer} !important;
    --tux-v2-color-ui-shape-neutral: ${t.onSurface} !important;
    --tux-v2-color-ui-shape-neutral-2: color-mix(in srgb, ${t.onSurface} 24%, transparent) !important;
    --tux-v2-color-ui-shape-neutral-3: color-mix(in srgb, ${t.onSurface} 14%, transparent) !important;
    --tux-v2-color-ui-shape-neutral-4: color-mix(in srgb, ${t.onSurface} 8%, transparent) !important;
    --tux-v2-color-ui-shape-text-1-on-neutral: ${t.surface} !important;
    --tux-v2-color-ui-text-1: ${t.onSurface} !important;
    --tux-v2-color-ui-text-1-display: ${t.onSurface} !important;
    --tux-v2-color-ui-text-2: ${t.onSurfaceVariant} !important;
    --tux-v2-color-ui-text-3: ${t.outline} !important;
    --tux-v2-color-ui-text-placeholder: ${t.outline} !important;
    --tux-v2-color-ui-text-primary: ${t.primary} !important;
    --tux-v2-color-ui-text-primary-display: ${t.primary} !important;
    --tux-v2-color-misc-toast-background: ${t.inverseSurface} !important;
    --tux-v2-color-misc-tooltip-background: ${t.inverseSurface} !important;
    --tux-v2-color-misc-tooltip-text-1: ${t.inverseOnSurface} !important;
    --tux-v2-color-brand-tiktok-background: ${t.surface} !important;
    --tux-v2-color-brand-tiktok-neutral-background: ${t.surface} !important;
    --tux-v2-color-brand-tiktok-neutral-foreground: ${t.onSurface} !important;
    --tux-v2-color-brand-tiktok-razzmatazz: ${t.primary} !important;
    --tux-v2-color-brand-tiktok-splash: ${t.secondary} !important;
    --tux-v2-color-live-brand-1: ${t.primary} !important;
    --tux-v2-color-live-brand-2: ${t.secondary} !important;
    --tux-v2-color-live-foundation-background-1: color-mix(in srgb, ${t.surfaceContainer} 78%, transparent) !important;
    --tux-v2-color-live-foundation-shape-1: color-mix(in srgb, ${t.surfaceContainerHigh} 72%, transparent) !important;
    --tux-v2-color-live-foundation-shape-2: ${t.surfaceContainerHigh} !important;
    --tux-v2-color-live-revenue-recharge-shape-1: ${t.surfaceContainerHigh} !important;
    --tux-v2-color-live-revenue-recharge-shape-2: color-mix(in srgb, ${t.surfaceContainerHigh} 76%, transparent) !important;

    /* Semi / Arco Design (Business Suite, Studio, web_dm) */
    --semi-color-bg-0: ${t.surface} !important;
    --semi-color-bg-1: ${t.surfaceContainerLow} !important;
    --semi-color-bg-2: ${t.surfaceContainer} !important;
    --semi-color-bg-3: ${t.surfaceContainerHigh} !important;
    --semi-color-bg-4: ${t.surfaceContainerHighest} !important;
    --semi-color-fill-0: ${t.surfaceContainer} !important;
    --semi-color-fill-1: ${t.surfaceContainerHigh} !important;
    --semi-color-fill-2: ${t.surfaceContainerHighest} !important;
    --semi-color-text-0: ${t.onSurface} !important;
    --semi-color-text-1: ${t.onSurfaceVariant} !important;
    --semi-color-text-2: ${t.outline} !important;
    --semi-color-text-3: ${t.outline} !important;
    --semi-color-primary: ${t.primary} !important;
    --semi-color-primary-hover: ${t.primary} !important;
    --semi-color-primary-active: ${t.primary} !important;
    --semi-color-link: ${t.secondary} !important;
    --semi-color-border: ${t.outlineVariant} !important;
    --color-bg-1: ${t.surface} !important;
    --color-bg-2: ${t.surfaceContainerLow} !important;
    --color-bg-3: ${t.surfaceContainer} !important;
    --color-bg-4: ${t.surfaceContainerHigh} !important;
    --color-bg-5: ${t.surfaceContainerHighest} !important;
    --color-fill-1: ${t.surfaceContainer} !important;
    --color-fill-2: ${t.surfaceContainerHigh} !important;
    --color-fill-3: ${t.surfaceContainerHighest} !important;
    --color-border: ${t.outlineVariant} !important;
    --color-border-1: ${t.outlineVariant} !important;
    --color-border-2: ${t.outlineVariant} !important;
    --color-text-1: ${t.onSurface} !important;
    --color-text-2: ${t.onSurfaceVariant} !important;
    --color-text-3: ${t.outline} !important;
    --color-background-primary: ${t.surface} !important;
    --color-background-secondary: ${t.surfaceContainerLow} !important;
    --color-text-primary: ${t.onSurface} !important;
    --color-text-secondary: ${t.onSurfaceVariant} !important;
  `;
}

const EXPRESSIVE_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900' fill='none'%3E%3Crect x='250' y='96' width='220' height='98' rx='49' transform='rotate(-18 360 145)' fill='%233e3854' fill-opacity='0.34'/%3E%3Cpath d='M335 560c22-40 78-40 100 0 18 32 58 39 85 15 34-30 90-2 85 45-4 36 25 66 60 63 46-4 75 50 45 85-24 28-16 68 15 85 40 22 40 78 0 100-32 18-39 58-15 85 30 34 2 90-45 85-36-4-66 25-63 60 4 46-50 75-85 45-28-24-68-16-85 15-22 40-78 40-100 0-18-32-58-39-85-15-34 30-90 2-85-45 4-36-25-66-60-63-46 4-75-50-45-85 24-28 16-68-15-85-40-22-40-78 0-100 32-18 39-58 15-85-30-34-2-90 45-85 36 4 66-25 63-60-4-46 50-75 85-45 28 24 68 16 85-15Z' fill='%238c84a9' fill-opacity='0.065'/%3E%3Cpath d='M1040 110q11 58 69 69-58 11-69 69-11-58-69-69 58-11 69-69Z' fill='%23ddd2e0' fill-opacity='0.065'/%3E%3Crect x='1100' y='240' width='200' height='200' rx='58' transform='rotate(22 1200 340)' fill='%233e3854' fill-opacity='0.24'/%3E%3Cpath d='M1190 610c14-26 50-26 64 0 12 21 38 25 56 10 22-20 59-1 55 29-3 24 16 43 40 41 30-3 49 33 29 56-16 18-11 44 10 55 26 14 26 50 0 64-21 12-25 38-10 56 20 22 1 59-29 55-24-3-43 16-41 40 3 30-33 49-56 29-18-16-44-11-55 10-14 26-50 26-64 0-12-21-38-25-56-10-22 20-59 1-55-29 3-24-16-43-40-41-30 3-49-33-29-56 16-18 11-44-10-55-26-14-26-50 0-64 21-12 25-38 10-56-20-22-1-59 29-55 24 3 43-16 41-40-3-30 33-49 56-29 18 16 44 11 55-10Z' fill='%238c84a9' fill-opacity='0.075'/%3E%3Crect x='230' y='340' width='90' height='42' rx='21' transform='rotate(32 275 361)' stroke='%238c84a9' stroke-opacity='0.14' stroke-width='2'/%3E%3Cpath d='M950 510q7 34 41 41-34 7-41 41-7-34-41-41 34-7 41-41Z' fill='%238c84a9' fill-opacity='0.1'/%3E%3C/svg%3E")`;

const BASE_CANVAS_CSS = `
  /* --- Базовый холст, MD3 Expressive фигуры фона и выделение --------------- */
  :where(html, body) {
    background-color: var(--octo-md-surface) !important;
    color: var(--octo-md-on-surface) !important;
  }

  ::selection {
    background-color: var(--octo-md-primary-container) !important;
    color: var(--octo-md-on-primary-container) !important;
  }

  #app,
  #root {
    background-color: transparent !important;
    background-image: none !important;
    color: var(--octo-md-on-surface) !important;
  }

  body {
    background-image:
      ${EXPRESSIVE_BG},
      radial-gradient(640px 440px at 26% 14%, color-mix(in srgb, var(--octo-md-primary) 12%, transparent), transparent 70%),
      radial-gradient(580px 420px at 76% 84%, color-mix(in srgb, var(--octo-md-primary-container) 34%, transparent), transparent 72%) !important;
    background-repeat: no-repeat, no-repeat, no-repeat !important;
    background-size: cover, auto, auto !important;
    background-position: center, center, center !important;
  }

  [${MD3_ATTR}="light"] body {
    background-image:
      ${EXPRESSIVE_BG},
      radial-gradient(640px 440px at 26% 14%, color-mix(in srgb, var(--octo-md-primary) 14%, transparent), transparent 70%),
      radial-gradient(580px 420px at 76% 84%, color-mix(in srgb, var(--octo-md-primary-container) 55%, transparent), transparent 72%) !important;
  }

  video {
    background-color: transparent !important;
    background-image: none !important;
  }
`;

/**
 * Длительность перехода скина. Умножается на `--octo-md-motion-scale`, который
 * при системной настройке «Уменьшить движение» становится `0`: правила скина
 * объявлены с `!important` и высокой специфичностью, поэтому общее правило
 * `* { transition-duration }` их бы не перекрыло.
 */
function motion(seconds) {
  return `calc(${seconds}s * var(--octo-md-motion-scale, 1))`;
}

function reducedMotionCss(selector) {
  return `
    @media (prefers-reduced-motion: reduce) {
      ${selector} {
        --octo-md-motion-scale: 0 !important;
      }
    }
  `;
}

const COMPONENT_CSS = `

  [class*="DivBodyContainer"],
  [class*="DivLayoutContainer"],
  [class*="DivMainContainer"],
  [class*="DivBrowserModeContainer"],
  [${SURFACE_ATTR}="page"],
  main:not([id^="octo-"]),
  [role="main"]:not([id^="octo-"]),
  [id^="main-content-"],
  [class*="DivPageContainer"],
  [class*="DivFeedContainer"],
  [class*="DivFeedWrapper"],
  [class*="DivFeedLayout"],
  [class*="OneColumn"],
  [class*="DivColumnContainer"],
  [class*="DivRecommendList"],
  [class*="DivColumnListContainer"],
  [data-e2e="recommend-list-item-container"],
  [class*="DivItemContainerV2"],
  [class*="DivBlurBackground"],
  [class*="DivVideoBlur"],
  [class*="PlayerBlur"],
  [class*="DivExploreContainer"],
  [class*="DivLiveContainer"],
  [class*="DivProfileLayout"] {
    background-color: transparent !important;
    background-image: none !important;
    color: var(--octo-md-on-surface) !important;
  }

  video {
    background-color: transparent !important;
    background-image: none !important;
  }

  /* --- Левый рельс / Drawer навигации в MD3 -------------------------------
     Сбрасываем фон у внутренних обёрток и неактивных пунктов; активным делаем
     только реальный текущий раздел, не задевая классы с подстрокой active
     (Interactive / Inactive). */
  [class*="DivSideNavContainer"],
  [${SURFACE_ATTR}="sidenav"] {
    background-color: var(--octo-md-surface-container-low) !important;
    border-inline-end: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
    box-sizing: border-box !important;
    flex-shrink: 0 !important;
  }

  [class*="DivMainContainer"],
  main:not([id^="octo-"]),
  [role="main"]:not([id^="octo-"]),
  [id^="main-content-"] {
    min-width: 0 !important;
  }

  [class*="DivSideNavContainer"] > div:not([${SURFACE_ATTR}="drawer"]),
  [class*="DivSideNavContainer"] nav,
  [class*="DivSideNavContainer"] section:not([${SURFACE_ATTR}="drawer"]),
  [class*="DivSideNavContainer"] [class*="Scroll"]:not([${SURFACE_ATTR}="drawer"] *),
  [class*="DivSideNavContainer"] [class*="Wrapper"]:not([${SURFACE_ATTR}="drawer"]):not([${SURFACE_ATTR}="drawer"] *),
  [class*="DivSideNavContainer"] [class*="Container"]:not([class*="Login"]):not([data-e2e="search-box"]):not([${SURFACE_ATTR}="drawer"]):not([${SURFACE_ATTR}="drawer"] *),
  [${SURFACE_ATTR}="sidenav"] :is(div, nav, section, aside, ul, li):not([${SURFACE_ATTR}="drawer"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-search"] *):not([${SURFACE_ATTR}="sidenav-creator"]):not([${SURFACE_ATTR}="sidenav-creator"] *):not([${SURFACE_ATTR}="sidenav-footer"]):not([${SURFACE_ATTR}="sidenav-footer"] *):not([${POS_ATTR}]):not([class*="DivUserContainer"]):not([class*="DivAccountItem"]):not([class*="DivLoginContainer"]):not([data-e2e="search-box"]):not([data-e2e="inbox-badge"]):not([class*="Badge"]):not([${ACCENT_ATTR}="badge"]):not([class*="Avatar"]):not([role="button"]):not([role="switch"]):not([id^="octo-"]) {
    background-color: transparent !important;
    background-image: none !important;
  }

  /* Выдвижные панели и подменю сайдбара («Ещё», «Язык», «Инструменты») */
  [${SURFACE_ATTR}="drawer"] {
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 16px !important;
    box-shadow:
      var(--octo-md-elevation-3),
      inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 48%, transparent) !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(div, section, header, ul, li, a, button, [role="button"], [role="menuitem"]):not([role="switch"]):not([${ACCENT_ATTR}="badge"]):not([class*="Badge"]):not([aria-pressed="true"]):not([aria-selected="true"]):not([data-active="true"]):not([class*="Active"]):not([${SURFACE_ATTR}="chip-bar"]):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([id^="octo-"]) {
    background-color: transparent !important;
    background-image: none !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="drawer-segmented"] {
    display: inline-flex !important;
    flex: none !important;
    gap: 3px !important;
    padding: 3px !important;
    border-radius: 9999px !important;
    background-color: var(--octo-md-surface-container-high) !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="drawer-segmented"] > button {
    border-radius: 6px !important;
    margin: 0 !important;
    min-width: 28px !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="drawer-segmented"] > button:first-child {
    border-radius: 24px 6px 6px 24px !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="drawer-segmented"] > button:last-child {
    border-radius: 6px 24px 24px 6px !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="drawer-segmented"] > button:is([aria-pressed="true"], [aria-selected="true"], [data-active="true"], [class*="Active"]) {
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    border-radius: 24px !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="chip-bar"] {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 0 !important;
    border-radius: 0 !important;
    background-color: transparent !important;
    overflow: visible !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not([${SURFACE_ATTR}="drawer-segmented"] *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]) {
    border-radius: 6px !important;
    margin-bottom: 4px !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      border-radius ${motion(0.2)} var(--octo-md-ease) !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not([${SURFACE_ATTR}="drawer-segmented"] *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]):first-child {
    border-top-left-radius: 14px !important;
    border-top-right-radius: 14px !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not([${SURFACE_ATTR}="drawer-segmented"] *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]):last-child {
    border-bottom-left-radius: 14px !important;
    border-bottom-right-radius: 14px !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not([${SURFACE_ATTR}="drawer-segmented"] *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]):hover {
    background-color: var(--octo-md-state-hover) !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not([${SURFACE_ATTR}="drawer-segmented"] *) :is(div, span, p, a, button):not([${ACCENT_ATTR}="badge"]):not([class*="Badge"]),
  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not([${SURFACE_ATTR}="drawer-segmented"] *):hover :is(div, span, p, a, button):not([${ACCENT_ATTR}="badge"]):not([class*="Badge"]) {
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
  }

  [${SURFACE_ATTR}="drawer"] :is([${SURFACE_ATTR}="chip"], [${SURFACE_ATTR}="chip-active"]):not([id^="octo-"]) {
    display: inline-flex !important;
    align-items: center !important;
    border-radius: 24px !important;
    margin: 0 !important;
    padding: 6px 12px !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="chip"]:not([id^="octo-"]) {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface-variant) !important;
    border: 0 !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="chip"]:not([id^="octo-"]):hover {
    background-color: var(--octo-md-surface-container-highest) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 24px !important;
  }

  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="chip-active"]:not([id^="octo-"]),
  [${SURFACE_ATTR}="drawer"] [${SURFACE_ATTR}="chip-active"]:not([id^="octo-"]):hover {
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    box-shadow: none !important;
    border-radius: 24px !important;
    font-weight: 600 !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"]):where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([data-e2e="search-button"]):not([class*="Search"]):not([class*="Account"]:not([${POS_ATTR}])):not([class*="User"]:not([${POS_ATTR}])):not([class*="Coin"]):not([class*="Recharge"]):not([class*="Promote"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([${SURFACE_ATTR}="sidenav-footer"]):not([id^="octo-"])):not(:is(a, button, [role="button"]) *) {
    display: flex !important;
    align-items: center !important;
    min-height: 36px !important;
    padding-top: 5px !important;
    padding-bottom: 5px !important;
    margin-top: 0 !important;
    margin-bottom: 3px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) li,
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) ul {
    border: 0 !important;
    box-shadow: none !important;
    background-color: transparent !important;
  }

  [data-octo-md3-nav-slot-parent="1"] {
    gap: 0 !important;
    row-gap: 0 !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [data-octo-md3-nav-slot="wrapper"] {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 3px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [data-octo-md3-nav-slot="wrapper"] :where(div, span):not([${POS_ATTR}]):not([${POS_ATTR}] *) {
    height: auto !important;
    min-height: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [data-octo-md3-nav-slot="self"] {
    margin-top: 0 !important;
    margin-bottom: 3px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]):not([data-octo-md3-rail="collapsed"]) [data-octo-md3-nav-slot="wrapper"] [${POS_ATTR}] {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) a:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) button:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([data-e2e="search-button"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [role="button"]:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([data-e2e="search-button"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])) {
    max-width: 100% !important;
    box-sizing: border-box !important;
    background-color: var(--octo-md-surface-container) !important;
    background-image: none !important;
    border: 0 !important;
    outline: none !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 30%, transparent) !important;
    border-radius: 6px !important;
    color: var(--octo-md-on-surface-variant) !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      box-shadow ${motion(0.16)} var(--octo-md-ease),
      border-radius ${motion(0.22)} var(--octo-md-ease),
      color ${motion(0.16)} var(--octo-md-ease) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"])[${POS_ATTR}="first"] {
    border-radius: 16px 16px 6px 6px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"])[${POS_ATTR}="mid"] {
    border-radius: 6px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"])[${POS_ATTR}="last"] {
    border-radius: 6px 6px 16px 16px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"])[${POS_ATTR}="single"] {
    border-radius: 16px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) a:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])):hover,
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) button:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([data-e2e="search-button"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])):hover,
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [role="button"]:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([data-e2e="search-button"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])):hover {
    background-color: var(--octo-md-surface-container-high) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 68%, transparent) !important;
    color: var(--octo-md-on-surface) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] a:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] button:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([data-e2e="search-button"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [role="button"]:where(:not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([data-e2e="search-button"]):not([class*="Search"]):not([${SURFACE_ATTR}="drawer"] *):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([id^="octo-"])) {
    width: 44px !important;
    min-width: 44px !important;
    height: 44px !important;
    min-height: 44px !important;
    margin: 0 auto 3px !important;
    padding: 0 !important;
    justify-content: center !important;
    border-radius: 14px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [data-octo-md3-nav-slot="wrapper"] [${POS_ATTR}] {
    margin: 0 auto !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [data-octo-md3-nav-slot="self"] {
    margin: 0 auto 3px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] :is(button[class*="Search"], [${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="drawer"] *) {
    width: 44px !important;
    height: 44px !important;
    margin: 0 auto 8px !important;
    padding: 0 !important;
    justify-content: center !important;
    border-radius: 24px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [${SURFACE_ATTR}="sidenav-toggle"] {
    background-color: transparent !important;
    background-image: none !important;
    border: 0 !important;
    box-shadow: none !important;
    color: var(--octo-md-on-surface-variant) !important;
    border-radius: 9999px !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      color ${motion(0.16)} var(--octo-md-ease) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [${SURFACE_ATTR}="sidenav-toggle"]:hover {
    background-color: color-mix(in srgb, var(--octo-md-on-surface) 8%, transparent) !important;
    box-shadow: none !important;
    color: var(--octo-md-on-surface) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [${SURFACE_ATTR}="sidenav-header"] {
    width: 100% !important;
    box-sizing: border-box !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [${SURFACE_ATTR}="sidenav-header"] :where(div, span):not([${SURFACE_ATTR}="sidenav-toggle"]):not([${SURFACE_ATTR}="sidenav-toggle"] *):not([data-e2e="tiktok-logo"]):not([data-e2e="tiktok-logo"] *) {
    padding-left: 0 !important;
    padding-right: 0 !important;
    margin-left: auto !important;
    margin-right: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [data-e2e="tiktok-logo"],
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [data-octo-md3-logo="1"] {
    margin-left: auto !important;
    margin-right: auto !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    justify-content: center !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [${SURFACE_ATTR}="sidenav-toggle"] {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 44px !important;
    min-width: 44px !important;
    height: 44px !important;
    min-height: 44px !important;
    margin: 0 auto !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    border-radius: 9999px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"])[data-octo-md3-rail="collapsed"] [${SURFACE_ATTR}="sidenav-toggle"][data-octo-md3-toggle-abs="1"] {
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"])[${NAV_ATTR}="active"]:not([data-e2e="tiktok-logo"]):not([class*="Account"]):not([id^="octo-"]),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [data-e2e^="nav-"][${NAV_ATTR}="active"] {
    border-radius: 24px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"]):is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ):not([data-e2e="tiktok-logo"]):not([class*="Account"]):not([id^="octo-"]),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [data-e2e^="nav-"]:is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ) {
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    box-shadow: none !important;
    border: 0 !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"]):is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ):not([data-e2e="tiktok-logo"]):not([class*="Account"]):not([id^="octo-"]):hover,
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [data-e2e^="nav-"]:is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ):hover {
    background-color: color-mix(
      in srgb,
      var(--octo-md-secondary-container) 88%,
      var(--octo-md-on-surface)
    ) !important;
    color: var(--octo-md-on-secondary-container) !important;
  }

  /* Внутренние обёртки и вложенные ссылки/кнопки пунктов сайдбара не должны рисовать второй овал */
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"]):not([${SURFACE_ATTR}="sidenav-search"]) :is(div, span, p, a, button, [role="button"], [role="menuitem"], [data-e2e^="nav-"]):not([class*="Badge"]):not([class*="Sup"]):not([${ACCENT_ATTR}="badge"]):not([class*="Avatar"]):not([role="img"]),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"]):not([${SURFACE_ATTR}="sidenav-search"]) :is(div, span, p, a, button, [role="button"], [role="menuitem"], [data-e2e^="nav-"]):not([class*="Badge"]):not([class*="Sup"]):not([${ACCENT_ATTR}="badge"]):not([class*="Avatar"]):not([role="img"]):hover,
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"]):not([${SURFACE_ATTR}="sidenav-search"])::before,
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"]):not([${SURFACE_ATTR}="sidenav-search"])::after {
    background-color: transparent !important;
    background-image: none !important;
    border: 0 !important;
    outline: none !important;
    box-shadow: none !important;
  }

  /* Нижние служебные кнопки сайдбара («Приобрести монеты») не обрезаются */
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is([class*="Coin" i], [class*="Recharge" i], [class*="Promote" i], [${SURFACE_ATTR}="sidenav-footer"]),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [class*="Footer"] :is(a, button, [role="button"]) {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 40px !important;
    box-sizing: border-box !important;
    padding: 8px 12px !important;
    border-radius: 14px !important;
    justify-content: flex-start !important;
  }

  [${SURFACE_ATTR}="sidenav-footer"] {
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface-variant) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 38%, transparent) !important;
  }

  [${SURFACE_ATTR}="sidenav-footer"]:hover {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is([class*="Coin" i], [class*="Recharge" i], [class*="Promote" i], [${SURFACE_ATTR}="sidenav-footer"]) :where(span, p, div),
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [class*="Footer"] :is(a, button, [role="button"]) :where(span, p, div) {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    max-width: none !important;
    width: auto !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"]):is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ) :where(span, p, div):not([class*="Badge"]):not([class*="Badge"] *):not([class*="Sup"]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *) {
    color: var(--octo-md-on-secondary-container) !important;
  }

  /* Красный домик/иконки внутри сайдбара переводим в палитру MD3 */
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [${ICON_ATTR}="active"],
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :where(a, button):not([data-e2e="tiktok-logo"]) svg[${ICON_ATTR}="active"],
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :where(a, button):not([data-e2e="tiktok-logo"]) svg path:is(
    [fill="#FE2C55" i],
    [fill="#FF3B5C" i],
    [fill="#EA284E" i]
  ),
  [data-e2e^="nav-"] svg path:is(
    [fill="#FE2C55" i],
    [fill="#FF3B5C" i],
    [fill="#EA284E" i]
  ) {
    color: var(--octo-md-primary) !important;
    fill: var(--octo-md-primary) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ) :is(svg, svg path, [${ICON_ATTR}="active"]) {
    color: var(--octo-md-on-secondary-container) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ) svg path:not([fill="none"]) {
    fill: var(--octo-md-on-secondary-container) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ) svg path[stroke]:not([stroke="none"]) {
    stroke: var(--octo-md-on-secondary-container) !important;
  }

  [class*="DivSideNavContainer"] [class*="DivUserContainer"],
  [class*="DivSideNavContainer"] [class*="DivAccountItem"],
  [${SURFACE_ATTR}="sidenav"] [${SURFACE_ATTR}="sidenav-creator"] {
    border-radius: 6px !important;
    margin-bottom: 2px !important;
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface) !important;
    box-shadow: none !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      border-radius ${motion(0.2)} var(--octo-md-ease) !important;
  }

  [class*="DivSideNavContainer"] :is([class*="DivUserContainer"], [class*="DivAccountItem"]):first-of-type,
  [${SURFACE_ATTR}="sidenav"] [${SURFACE_ATTR}="sidenav-creator"][data-octo-md3-creator-pos="first"] {
    border-top-left-radius: 12px !important;
    border-top-right-radius: 12px !important;
  }

  [class*="DivSideNavContainer"] :is([class*="DivUserContainer"], [class*="DivAccountItem"]):last-of-type,
  [${SURFACE_ATTR}="sidenav"] [${SURFACE_ATTR}="sidenav-creator"][data-octo-md3-creator-pos="last"] {
    border-bottom-left-radius: 12px !important;
    border-bottom-right-radius: 12px !important;
  }

  [${SURFACE_ATTR}="sidenav"] [${SURFACE_ATTR}="sidenav-creator"][data-octo-md3-creator-pos="single"] {
    border-radius: 12px !important;
  }

  [class*="DivSideNavContainer"] [class*="DivUserContainer"]:hover,
  [class*="DivSideNavContainer"] [class*="DivAccountItem"]:hover,
  [${SURFACE_ATTR}="sidenav"] [${SURFACE_ATTR}="sidenav-creator"]:hover {
    background-color: var(--octo-md-surface-container-high) !important;
    border-radius: 9px !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) [class*="DivLoginContainer"] {
    border: 0 !important;
    border-radius: 16px !important;
    box-shadow: none !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is([data-e2e*="login" i], [class*="DivLoginContainer"] button, [class*="LoginButton" i]):not([id^="octo-"]) {
    border-radius: 24px !important;
    background-color: var(--octo-md-primary) !important;
    color: var(--octo-md-on-primary) !important;
    box-shadow: none !important;
    font-weight: 600 !important;
    justify-content: center !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is([data-e2e*="login" i], [class*="DivLoginContainer"] button, [class*="LoginButton" i]):not([id^="octo-"]) :where(span, div, p, strong, svg) {
    color: var(--octo-md-on-primary) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is([data-e2e*="login" i], [class*="DivLoginContainer"] button, [class*="LoginButton" i]):not([id^="octo-"]):hover {
    filter: brightness(1.06) !important;
    background-color: var(--octo-md-primary) !important;
    color: var(--octo-md-on-primary) !important;
    box-shadow: var(--octo-md-elevation-1) !important;
  }

  [class*="DivDivider"],
  [class*="SplitLine"],
  hr:not([id^="octo-"]) {
    border-color: color-mix(in srgb, var(--octo-md-outline-variant) 48%, transparent) !important;
  }

  /* --- Верхняя шапка и поиск ----------------------------------------------- */
  header:not([id^="octo-"]):not([class*="Player"] *),
  [role="banner"]:not([id^="octo-"]),
  [class*="DivHeaderContainer"],
  [class*="DivHeaderWrapper"],
  [class*="NavHeader"]:not([id^="octo-"]),
  [class*="BusinessHeader"]:not([id^="octo-"]),
  [class*="LayoutHeader"]:not([id^="octo-"]),
  [class*="TopBar"]:not([id^="octo-"]),
  [class*="NavBar"]:not([id^="octo-"]),
  [class*="HeaderBar"]:not([id^="octo-"]),
  header[class*="Header"],
  [${SURFACE_ATTR}="header"] {
    background-color: var(--octo-md-surface-container-low) !important;
    background-image: none !important;
    color: var(--octo-md-on-surface) !important;
    border-bottom: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="header"] :where(div, nav, section, ul, li):not([${SURFACE_ATTR}="header"]):not([data-e2e="search-box"]):not([class*="Search"]):not([role="button"]):not(button):not([role="menu"]):not([role="menu"] *):not([role="listbox"]):not([role="listbox"] *):not([role="dialog"]):not([role="dialog"] *):not([role="tooltip"]):not([role="tooltip"] *):not([data-e2e="search-transfer-list"]):not([data-e2e="search-transfer-list"] *):not([class*="TUXPopover"]):not([class*="TUXPopover"] *):not([class*="DivPopupContainer"]):not([class*="DivPopupContainer"] *):not([class*="DivDropdown"]):not([class*="DivDropdown"] *):not([class*="DivMenuContainer"]):not([class*="DivMenuContainer"] *):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([class*="Avatar" i]):not([id^="octo-"]) {
    background-color: transparent !important;
    background-image: none !important;
  }

  :is(
    header:not([id^="octo-"]):not([class*="Player"] *),
    [role="banner"]:not([id^="octo-"]),
    [class*="DivHeaderContainer"],
    [class*="DivHeaderWrapper"],
    [class*="NavHeader"]:not([id^="octo-"]),
    [class*="BusinessHeader"]:not([id^="octo-"]),
    [class*="LayoutHeader"]:not([id^="octo-"]),
    [class*="TopBar"]:not([id^="octo-"]),
    [class*="NavBar"]:not([id^="octo-"]),
    [class*="HeaderBar"]:not([id^="octo-"]),
    [${SURFACE_ATTR}="header"]
  ) :where(a, span, p, div, h1, h2, h3, h4, label, button, svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([class*="TUXButton--primary"]):not([class*="TUXButton--primary"] *):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([role="tooltip"]):not([role="tooltip"] *) {
    color: var(--octo-md-on-surface) !important;
  }

  [data-e2e="search-box"],
  form[action*="/search"],
  [class*="DivSearchBar"],
  [class*="DivSearchFormContainer"] form,
  [class*="DivSideNavContainer"] button[class*="Search"],
  [${SURFACE_ATTR}="sidenav-search"] {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface-variant) !important;
    border: 0 !important;
    border-color: transparent !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 45%, transparent) !important;
    overflow: hidden !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      box-shadow ${motion(0.16)} var(--octo-md-ease) !important;
  }

  [${SURFACE_ATTR}="sidenav-search"]:hover {
    background-color: var(--octo-md-surface-container-highest) !important;
    color: var(--octo-md-on-surface) !important;
  }

  :is([data-e2e="search-box"], form[action*="/search"], [class*="DivSearchBar"], [class*="DivSearchFormContainer"], [${SURFACE_ATTR}="sidenav-search"]) :where(div, span, label, input):not([data-e2e="search-button"]):not([data-e2e="search-button"] *) {
    background-color: transparent !important;
    background-image: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  [data-e2e="search-box"]:focus-within,
  form[action*="/search"]:focus-within,
  [class*="DivSearchBar"]:focus-within {
    background-color: var(--octo-md-surface-container-highest) !important;
    box-shadow: inset 0 0 0 2px var(--octo-md-primary) !important;
  }

  [data-e2e="search-user-input"],
  [data-e2e="search-box"] input,
  form[action*="/search"] input {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
    color: var(--octo-md-on-surface) !important;
    caret-color: var(--octo-md-primary) !important;
  }

  [data-e2e="search-button"] {
    border-radius: 24px !important;
    border: 0 !important;
    color: var(--octo-md-on-surface-variant) !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  [data-e2e="search-button"]:hover {
    background-color: var(--octo-md-state-hover) !important;
    color: var(--octo-md-on-surface) !important;
  }

  [data-e2e="search-transfer-list"],
  [class*="DivSearchSuggestion"],
  [class*="DivSearchHistory"] {
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 16px !important;
    box-shadow:
      var(--octo-md-elevation-2),
      inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 48%, transparent) !important;
  }

  /* --- Все вкладки и чипы фильтрации (Профиль, Обзор, Поиск, Видео, Live, Studio) --- */
  [role="tablist"],
  [class*="DivVideoFeedTab"],
  [class*="DivTabList"],
  [class*="TUXTabBar"],
  [class*="DivNavTab"],
  [class*="DivTabBarWrapper"] {
    background-color: transparent !important;
    background-image: none !important;
    border-bottom-color: color-mix(in srgb, var(--octo-md-outline-variant) 55%, transparent) !important;
  }

  [${SURFACE_ATTR}="tab-bar"] {
    background-color: color-mix(in srgb, var(--octo-md-surface-container-low) 95%, transparent) !important;
    background-image: none !important;
    border-radius: 18px !important;
    border-bottom: 0 !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="tab-bar"] > :where(div, section):not([class*="BottomLine"]):not([class*="Indicator"]):not([class*="TabLine"]):not([${SURFACE_ATTR}="drawer-segmented"]):not([role="tablist"] *) {
    background-color: transparent !important;
    background-image: none !important;
  }

  [${SURFACE_ATTR}="profile-head"] {
    background-color: var(--octo-md-surface-container-low) !important;
    background-image: none !important;
    border-radius: 20px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [role="tab"],
  [class*="DivTabItem"],
  [class*="TUXTabBarItem"],
  [class*="StyledTab"],
  [data-e2e="videos-tab"],
  [data-e2e="liked-tab"],
  [data-e2e="favorites-tab"],
  [data-e2e="repost-tab"] {
    border-radius: 6px !important;
    color: var(--octo-md-on-surface-variant) !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      border-radius ${motion(0.2)} var(--octo-md-ease),
      color ${motion(0.16)} var(--octo-md-ease) !important;
  }

  :is([role="tablist"], [class*="DivTabList"], [class*="TUXTabBar"]) > :first-child {
    border-top-left-radius: 12px !important;
    border-bottom-left-radius: 12px !important;
  }

  :is([role="tablist"], [class*="DivTabList"], [class*="TUXTabBar"]) > :last-child {
    border-top-right-radius: 12px !important;
    border-bottom-right-radius: 12px !important;
  }

  [role="tab"]:hover,
  [class*="DivTabItem"]:hover,
  [class*="TUXTabBarItem"]:hover,
  [class*="StyledTab"]:hover {
    background-color: var(--octo-md-state-hover) !important;
    color: var(--octo-md-on-surface) !important;
  }

  [role="tab"]:is([aria-selected="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"]),
  [class*="DivTabItem"]:is([aria-selected="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"]),
  [class*="TUXTabBarItem"][aria-selected="true"],
  [class*="StyledTab"]:is([aria-selected="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"]),
  [data-e2e="videos-tab"][aria-selected="true"],
  [data-e2e="liked-tab"][aria-selected="true"],
  [data-e2e="favorites-tab"][aria-selected="true"],
  [data-e2e="repost-tab"][aria-selected="true"] {
    color: var(--octo-md-secondary) !important;
    border-radius: 12px !important;
  }

  [class*="DivBottomLine"],
  [class*="TabIndicator"],
  [class*="TUXTabBar-indicator"],
  [class*="TabLine"],
  [class*="ActiveLine"] {
    background-color: var(--octo-md-primary) !important;
    border-radius: 9999px !important;
  }

  [${SURFACE_ATTR}="chip-bar"],
  [class*="DivCategoryList" i] {
    scrollbar-width: none !important;
  }

  :is([${SURFACE_ATTR}="chip-bar"], [class*="DivCategoryList" i])::-webkit-scrollbar {
    display: none !important;
    height: 0 !important;
  }

  [class*="DivCategory"] button,
  [class*="DivCategory"] a,
  [class*="DivCategoryList"] button,
  [class*="DivTagList"] button,
  [class*="DivChannel"] button,
  [class*="DivFilter"] button,
  [class*="FilterChip"],
  [data-e2e*="category"],
  [${SURFACE_ATTR}="chip"] {
    border-radius: 24px !important;
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface-variant) !important;
    border: 0 !important;
    border-color: transparent !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [class*="DivCategory"] button:hover,
  [class*="DivCategory"] a:hover,
  [class*="DivCategoryList"] button:hover,
  [class*="DivTagList"] button:hover,
  [class*="DivChannel"] button:hover,
  [class*="DivFilter"] button:hover,
  [class*="FilterChip"]:hover,
  [data-e2e*="category"]:hover,
  [${SURFACE_ATTR}="chip"]:hover {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 24px !important;
  }

  [class*="DivCategory"] :is(button, a):is([aria-selected="true"], [aria-pressed="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"]),
  [class*="DivCategoryList"] button:is([aria-selected="true"], [aria-pressed="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"]),
  [class*="DivTagList"] button:is([aria-selected="true"], [aria-pressed="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"]),
  [class*="DivChannel"] button:is([aria-selected="true"], [aria-pressed="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"]),
  [class*="DivFilter"] button:is([aria-selected="true"], [aria-pressed="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"]),
  [class*="FilterChip"]:is([aria-selected="true"], [aria-pressed="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"]),
  [data-e2e*="category"]:is([aria-selected="true"], [aria-pressed="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"]),
  [${SURFACE_ATTR}="chip-active"],
  [${SURFACE_ATTR}="chip-active"]:hover {
    border-radius: 24px !important;
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    box-shadow: none !important;
    font-weight: 600 !important;
  }

  /* --- Кнопки: Filled, Tonal, Outlined, Icon и соединённые группы MD3 Expressive --- */
  button:where(:not([id^="octo-"]):not([class*="PlayOverlay"]):not([class*="VideoMask"]):not([class*="ClickArea"]):not([class*="ButtonActionItem"]):not([class*="Player"] button):not([class*="DivVideoWrapper"] button):not([class*="SeekBar"] button):not([class*="Control"] button):not([role="tab"]):not([role="menuitem"]):not([role="option"]):not([role="switch"])),
  a[role="button"]:where(:not([id^="octo-"]):not([data-e2e="tiktok-logo"]):not([role="tab"]):not([role="menuitem"])),
  [class*="TUXButton"]:where(:not([id^="octo-"])) {
    border-radius: 14px !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      border-radius ${motion(0.22)} var(--octo-md-ease),
      color ${motion(0.16)} var(--octo-md-ease),
      box-shadow ${motion(0.16)} var(--octo-md-ease),
      filter ${motion(0.16)} var(--octo-md-ease) !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-first"] {
    border-radius: 24px 6px 6px 24px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-mid"] {
    border-radius: 6px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-last"] {
    border-radius: 6px 24px 24px 6px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-first"] {
    border-radius: 24px 24px 6px 6px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-mid"] {
    border-radius: 6px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-last"] {
    border-radius: 6px 6px 24px 24px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-first"]:hover {
    border-radius: 24px 12px 12px 24px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-mid"]:hover,
  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-mid"]:hover {
    border-radius: 12px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-last"]:hover {
    border-radius: 12px 24px 24px 12px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-first"]:hover {
    border-radius: 24px 24px 12px 12px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-last"]:hover {
    border-radius: 12px 12px 24px 24px !important;
  }

  [class*="TUXButton--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="Button--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="PrimaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="StyledPrimary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [data-e2e="top-login-button"],
  [data-e2e="post-btn"],
  [data-e2e="publish-btn"],
  button[data-e2e*="follow"]:not([data-e2e^="nav-"]):not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="Secondary"]):not([class*="Outline"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="FollowButton"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="StyledFollow"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [${ACCENT_ATTR}="primary"]:not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  button[type="submit"]:not([data-e2e="search-button"]):not([data-e2e="comment-post"]):not([class*="TUXButton--secondary"]):not([class*="TUXButton--outline"]):not([class*="Secondary"]):not([class*="Outline"]):not(:disabled):not([aria-disabled="true"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *) {
    background-color: var(--octo-md-primary) !important;
    color: var(--octo-md-on-primary) !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }

  :is(
    [class*="TUXButton--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="Button--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="PrimaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="StyledPrimary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [data-e2e="top-login-button"],
    [data-e2e="post-btn"],
    [data-e2e="publish-btn"],
    button[data-e2e*="follow"]:not([data-e2e^="nav-"]):not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="Secondary"]):not([class*="Outline"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="FollowButton"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="StyledFollow"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [${ACCENT_ATTR}="primary"]:not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    button[type="submit"]:not([data-e2e="search-button"]):not([data-e2e="comment-post"]):not([class*="TUXButton--secondary"]):not([class*="TUXButton--outline"]):not([class*="Secondary"]):not([class*="Outline"]):not(:disabled):not([aria-disabled="true"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *)
  ) :where(span, div, p, strong, svg) {
    color: var(--octo-md-on-primary) !important;
  }

  [class*="TUXButton--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="Button--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="PrimaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [data-e2e="top-login-button"]:hover,
  button[data-e2e*="follow"]:not([data-e2e^="nav-"]):not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="Secondary"]):not([class*="Outline"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="FollowButton"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [${ACCENT_ATTR}="primary"]:not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  button[type="submit"]:not([data-e2e="search-button"]):not([data-e2e="comment-post"]):not([class*="TUXButton--secondary"]):not([class*="TUXButton--outline"]):not([class*="Secondary"]):not([class*="Outline"]):not(:disabled):not([aria-disabled="true"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover {
    filter: brightness(1.06) !important;
    box-shadow: var(--octo-md-elevation-1) !important;
  }

  [class*="TUXButton--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="TUXButton--outline"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="Button--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="SecondaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="OutlinedButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="semi-button"]:not([class*="semi-button-primary"]):not([class*="semi-button-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [class*="arco-btn"]:not([class*="arco-btn-primary"]):not([class*="arco-btn-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [${ACCENT_ATTR}="tonal"]:not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
  [data-e2e="upload-icon"],
  a[href*="/upload"][class*="Upload"],
  [data-e2e="edit-profile-button"],
  [data-e2e="message-button"],
  [data-e2e*="follow"][aria-pressed="true"],
  [data-e2e*="follow"][class*="Following"],
  [data-e2e*="follow"][class*="Followed"],
  [data-e2e*="follow"][class*="Secondary"] {
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    border-color: transparent !important;
  }

  :is(
    [class*="TUXButton--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="TUXButton--outline"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="Button--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="SecondaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="OutlinedButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="semi-button"]:not([class*="semi-button-primary"]):not([class*="semi-button-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [class*="arco-btn"]:not([class*="arco-btn-primary"]):not([class*="arco-btn-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [${ACCENT_ATTR}="tonal"]:not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *),
    [data-e2e="upload-icon"],
    a[href*="/upload"][class*="Upload"],
    [data-e2e="edit-profile-button"],
    [data-e2e="message-button"],
    [data-e2e*="follow"][aria-pressed="true"],
    [data-e2e*="follow"][class*="Following"],
    [data-e2e*="follow"][class*="Followed"],
    [data-e2e*="follow"][class*="Secondary"]
  ) :where(span, div, p, strong, svg) {
    color: var(--octo-md-on-secondary-container) !important;
  }

  [class*="TUXButton--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="TUXButton--outline"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="Button--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="SecondaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="semi-button"]:not([class*="semi-button-primary"]):not([class*="semi-button-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [class*="arco-btn"]:not([class*="arco-btn-primary"]):not([class*="arco-btn-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [${ACCENT_ATTR}="tonal"]:not([class*="DivSideNavContainer"] *):not([${SURFACE_ATTR}="sidenav"] *):hover,
  [data-e2e="edit-profile-button"]:hover,
  [data-e2e="message-button"]:hover,
  [data-e2e*="follow"][aria-pressed="true"]:hover,
  [data-e2e*="follow"][class*="Following"]:hover {
    background-color: color-mix(in srgb, var(--octo-md-secondary-container) 86%, var(--octo-md-on-surface)) !important;
  }

  /* Правая панель действий у видео: без лишних кружков, счётчик чёткий */
  [class*="ButtonActionItem"]:not([${SURFACE_ATTR}="player-more"]),
  [class*="DivActionItemContainer"] button:not([${SURFACE_ATTR}="player-more"]):not([data-e2e*="more"]):not([data-e2e*="follow"]),
  [class*="ActionBar"] button:not([${SURFACE_ATTR}="player-more"]):not([data-e2e*="more"]):not([data-e2e*="follow"]) {
    background-color: transparent !important;
    box-shadow: none !important;
  }

  [${ICON_ATTR}="active"],
  [class*="ButtonActionItem"] svg path:is([fill="#FE2C55" i], [fill="#FF3B5C" i], [fill="#EA284E" i]),
  [data-e2e*="like-icon"] path:is([fill="#FE2C55" i], [fill="#FF3B5C" i], [fill="#EA284E" i]),
  [data-e2e*="favorite-icon"] path:is([fill="#FE2C55" i], [fill="#FF3B5C" i], [fill="#EA284E" i]) {
    color: var(--octo-md-primary) !important;
    fill: var(--octo-md-primary) !important;
  }

  [data-e2e="like-count"],
  [data-e2e="comment-count"],
  [data-e2e="share-count"],
  [data-e2e="undefined-count"],
  [class*="ButtonActionItem"] strong {
    color: #ffffff !important;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.72) !important;
  }

  [${MD3_ATTR}="light"] :is(
    [data-e2e="like-count"],
    [data-e2e="comment-count"],
    [data-e2e="share-count"],
    [data-e2e="undefined-count"],
    [class*="ButtonActionItem"] strong
  ):not([class*="Player"] *):not([class*="DivVideoWrapper"] *):not([class*="VideoContainer"] *) {
    color: var(--octo-md-on-surface) !important;
    text-shadow: none !important;
  }

  /* Стрелки навигации вверх/вниз в ленте и кнопка «Ещё» (MD3 tonal FABs) */
  [data-e2e="feed-navigation-next"],
  [data-e2e="feed-navigation-prev"],
  [data-e2e="arrow-down"],
  [data-e2e="arrow-up"],
  [class*="DivFeedNavigation"] button,
  [${SURFACE_ATTR}="player-more"] {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
    border-color: transparent !important;
    opacity: 1 !important;
    box-shadow:
      var(--octo-md-elevation-1),
      inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 48%, transparent) !important;
  }

  [${SURFACE_ATTR}="player-more"] {
    border-radius: 24px !important;
  }

  :is(
    [data-e2e="feed-navigation-next"],
    [data-e2e="feed-navigation-prev"],
    [data-e2e="arrow-down"],
    [data-e2e="arrow-up"],
    [class*="DivFeedNavigation"] button,
    [${SURFACE_ATTR}="player-more"]
  ) :where(svg, path, circle, rect, polyline, polygon) {
    color: var(--octo-md-on-surface) !important;
    opacity: 1 !important;
  }

  [${SURFACE_ATTR}="feed-nav-group"] {
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
  }

  [${SURFACE_ATTR}="feed-nav-group"] :is(button, [role="button"])[${BTN_GROUP_ATTR}="v-first"] {
    border-radius: 20px 20px 6px 6px !important;
  }

  [${SURFACE_ATTR}="feed-nav-group"] :is(button, [role="button"])[${BTN_GROUP_ATTR}="v-last"] {
    border-radius: 6px 6px 20px 20px !important;
  }

  [${SURFACE_ATTR}="feed-nav-group"] :is(button, [role="button"])[${BTN_GROUP_ATTR}="v-first"]:hover {
    border-radius: 20px 20px 10px 10px !important;
  }

  [${SURFACE_ATTR}="feed-nav-group"] :is(button, [role="button"])[${BTN_GROUP_ATTR}="v-last"]:hover {
    border-radius: 10px 10px 20px 20px !important;
  }

  [data-e2e="feed-navigation-next"]:hover,
  [data-e2e="feed-navigation-prev"]:hover,
  [data-e2e="arrow-down"]:hover,
  [data-e2e="arrow-up"]:hover,
  [class*="DivFeedNavigation"] button:hover,
  [${SURFACE_ATTR}="player-more"]:hover {
    background-color: var(--octo-md-surface-container-highest) !important;
  }

  /* --- Плеер, прогресс-бар и нижняя панель управления ---------------------- */
  [${SURFACE_ATTR}="player-controls-wrap"] {
    opacity: 1 !important;
  }

  [${SURFACE_ATTR}="player-seekbar"],
  [class*="DivSeekBar"],
  [class*="DivProgressBar"] {
    opacity: 1 !important;
  }

  [${SURFACE_ATTR}="player-seekbar"] [class*="Track"],
  [${SURFACE_ATTR}="player-seekbar"] > div:first-child:not([${ACCENT_ATTR}="progress"]):not([${SURFACE_ATTR}="player-seekbar-thumb"]) {
    background-color: color-mix(in srgb, var(--octo-md-on-surface) 24%, transparent) !important;
    border-radius: 9999px !important;
  }

  [class*="DivSeekBar"] [class*="Progress"],
  [class*="DivProgressBar"] [class*="Progress"],
  [class*="SeekBar"] [class*="Played"],
  [class*="SeekBar"] [class*="Fill"],
  [${ACCENT_ATTR}="progress"] {
    background-color: var(--octo-md-primary) !important;
    border-radius: 9999px !important;
    opacity: 1 !important;
  }

  [class*="DivSeekBar"] [class*="Circle"],
  [class*="DivSeekBar"] [class*="Dot"],
  [class*="SeekBar"] [class*="Thumb"],
  [${SURFACE_ATTR}="player-seekbar-thumb"] {
    background-color: var(--octo-md-primary) !important;
    box-shadow: 0 0 0 2px var(--octo-md-surface-container) !important;
    opacity: 1 !important;
  }

  [class*="DivVideoControlBottom"],
  [class*="DivPlayerControls"],
  [class*="DivBottomControls"],
  [class*="DivMediaControl"],
  [class*="DivControlBottom"],
  [${SURFACE_ATTR}="player-controls"] {
    opacity: 1 !important;
    background-color: color-mix(in srgb, var(--octo-md-surface-container) 92%, transparent) !important;
    border-top: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
    color: var(--octo-md-on-surface) !important;
  }

  :is(
    [class*="DivVideoControlBottom"],
    [class*="DivPlayerControls"],
    [class*="DivBottomControls"],
    [class*="DivMediaControl"],
    [class*="DivControlBottom"],
    [${SURFACE_ATTR}="player-controls"]
  ) :where(div, span, p, label, time, button, [role="button"], svg) {
    opacity: 1 !important;
  }

  :is(
    [class*="DivVideoControlBottom"],
    [class*="DivPlayerControls"],
    [class*="DivBottomControls"],
    [class*="DivMediaControl"],
    [class*="DivControlBottom"],
    [${SURFACE_ATTR}="player-controls"]
  ) :where(span, p, label, time, button, [role="button"], svg):not([${ACCENT_ATTR}="switch"]):not([${ACCENT_ATTR}="switch"] *):not([${ACCENT_ATTR}="switch-off"]):not([${ACCENT_ATTR}="switch-off"] *):not([${ACCENT_ATTR}="progress"]):not([${SURFACE_ATTR}="player-seekbar"]):not([${SURFACE_ATTR}="player-seekbar"] *):not([${SURFACE_ATTR}="player-seekbar-thumb"]) {
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="player-controls"] :is(button, [role="button"]):not([class*="PlayOverlay"]):not([class*="VideoMask"]):not([class*="ClickArea"]):not([role="switch"]) {
    background-color: transparent !important;
    border-radius: 9999px !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      color ${motion(0.16)} var(--octo-md-ease) !important;
  }

  [${SURFACE_ATTR}="player-controls"] :is(button, [role="button"]):not([class*="PlayOverlay"]):not([class*="VideoMask"]):not([class*="ClickArea"]):not([role="switch"]):hover {
    background-color: var(--octo-md-state-hover) !important;
  }

  /* --- Карточки, превью и рамка плеера (без влияния на fullscreen и PiP) -- */
  [data-e2e="user-post-item"],
  [data-e2e="explore-item"],
  [data-e2e="search_top-item"],
  [data-e2e="favorites-item"],
  [class*="DivItemContainer"],
  [class*="DivVideoCard"],
  [class*="DivExploreCard"],
  [class*="DivLiveCard"] {
    border-radius: 14px !important;
  }

  [data-e2e="feed-video"] [class*="DivVideoWrapper"]:not(:fullscreen),
  [class*="DivBasicPlayerWrapper"]:not(:fullscreen) {
    border-radius: 16px !important;
    background-color: var(--octo-md-surface-dim) !important;
    isolation: isolate !important;
    box-shadow:
      0 10px 24px rgba(8, 6, 16, 0.45),
      0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 50%, transparent) !important;
  }

  [${SURFACE_ATTR}="video-stage"]:not(:fullscreen) {
    background-color: var(--octo-md-surface-dim) !important;
    isolation: isolate !important;
  }

  :fullscreen,
  :fullscreen [class*="DivVideoWrapper"],
  :fullscreen [class*="DivBasicPlayerWrapper"],
  :fullscreen video,
  :-webkit-full-screen,
  :-webkit-full-screen [class*="DivVideoWrapper"],
  :-webkit-full-screen [class*="DivBasicPlayerWrapper"],
  :-webkit-full-screen video {
    border-radius: 0 !important;
  }

  [class*="DivUserCard"],
  [class*="DivMusicCard"],
  [class*="DivChallengeCard"],
  [class*="TUXCard"]:not([class*="wrapper"]):not([class*="Wrapper"]),
  [class*="DivInfoCard"] {
    background-color: var(--octo-md-surface-container) !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 40%, transparent) !important;
  }

  /* --- Комментарии и правая колонка видео (без правки display) ------------ */
  [class*="DivVideoDetailContainer"] [class*="DivVideoListTabBarWrapper"],
  [class*="DivContentContainer"][class*="Comment"],
  [class*="DivCommentContainer"],
  [class*="DivCommentListContainer"],
  [class*="DivCommentSidebar"],
  [class*="DivCommentDrawer"],
  [${SURFACE_ATTR}="comments"] {
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    border-inline-start: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="comments"] :where(span, p, a, strong):not([class*="Badge"]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *) {
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="comments"] :is(button, [role="button"]):not([data-e2e="comment-post"]):not([class*="Primary"]):not([${ACCENT_ATTR}="primary"]) {
    background-color: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  [${SURFACE_ATTR}="comments"] :is(button, [role="button"]):not([data-e2e="comment-post"]):not([class*="Primary"]):not([${ACCENT_ATTR}="primary"]):hover {
    background-color: var(--octo-md-state-hover) !important;
  }

  [class*="DivBottomCommentContainer"],
  [class*="DivCommentInput"],
  [data-e2e="comment-input"],
  [${SURFACE_ATTR}="comment-input"] {
    background-color: var(--octo-md-surface-container-high) !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 48%, transparent) !important;
  }

  :is(
    [class*="DivBottomCommentContainer"],
    [class*="DivCommentInput"],
    [data-e2e="comment-input"],
    [${SURFACE_ATTR}="comment-input"]
  ) :where(div, form, [contenteditable="true"]) {
    background-color: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  [data-e2e="comment-post"] {
    color: var(--octo-md-secondary) !important;
    background-color: transparent !important;
  }

  [class*="DivCommentItemContainer"],
  [class*="DivReplyItem"] {
    border-radius: 6px !important;
    transition:
      background-color ${motion(0.14)} var(--octo-md-ease),
      border-radius ${motion(0.2)} var(--octo-md-ease) !important;
  }

  [class*="DivCommentItemContainer"]:first-child,
  [class*="DivReplyItem"]:first-child {
    border-top-left-radius: 12px !important;
    border-top-right-radius: 12px !important;
  }

  [class*="DivCommentItemContainer"]:last-child,
  [class*="DivReplyItem"]:last-child {
    border-bottom-left-radius: 12px !important;
    border-bottom-right-radius: 12px !important;
  }

  [class*="DivCommentItemContainer"]:hover,
  [class*="DivReplyItem"]:hover {
    background-color: var(--octo-md-state-hover) !important;
  }

  /* --- Трансляции (TikTok LIVE: сцена, донатная панель и правый чат) ------- */
  .live-room-container {
    background-color: transparent !important;
    color: var(--octo-md-on-surface) !important;
  }

  [data-e2e="live-room-content"]:not(:fullscreen) {
    border-radius: 16px !important;
    background-color: var(--octo-md-surface-dim) !important;
    box-shadow:
      0 20px 52px rgba(8, 6, 16, 0.56),
      0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 48%, transparent) !important;
  }

  [${SURFACE_ATTR}="live-stage"]:not(:fullscreen) {
    border-radius: 16px !important;
    background-color: var(--octo-md-surface-container-lowest) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="live-footer"] {
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="live-chat"] {
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    border-inline-start: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="live-chat-pane"] {
    background-color: transparent !important;
    background-image: none !important;
    border-color: color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="live-chat"] :is(header, footer, [class*="Header" i]):not([${SURFACE_ATTR}="live-chat-input"]):not([id^="octo-"]) {
    border-color: color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="live-chat-input"] {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 50%, transparent) !important;
  }

  [${SURFACE_ATTR}="live-chat-input"] :where(input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]) {
    background-color: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
    color: var(--octo-md-on-surface) !important;
    caret-color: var(--octo-md-primary) !important;
  }

  :is([${SURFACE_ATTR}="sidenav"], [${SURFACE_ATTR}="live-chat"], .live-room-container, [${SURFACE_ATTR}="live-stage"]) :is(
    [class~="bg-[#000]"],
    [class~="bg-[#000000]"],
    [class~="bg-[#090909]"],
    [class~="bg-[#121212]"],
    [class~="bg-[#161823]"],
    [class~="bg-[#191919]"],
    [class~="bg-[#1e1b2b]"],
    [class~="bg-[rgb(18,18,18)]"],
    [class~="bg-[rgba(22,24,35,1)]"],
    [class~="bg-[rgba(37,37,37,1)]"]
  ):not([data-e2e="live-room-content"]):not([data-e2e="live-room-content"] *):not([class*="Video"]):not([class*="Player"]) {
    background-color: var(--octo-md-surface-container-low) !important;
  }

  :is([${SURFACE_ATTR}="sidenav"], [${SURFACE_ATTR}="live-chat"], .live-room-container) :is(
    [class~="bg-[#FE2C55]" i],
    [class~="bg-[#FF3B5C]" i]
  ):not(:disabled):not([aria-disabled="true"]) {
    background-color: var(--octo-md-primary) !important;
    color: var(--octo-md-on-primary) !important;
  }

  :is([${SURFACE_ATTR}="sidenav"], [${SURFACE_ATTR}="live-chat"], .live-room-container) [class~="bg-[linear-gradient(131deg,#FF1764_0%,#ED3495_94.15%)]" i] {
    background-image: linear-gradient(131deg, var(--octo-md-primary), var(--octo-md-secondary)) !important;
    color: var(--octo-md-on-primary) !important;
  }

  [${SURFACE_ATTR}="live-chat"] :is(
    [class~="text-[#fff]" i],
    [class~="text-[#ffffff]" i],
    [class~="text-[#f6f6f6]" i],
    [class~="text-[rgba(255,255,255,0.9)]" i],
    [class~="text-[rgba(255,255,255,1)]" i],
    [class~="text-white/90"]
  ):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *) {
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="live-chat"] :is(
    [class~="text-[#C1C1C1]" i],
    [class~="text-[rgba(255,255,255,.75)]" i],
    [class~="text-[rgba(255,255,255,0.75)]" i],
    [class~="text-[rgba(255,255,255,0.5)]" i]
  ) {
    color: var(--octo-md-on-surface-variant) !important;
  }

  [${SURFACE_ATTR}="live-chat"] [${FG_ATTR}="on-surface"] {
    color: var(--octo-md-on-surface) !important;
  }

  /* --- Сообщения / Чат (панель, /messages и Business Suite) ---------------- */
  [${CHAT_LAYOUT_ATTR}="hidden"] {
    display: none !important;
  }

  iframe[${CHAT_LAYOUT_ATTR}="frame"] {
    display: block !important;
    flex: 1 1 100% !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    height: 100% !important;
    margin: 0 !important;
    border: 0 !important;
  }

  [${CHAT_LAYOUT_ATTR}="host"] {
    flex: 1 1 auto !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
  }

  [${CHAT_LAYOUT_ATTR}="flush"] {
    margin-inline-start: 0 !important;
    padding-inline-start: 0 !important;
  }

  [class*="DivConversationList"],
  [class*="DivChatList"],
  [class*="DivInboxList"],
  [class*="SessionList"],
  [class*="ConversationList"],
  [class*="ChatList"] {
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    border-inline-end: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [class*="DivChatMain"],
  [class*="DivMessageContainer"],
  [class*="DivChatBox"],
  [class*="ChatDetail"],
  [class*="MessageDetail"],
  [class*="ConversationDetail"],
  [class*="ChatArea"] {
    background-color: var(--octo-md-surface) !important;
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="card"] {
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 40%, transparent) !important;
  }

  [data-e2e="chat-list-item"],
  [class*="DivConversationItem"],
  [class*="DivChatItem"],
  [class*="SessionItem"],
  [class*="ContactItem"],
  [class*="ConversationItem"],
  [class*="ChatItem"] {
    background-color: transparent !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 6px !important;
    margin-bottom: 2px !important;
    transition:
      background-color ${motion(0.15)} var(--octo-md-ease),
      border-radius ${motion(0.2)} var(--octo-md-ease) !important;
  }

  [data-e2e="chat-list-item"]:first-child,
  [class*="DivConversationItem"]:first-child,
  [class*="DivChatItem"]:first-child,
  [class*="SessionItem"]:first-child,
  [class*="ContactItem"]:first-child,
  [class*="ConversationItem"]:first-child,
  [class*="ChatItem"]:first-child {
    border-top-left-radius: 12px !important;
    border-top-right-radius: 12px !important;
  }

  [data-e2e="chat-list-item"]:last-child,
  [class*="DivConversationItem"]:last-child,
  [class*="DivChatItem"]:last-child,
  [class*="SessionItem"]:last-child,
  [class*="ContactItem"]:last-child,
  [class*="ConversationItem"]:last-child,
  [class*="ChatItem"]:last-child {
    border-bottom-left-radius: 12px !important;
    border-bottom-right-radius: 12px !important;
  }

  :is(
    [data-e2e="chat-list-item"],
    [class*="DivConversationItem"],
    [class*="DivChatItem"],
    [class*="SessionItem"],
    [class*="ContactItem"],
    [class*="ConversationItem"],
    [class*="ChatItem"],
    [class*="DivConversationList"],
    [class*="DivChatList"],
    [class*="DivInboxList"],
    [class*="MessageList"],
    [class*="SessionList"],
    [class*="ConversationList"],
    [class*="ChatList"],
    [${SURFACE_ATTR}="card"]
  ) :where(span, p, div, strong, label, h1, h2, h3, h4):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([class*="Avatar" i]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *) {
    color: var(--octo-md-on-surface) !important;
  }

  [data-e2e="chat-list-item"]:hover,
  [class*="DivConversationItem"]:hover,
  [class*="DivChatItem"]:hover,
  [class*="SessionItem"]:hover,
  [class*="ContactItem"]:hover,
  [class*="ConversationItem"]:hover,
  [class*="ChatItem"]:hover {
    background-color: var(--octo-md-state-hover) !important;
  }

  [data-e2e="chat-list-item"][aria-selected="true"],
  [class*="DivConversationItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"]),
  [class*="DivChatItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"]),
  [class*="SessionItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"], [class*="active"]),
  [class*="ContactItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"], [class*="active"]),
  [class*="ConversationItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"], [class*="active"]),
  [class*="ChatItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"], [class*="active"]),
  [${SURFACE_ATTR}="chat-active"] {
    border-radius: 14px !important;
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="chat-active"] :where(div, section, li):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([class*="Avatar" i]) {
    background-color: transparent !important;
  }

  :is(
    [data-e2e="chat-list-item"][aria-selected="true"],
    [class*="DivConversationItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"]),
    [class*="DivChatItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"]),
    [class*="SessionItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"], [class*="active"]),
    [class*="ContactItem"]:is([aria-selected="true"], [aria-current="true"], [data-selected="true"], [data-active="true"], [class*="-Active"], [class*="--active"], [class*="IsActive"], [class*="Selected"], [class*="selected"], [class*="active"]),
    [${SURFACE_ATTR}="chat-active"]
  ) :where(span, p, div, strong, h1, h2, h3, h4):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([class*="Avatar" i]) {
    color: var(--octo-md-on-secondary-container) !important;
  }

  [${FG_ATTR}="on-surface"] {
    color: var(--octo-md-on-surface) !important;
  }

  [${ICON_ATTR}="on-surface"] {
    color: var(--octo-md-on-surface) !important;
  }

  svg[${ICON_ATTR}="on-surface"] path:not([fill="none"]),
  [${ICON_ATTR}="on-surface"] > path:not([fill="none"]) {
    fill: var(--octo-md-on-surface) !important;
  }

  svg[${ICON_ATTR}="on-surface"] path[stroke]:not([stroke="none"]),
  [${ICON_ATTR}="on-surface"] > path[stroke]:not([stroke="none"]) {
    stroke: var(--octo-md-on-surface) !important;
  }

  [class*="DivMessageContent"],
  [class*="DivChatBubble"] {
    border-radius: 12px !important;
  }

  [data-e2e="message-input-area"],
  [class*="DivMessageInput"],
  [class*="DivChatInput"],
  [class*="MessageEditor"],
  [class*="ChatEditor"],
  [${SURFACE_ATTR}="chat-input"] {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 50%, transparent) !important;
  }

  :is(
    [data-e2e="message-input-area"],
    [class*="DivMessageInput"],
    [class*="DivChatInput"],
    [class*="MessageEditor"],
    [class*="ChatEditor"],
    [${SURFACE_ATTR}="chat-input"]
  ) :where([contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], input, textarea) {
    background-color: transparent !important;
    color: var(--octo-md-on-surface) !important;
    caret-color: var(--octo-md-primary) !important;
  }

  input::placeholder,
  textarea::placeholder,
  [contenteditable][data-placeholder]:empty::before,
  [class*="placeholder" i]:not(input):not(textarea) {
    color: var(--octo-md-on-surface-variant) !important;
  }

  /* --- Диалоги, модалки, поповеры, меню и подсказки ------------------------
     Используем точные ARIA-роли и контейнеры содержимого, исключая любые
     reference/trigger/wrapper обёртки библиотек TUX. */
  [role="dialog"]:not([id^="octo-"]),
  [aria-modal="true"]:not([id^="octo-"]),
  [class*="TUXModal-content"]:not([id^="octo-"]),
  [class*="DivModalContainer"]:not([id^="octo-"]),
  [class*="DivDialogContainer"]:not([id^="octo-"]) {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 20px !important;
    box-shadow:
      var(--octo-md-elevation-3),
      inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 55%, transparent) !important;
  }

  [class*="DivModalMask"],
  [class*="TUXModal-backdrop"],
  [class*="DivOverlayMask"] {
    background-color: var(--octo-md-scrim) !important;
  }

  [role="menu"]:not([id^="octo-"]),
  [role="listbox"]:not([id^="octo-"]),
  [class*="TUXPopover-content"]:not([id^="octo-"]),
  [class*="DivPopupContainer"]:not([id^="octo-"]),
  [class*="DivDropdown"]:not([id^="octo-"]),
  [class*="DivMenuContainer"]:not([id^="octo-"]) {
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 14px !important;
    box-shadow:
      var(--octo-md-elevation-2),
      inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 50%, transparent) !important;
  }

  :is(
    [role="menu"]:not([id^="octo-"]),
    [role="listbox"]:not([id^="octo-"]),
    [class*="TUXPopover-content"]:not([id^="octo-"]),
    [class*="DivPopupContainer"]:not([id^="octo-"]),
    [class*="DivDropdown"]:not([id^="octo-"]),
    [class*="DivMenuContainer"]:not([id^="octo-"])
  ) :where(a, span, p, div, label, strong, li, button, svg, [role="menuitem"], [role="option"]):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([${ACCENT_ATTR}="primary-text"]):not(:disabled):not([aria-disabled="true"]) {
    color: var(--octo-md-on-surface) !important;
  }

  [role="menuitem"],
  [role="option"],
  [class*="DivMenuItem"],
  [class*="TUXMenu-item"] {
    border-radius: 6px !important;
    transition:
      background-color ${motion(0.14)} var(--octo-md-ease),
      border-radius ${motion(0.18)} var(--octo-md-ease) !important;
  }

  [role="menuitem"]:first-child,
  [role="option"]:first-child,
  [class*="DivMenuItem"]:first-child,
  [class*="TUXMenu-item"]:first-child {
    border-top-left-radius: 10px !important;
    border-top-right-radius: 10px !important;
  }

  [role="menuitem"]:last-child,
  [role="option"]:last-child,
  [class*="DivMenuItem"]:last-child,
  [class*="TUXMenu-item"]:last-child {
    border-bottom-left-radius: 10px !important;
    border-bottom-right-radius: 10px !important;
  }

  [role="menuitem"]:hover,
  [role="option"]:hover,
  [class*="DivMenuItem"]:hover,
  [class*="TUXMenu-item"]:hover {
    background-color: var(--octo-md-state-hover) !important;
  }

  [role="tooltip"]:not([id^="octo-"]),
  [class*="TUXTooltip-tooltip"]:not([id^="octo-"]),
  [class*="TUXTooltip-content"]:not([id^="octo-"]) {
    background-color: var(--octo-md-inverse-surface) !important;
    color: var(--octo-md-inverse-on-surface) !important;
    border-radius: 8px !important;
  }

  :is(
    [role="tooltip"]:not([id^="octo-"]),
    [class*="TUXTooltip-tooltip"]:not([id^="octo-"]),
    [class*="TUXTooltip-content"]:not([id^="octo-"])
  ) :where(span, p, div) {
    color: var(--octo-md-inverse-on-surface) !important;
  }

  /* --- Disabled-кнопки, поля ввода (без «скобок» по краям), переключатели, настройки --- */
  button:disabled:not([id^="octo-"]):not([class*="PlayOverlay"]):not([class*="VideoMask"]):not([class*="ClickArea"]):not([class*="Player"] button),
  [role="button"][aria-disabled="true"]:not([id^="octo-"]):not([class*="PlayOverlay"]):not([class*="Player"] *) {
    background-color: color-mix(in srgb, var(--octo-md-on-surface) 12%, transparent) !important;
    color: color-mix(in srgb, var(--octo-md-on-surface) 38%, transparent) !important;
    border-color: transparent !important;
    box-shadow: none !important;
    filter: none !important;
    opacity: 1 !important;
    cursor: not-allowed !important;
  }

  :is(
    button:disabled:not([id^="octo-"]):not([class*="PlayOverlay"]):not([class*="VideoMask"]):not([class*="ClickArea"]):not([class*="Player"] button),
    [role="button"][aria-disabled="true"]:not([id^="octo-"]):not([class*="PlayOverlay"]):not([class*="Player"] *)
  ) :where(span, div, p, strong, svg) {
    color: color-mix(in srgb, var(--octo-md-on-surface) 38%, transparent) !important;
  }

  [${ACCENT_ATTR}="primary-text"] {
    color: var(--octo-md-primary) !important;
  }

  [${SURFACE_ATTR}="field"] {
    background-color: var(--octo-md-surface-container-highest) !important;
    color: var(--octo-md-on-surface) !important;
    border: 0 !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 55%, transparent) !important;
    overflow: hidden !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      box-shadow ${motion(0.16)} var(--octo-md-ease) !important;
  }

  [${SURFACE_ATTR}="field"]:focus-within {
    background-color: var(--octo-md-surface-container-highest) !important;
    box-shadow: inset 0 0 0 2px var(--octo-md-primary) !important;
  }

  [${SURFACE_ATTR}="field"] :is(input, textarea, div, span):not(button):not([role="button"]),
  [${SURFACE_ATTR}="field"] :is(input, textarea)::before,
  [${SURFACE_ATTR}="field"] :is(input, textarea)::after,
  [${SURFACE_ATTR}="field"]::before,
  [${SURFACE_ATTR}="field"]::after {
    background-color: transparent !important;
    background-image: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    outline: none !important;
  }

  [${SURFACE_ATTR}="field"] :is(input, textarea) {
    color: var(--octo-md-on-surface) !important;
    caret-color: var(--octo-md-primary) !important;
  }

  input:where(:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="hidden"]):not([data-e2e="search-user-input"]):not([class*="Search"]):not([id^="octo-"])):not([${SURFACE_ATTR}="field"] *):not([data-e2e="search-box"] *):not(form[action*="/search"] *):not([class*="DivSearchBar"] *):not([class*="TUXTextInputCore"] *):not([class*="DivInputWrapper"] *),
  textarea:where(:not([id^="octo-"])):not([${SURFACE_ATTR}="field"] *),
  select:where(:not([id^="octo-"])) {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 14px !important;
    border-color: var(--octo-md-outline-variant) !important;
    caret-color: var(--octo-md-primary) !important;
  }

  @supports (appearance: base-select) {
    select:where(:not([id^="octo-"])),
    select:where(:not([id^="octo-"]))::picker(select) {
      appearance: base-select !important;
    }

    select:where(:not([id^="octo-"]))::picker(select) {
      margin-top: 4px !important;
      padding: 6px !important;
      border: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 65%, transparent) !important;
      border-radius: 20px !important;
      background-color: var(--octo-md-surface-container) !important;
      color: var(--octo-md-on-surface) !important;
      box-shadow: var(--octo-md-elevation-3) !important;
    }

    select:where(:not([id^="octo-"])) option {
      padding: 8px 12px !important;
      border-radius: 10px !important;
      background-color: transparent !important;
      color: var(--octo-md-on-surface-variant) !important;
    }

    select:where(:not([id^="octo-"])) option:hover {
      background-color: var(--octo-md-surface-container-high) !important;
      color: var(--octo-md-on-surface) !important;
    }

    select:where(:not([id^="octo-"])) option:checked {
      border-radius: 9999px !important;
      background-color: var(--octo-md-secondary-container) !important;
      color: var(--octo-md-on-secondary-container) !important;
    }
  }

  :is(
    [data-e2e="search-box"],
    form[action*="/search"],
    [data-e2e="comment-input"],
    [data-e2e="message-input-area"],
    [class*="DivCommentInput"],
    [class*="DivMessageInput"],
    [class*="DivChatInput"],
    [class*="TUXTextInputCore"],
    [class*="DivInputWrapper"]
  ) :where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea) {
    background-color: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  [class*="TUXTextInputCore"],
  [class*="DivInputWrapper"] {
    background-color: var(--octo-md-surface-container-high) !important;
    border-radius: 14px !important;
    border-color: var(--octo-md-outline-variant) !important;
    overflow: hidden !important;
  }

  [class*="TUXTextInputCore"]:focus-within,
  [class*="DivInputWrapper"]:focus-within {
    border-color: var(--octo-md-primary) !important;
    box-shadow: inset 0 0 0 2px var(--octo-md-primary) !important;
  }

  /* Страница настроек TikTok (/setting) и профиль/скелетоны */
  [class*="DivShareLayoutHeader" i],
  [class*="ShareLayoutHeader" i],
  [class*="DivUserLayout" i] > [class*="Header" i] {
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
  }

  [class*="DivPlaceholder" i],
  [class*="Skeleton" i],
  [class*="CoverPlaceholder" i] {
    background-color: var(--octo-md-surface-container) !important;
  }

  [${SURFACE_ATTR}="setting-nav"] {
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 20px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
    padding: 10px !important;
  }

  [${SURFACE_ATTR}="setting-nav-item"] {
    background-color: var(--octo-md-surface-container) !important;
    color: var(--octo-md-on-surface-variant) !important;
    border-radius: 6px !important;
    margin-bottom: 4px !important;
    transition:
      background-color ${motion(0.16)} var(--octo-md-ease),
      color ${motion(0.16)} var(--octo-md-ease) !important;
  }

  [${SURFACE_ATTR}="setting-nav-item"]:first-child {
    border-top-left-radius: 16px !important;
    border-top-right-radius: 16px !important;
  }

  [${SURFACE_ATTR}="setting-nav-item"]:last-child {
    border-bottom-left-radius: 16px !important;
    border-bottom-right-radius: 16px !important;
  }

  [${SURFACE_ATTR}="setting-nav-item"]:hover {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="setting-nav-active"],
  [${SURFACE_ATTR}="setting-nav-active"]:hover {
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    border-radius: 9999px !important;
    margin-bottom: 4px !important;
    font-weight: 600 !important;
  }

  :is([${SURFACE_ATTR}="setting-nav-active"], [${SURFACE_ATTR}="setting-nav-active"] *) {
    color: var(--octo-md-on-secondary-container) !important;
  }

  [${SURFACE_ATTR}="setting-pane"] {
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    border-radius: 20px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="setting-pane"] :where(h1, h2, h3, h4, strong) {
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="setting-pane"] > div:not([role="switch"]),
  [${SURFACE_ATTR}="setting-pane"] section {
    border-color: color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  input[type="checkbox"],
  input[type="radio"],
  input[type="range"] {
    accent-color: var(--octo-md-primary) !important;
  }

  [role="switch"],
  [class*="TUXSwitch"]:not([class*="Thumb"]):not([class*="Dot"]),
  [class*="DivSwitch"] {
    border-radius: 9999px !important;
    opacity: 1 !important;
  }

  [role="switch"][aria-checked="true"],
  [class*="TUXSwitch"][aria-checked="true"],
  [class*="TUXSwitch"][data-checked="true"],
  [${ACCENT_ATTR}="switch"] {
    background-color: var(--octo-md-primary) !important;
    box-shadow: none !important;
    opacity: 1 !important;
  }

  [role="switch"][aria-checked="true"] > *,
  [${ACCENT_ATTR}="switch"] > * {
    background-color: var(--octo-md-on-primary) !important;
    opacity: 1 !important;
  }

  [${ACCENT_ATTR}="switch-off"] {
    background-color: var(--octo-md-surface-container-highest) !important;
    box-shadow: inset 0 0 0 1.5px var(--octo-md-outline) !important;
    opacity: 1 !important;
  }

  [${ACCENT_ATTR}="switch-off"] > * {
    background-color: var(--octo-md-outline) !important;
    opacity: 1 !important;
  }

  [data-e2e="inbox-badge"],
  [class*="TUXBadge"]:not([class*="wrapper"]):not([class*="Wrapper"]),
  [class*="DivBadge"],
  [${ACCENT_ATTR}="badge"] {
    border-radius: 9999px !important;
    background-color: var(--octo-md-primary) !important;
    color: var(--octo-md-on-primary) !important;
  }

  :is(
    [data-e2e="inbox-badge"],
    [class*="TUXBadge"]:not([class*="wrapper"]):not([class*="Wrapper"]),
    [class*="DivBadge"],
    [${ACCENT_ATTR}="badge"]
  ) :where(span, div, p, strong, sup) {
    color: var(--octo-md-on-primary) !important;
  }

  [data-e2e="search-common-link"],
  a[href^="/tag/"],
  a[href^="/music/"] {
    color: var(--octo-md-secondary) !important;
  }

  :where(
    button:not([id^="octo-"]),
    a[href]:not([id^="octo-"]),
    input:not([id^="octo-"]),
    select:not([id^="octo-"]),
    textarea:not([id^="octo-"]),
    [role="tab"]:not([id^="octo-"]),
    [role="menuitem"]:not([id^="octo-"]),
    [tabindex]:not([tabindex="-1"]):not([id^="octo-"])
  ):focus-visible {
    outline: 2px solid var(--octo-md-primary) !important;
    outline-offset: 2px !important;
  }

  ::-webkit-scrollbar {
    width: 8px !important;
    height: 8px !important;
  }

  ::-webkit-scrollbar-track {
    background: transparent !important;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 9999px !important;
    background: color-mix(in srgb, var(--octo-md-outline-variant) 85%, transparent) !important;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--octo-md-outline) !important;
  }
`;

const TOKEN_ROOTS = `
    :root,
    html,
    body,
    [data-theme],
    [data-tux-theme],
    [data-tux-color-scheme],
    [class*="ThemeProvider"],
    [${MD3_ATTR}]`;

function siteCss(dark = true, paletteId = DEFAULT_PALETTE) {
  return `
    ${TOKEN_ROOTS} {
      ${tokenDeclarations(dark, paletteId)}
    }
    ${reducedMotionCss(TOKEN_ROOTS)}
    ${BASE_CANVAS_CSS}
    ${COMPONENT_CSS}
  `;
}

function shadowCss(dark = true, paletteId = DEFAULT_PALETTE) {
  return `
    :host {
      ${tokenDeclarations(dark, paletteId)}
    }
    ${reducedMotionCss(':host')}
    ${COMPONENT_CSS}
  `;
}

function syncScript(dark = true) {
  const mode = dark ? 'dark' : 'light';
  return `(() => {
    const ATTR = '${MD3_ATTR}';
    const ACCENT = '${ACCENT_ATTR}';
    const NAV = '${NAV_ATTR}';
    const POS = '${POS_ATTR}';
    const BTN_GROUP = '${BTN_GROUP_ATTR}';
    const ICON = '${ICON_ATTR}';
    const ACTION = '${ACTION_ATTR}';
    const SURFACE = '${SURFACE_ATTR}';
    const FG = '${FG_ATTR}';
    const CHAT_LAYOUT = '${CHAT_LAYOUT_ATTR}';
    const MODE = '${mode}';

    const setAttrIfDiff = (el, name, value) => {
      if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    };
    const delAttrIfSet = (el, name) => {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    };
    const isTikTokRedAttr = (el) => {
      const fill = el.getAttribute('fill');
      return Boolean(fill && /^#(?:fe2c55|ff3b5c|ea284e)$/i.test(fill.trim()));
    };

    const parseRgb = (value) => {
      const m = String(value || '').match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*,\\s*([\\d.]+))?\\s*\\)/i);
      if (!m) return null;
      const alpha = m[4] === undefined ? 1 : Number(m[4]);
      if (!alpha) return null;
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
    };

    const isLightColor = (value) => {
      const c = parseRgb(value);
      return Boolean(c && c.a >= 0.7 && c.r >= 200 && c.g >= 200 && c.b >= 200);
    };

    const isDarkColor = (value) => {
      const c = parseRgb(value);
      return Boolean(c && c.a >= 0.5 && c.r <= 115 && c.g <= 115 && c.b <= 115);
    };

    const luminanceOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

    const effectiveBgLum = (el, lumCache = null) => {
      if (lumCache && lumCache.has(el)) return lumCache.get(el);
      const chain = [];
      let cur = el;
      let result = MODE === 'dark' ? 25 : 246;
      while (cur && cur.nodeType === 1) {
        if (lumCache && lumCache.has(cur)) {
          result = lumCache.get(cur);
          break;
        }
        chain.push(cur);
        const c = parseRgb(getComputedStyle(cur).backgroundColor);
        if (c && c.a >= 0.5) {
          result = luminanceOf(c);
          break;
        }
        cur = cur.parentElement;
      }
      if (lumCache) {
        for (const node of chain) lumCache.set(node, result);
      }
      return result;
    };

    const isMessagesTopPage = () => /^\\/messages(?:\\/|$)/i.test(location.pathname || '');

    const isMessagesRoute = () =>
      isMessagesTopPage() ||
      /^\\/business-suite(?:\\/|$)/i.test(location.pathname || '') ||
      /business\\.tiktok\\.com/i.test(location.hostname || '');

    const isMessagesContext = () =>
      isMessagesRoute() ||
      Boolean(
        document.querySelector(
          '[data-e2e="chat-list-item"], [class*="SessionList" i], [class*="DivConversationList"], [class*="DivChatMain"], [data-e2e="message-input-area"]',
        ),
      );

    // Фирменный розово-красный TikTok (#fe2c55, #ff3b5c, #ea284e и приглушённый)
    const isTikTokRed = (value) => {
      const c = parseRgb(value);
      if (!c || c.a < 0.15) return false;
      if (c.r >= 200 && c.g <= 105 && c.b >= 35 && c.b <= 145) return true;
      return c.r >= 95 && c.r >= c.g * 1.65 && c.r > c.b * 1.15 && c.g <= 115 && c.b <= 140;
    };

    // Фирменный бирюзовый / тиловый TikTok (#25f4ee, #20d5ec, приглушённый трек свитча)
    const isTikTokCyan = (value) => {
      const c = parseRgb(value);
      return Boolean(
        c &&
          c.g >= 55 &&
          c.b >= 55 &&
          c.r <= c.g * 0.68 &&
          Math.abs(c.g - c.b) <= 75,
      );
    };

    const isLiveRoute = () =>
      /^\\/live(?:\\/|$)/i.test(location.pathname || '') ||
      /^\\/@[^/]+\\/live(?:\\/|$)/i.test(location.pathname || '');

    const NAV_ROUTES = {
      'nav-foryou': (p) => p === '/' || p.startsWith('/foryou'),
      'nav-explore': (p) => p.startsWith('/explore'),
      'nav-following': (p) => p.startsWith('/following'),
      'nav-friends': (p) => p.startsWith('/friends'),
      'nav-live': (p) => p === '/live' || p.startsWith('/live/') || /^\\/@[^/]+\\/live(?:\\/|$)/.test(p),
      'nav-messages': (p) => p.startsWith('/messages'),
      'nav-upload': (p) => p.startsWith('/upload'),
      'nav-profile': (p) => p.startsWith('/@') && !/^\\/@[^/]+\\/live(?:\\/|$)/.test(p),
    };

    const PATH_ROUTE_KEY = {
      '/': 'nav-foryou',
      '/foryou': 'nav-foryou',
      '/explore': 'nav-explore',
      '/following': 'nav-following',
      '/friends': 'nav-friends',
      '/live': 'nav-live',
      '/messages': 'nav-messages',
      '/upload': 'nav-upload',
    };

    const matchesRoute = (item) => {
      const current = location.pathname.replace(/\\/+$/, '') || '/';
      const e2e = item.getAttribute('data-e2e');
      if (e2e && NAV_ROUTES[e2e] && NAV_ROUTES[e2e](current)) return true;
      if (!(item instanceof HTMLAnchorElement)) return false;
      try {
        const href = new URL(item.href, location.href).pathname.replace(/\\/+$/, '') || '/';
        if (href === current) return true;
        const routeKey = PATH_ROUTE_KEY[href];
        if (routeKey && NAV_ROUTES[routeKey] && NAV_ROUTES[routeKey](current)) {
          return true;
        }
      } catch {
        /* некорректный URL */
      }
      return false;
    };

    const observedRails = new WeakSet();
    let railObserver = null;

    const findSidebars = () => {
      const result = new Set(document.querySelectorAll('[class*="DivSideNavContainer"]'));
      const navAnchors = Array.from(
        document.querySelectorAll(
          '[data-e2e^="nav-"], a[href="/foryou"], a[href="/explore"], a[href="/following"], a[href="/friends"], a[href="/live"], a[href="/messages"], a[href="/upload"]',
        ),
      ).filter((el) => {
        if (el.id?.startsWith('octo-') || el.closest('[' + SURFACE + '="drawer"], [role="dialog"], header, [role="banner"]')) {
          return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left <= 320;
      });

      if (navAnchors.length >= 3) {
        for (const anchor of navAnchors) {
          let cur = anchor.parentElement;
          let picked = null;
          while (
            cur &&
            cur !== document.body &&
            cur !== document.documentElement &&
            cur.id !== 'app' &&
            cur.id !== 'root'
          ) {
            if (cur.matches('main, [role="main"], .live-room-container') || cur.querySelector('main, [role="main"], [data-e2e="live-room-content"], video')) {
              break;
            }
            const r = cur.getBoundingClientRect();
            if (r.width > 360) break;
            if (r.left <= 24 && r.width >= 48 && r.height >= 260) {
              const count = navAnchors.filter((a) => cur.contains(a)).length;
              if (count >= 3) picked = cur;
            }
            cur = cur.parentElement;
          }
          if (picked) {
            result.add(picked);
            break;
          }
        }
      }

      document
        .querySelectorAll('[' + SURFACE + '="sidenav"]')
        .forEach((el) => {
          if (!result.has(el)) el.removeAttribute(SURFACE);
        });
      for (const el of result) {
        if (el.getAttribute(SURFACE) !== 'sidenav') el.setAttribute(SURFACE, 'sidenav');
      }
      return Array.from(result);
    };

    const syncRailState = (sidebar) => {
      const sRect = sidebar.getBoundingClientRect();
      if (sRect.width > 0 && sRect.width < 120) {
        setAttrIfDiff(sidebar, 'data-octo-md3-rail', 'collapsed');
      } else {
        delAttrIfSet(sidebar, 'data-octo-md3-rail');
      }
      return sRect;
    };

    const isExplicitSearchItem = (item, itemClass, itemE2e, itemLabel) =>
      Boolean(item.closest('[data-e2e="search-box"], form[action*="/search"]')) ||
      /Search/i.test(itemClass) ||
      /search/i.test(itemE2e) ||
      /^(?:search|поиск)$/i.test(itemLabel);

    const isExplicitToggleItem = (item, itemClass, itemE2e, itemLabel) => {
      const toggleHint = (
        item.getAttribute('aria-label') ||
        item.getAttribute('title') ||
        item.getAttribute('data-original-title') ||
        ''
      ).trim();
      return (
        !itemE2e.startsWith('nav-') &&
        (/^(?:expand|collapse)\s*sidebar$/i.test(itemLabel) ||
          /^(?:развернуть|свернуть)\s+боковую\s+панель$/i.test(itemLabel) ||
          /(?:развернуть|свернуть)\s+боковую|(?:expand|collapse)\s*side\s*bar/i.test(toggleHint) ||
          /(?:side[-_]?nav|sidebar)[-_]?(?:toggle|collapse|expand)|(?:toggle|collapse|expand)[-_]?(?:side[-_]?nav|sidebar)/i.test(
            itemClass + ' ' + itemE2e,
          ))
      );
    };

    const syncSidebarNav = () => {
      const sidebars = findSidebars();
      const nextLogos = new Set();
      for (const sidebar of sidebars) {
        if (!observedRails.has(sidebar) && typeof ResizeObserver !== 'undefined') {
          observedRails.add(sidebar);
          if (!railObserver) {
            railObserver = new ResizeObserver((entries) => {
              for (const entry of entries) syncRailState(entry.target);
              scheduleScan();
            });
          }
          railObserver.observe(sidebar);
        }
        syncRailState(sidebar);

        const firstNavAnchor =
          sidebar.querySelector('[data-e2e="nav-foryou"]') ||
          Array.from(sidebar.querySelectorAll('a[href="/foryou"], a[href="/"]')).find(
            (el) =>
              el.getAttribute('data-e2e') !== 'tiktok-logo' &&
              !el.querySelector('[data-e2e="tiktok-logo"]'),
          ) ||
          null;
        const firstNavTop = firstNavAnchor ? firstNavAnchor.getBoundingClientRect().top : Infinity;

        const nextSideSurfaces = new Map();
        const nextToggleAbs = new Set();
        const nextCreatorPos = new Map();
        const nextNavState = new Map();
        const nextPosState = new Map();
        const nextNavIcons = new Map();
        const headerSeeds = [];
        const items = sidebar.querySelectorAll('a, button, [role="button"]');
        const itemEntries = [];
        const explicitSearchRects = [];
        const groupItems = [];
        const creatorItems = [];
        const visualsToCheck = [];

        for (const item of items) {
          if (item.getAttribute('data-e2e') === 'tiktok-logo') {
            headerSeeds.push(item);
            continue;
          }
          if (item.querySelector('[data-e2e="tiktok-logo"]')) {
            nextLogos.add(item);
            headerSeeds.push(item);
            continue;
          }
          if (item.closest('[' + SURFACE + '="drawer"]')) {
            continue;
          }
          const outerItem = item.parentElement?.closest('a, button, [role="button"]');
          if (outerItem && sidebar.contains(outerItem) && outerItem.getAttribute('data-e2e') !== 'tiktok-logo') {
            continue;
          }

          const itemRect = item.getBoundingClientRect();
          const itemClass = typeof item.className === 'string' ? item.className : '';
          const itemE2e = item.getAttribute('data-e2e') || '';
          const itemLabel = (item.getAttribute('aria-label') || item.textContent || '').trim();
          const explicitSearch = isExplicitSearchItem(item, itemClass, itemE2e, itemLabel);
          if (explicitSearch && itemRect.height > 0) explicitSearchRects.push(itemRect);
          itemEntries.push({ item, itemRect, itemClass, itemE2e, itemLabel, explicitSearch });
        }

        for (const entry of itemEntries) {
          const { item, itemRect, itemClass, itemE2e, itemLabel, explicitSearch } = entry;
          const topControlAboveNav =
            !itemE2e.startsWith('nav-') &&
            firstNavTop < Infinity &&
            itemRect.height > 0 &&
            itemRect.bottom <= firstNavTop + 4;
          const hasSearchBelow =
            topControlAboveNav && explicitSearchRects.some((r) => r.top >= itemRect.bottom - 2);
          const isToggleItem =
            !explicitSearch &&
            (isExplicitToggleItem(item, itemClass, itemE2e, itemLabel) || hasSearchBelow);
          if (isToggleItem) {
            nextSideSurfaces.set(item, 'sidenav-toggle');
            headerSeeds.push(item);
            if (getComputedStyle(item).position === 'absolute') nextToggleAbs.add(item);
            continue;
          }

          const isSearchItem =
            explicitSearch || (item.tagName === 'BUTTON' && topControlAboveNav);
          if (isSearchItem) {
            if (!item.closest('[data-e2e="search-box"], form[action*="/search"]')) {
              nextSideSurfaces.set(item, 'sidenav-search');
            }
            continue;
          }

          const isNavControl =
            itemE2e.startsWith('nav-') ||
            Boolean(item.querySelector('[data-e2e^="nav-"]')) ||
            /^(?:profile|профиль)$/i.test(itemLabel);
          const hasAvatarImg = Array.from(item.querySelectorAll('img')).some((img) => {
            if (img.hasAttribute('data-octo-brand-img')) return false;
            const ir = img.getBoundingClientRect();
            return ir.width >= 16 && ir.width <= 64 && ir.height >= 16 && ir.height <= 64;
          });
          const isCreatorItem =
            !isNavControl &&
            (Boolean(item.closest('[class*="DivUserContainer"], [class*="DivAccountItem"]')) ||
              hasAvatarImg ||
              (item instanceof HTMLAnchorElement && /^\\/@[^/]+\\/live/i.test(new URL(item.href, location.href).pathname)));
          if (isCreatorItem) {
            if (itemRect.width > 0 && itemRect.height > 0) {
              nextSideSurfaces.set(item, 'sidenav-creator');
              creatorItems.push({ el: item, rect: itemRect });
            }
            continue;
          }

          const isFooterItem =
            Boolean(item.closest('[class*="Coin" i], [class*="Recharge" i], [class*="Promote" i], [class*="Footer"]')) ||
            /Coin|Recharge|Promote/i.test(itemClass) ||
            /coin|recharge|promote/i.test(itemE2e) ||
            (item instanceof HTMLAnchorElement && /\\/(?:coin|recharge)/i.test(item.pathname || '')) ||
            (item.tagName === 'BUTTON' &&
              /TUXButton--primary/i.test(itemClass) &&
              !item.closest('[class*="Login" i]') &&
              !/login/i.test(itemE2e) &&
              itemRect.top > firstNavTop + 120);
          if (isFooterItem) {
            nextSideSurfaces.set(item, 'sidenav-footer');
            continue;
          }

          let active =
            item.getAttribute('aria-current') === 'page' ||
            item.getAttribute('aria-selected') === 'true' ||
            item.getAttribute('data-active') === 'true' ||
            Boolean(item.querySelector('[aria-current="page"], [aria-selected="true"], [data-active="true"]')) ||
            isTikTokRed(getComputedStyle(item).color) ||
            matchesRoute(item);

          if (!active) {
            const innerTargets = item.querySelectorAll('a, [data-e2e^="nav-"]');
            for (const target of innerTargets) {
              if (matchesRoute(target)) {
                active = true;
                break;
              }
            }
          }

          const itemKey =
            (active ? '1' : '0') +
            '|' +
            (item.getAttribute('class') || '') +
            '|' +
            (item.getAttribute('aria-current') || '');
          const visuals = item.querySelectorAll('svg, svg path, span');
          for (const node of visuals) {
            if (isTikTokRedAttr(node)) {
              nextNavIcons.set(node, 'active');
              active = true;
              continue;
            }
            const nodeKey = itemKey + '|' + (node.getAttribute('class') || '') + '|' + (node.getAttribute('fill') || '');
            if (node.getAttribute(ICON) === 'active' && node.dataset.octoMd3NavKey === nodeKey) {
              nextNavIcons.set(node, 'active');
              continue;
            }
            visualsToCheck.push({ node, item, nodeKey });
          }

          if (active) nextNavState.set(item, 'active');

          if (
            !item.closest('[' + SURFACE + '="drawer"], [class*="Login" i]') &&
            (isNavControl || !/Account|User|Login/i.test(itemClass)) &&
            !/login/i.test(itemE2e)
          ) {
            if (itemRect.width > 0 && itemRect.height > 0) {
              groupItems.push({ el: item, rect: itemRect });
            }
          }
        }

        // Batch-check only visuals whose key changed or aren't already active
        const resetForRead = [];
        for (const entry of visualsToCheck) {
          if (entry.node.hasAttribute(ICON)) {
            entry.node.removeAttribute(ICON);
            resetForRead.push(entry);
          }
        }
        for (const entry of visualsToCheck) {
          const style = getComputedStyle(entry.node);
          entry.node.dataset.octoMd3NavKey = entry.nodeKey;
          if (isTikTokRed(style.color) || isTikTokRed(style.fill)) {
            nextNavIcons.set(entry.node, 'active');
            nextNavState.set(entry.item, 'active');
          }
        }
        for (const entry of resetForRead) {
          if (nextNavIcons.has(entry.node)) entry.node.setAttribute(ICON, 'active');
        }

        if (creatorItems.length === 1) {
          nextCreatorPos.set(creatorItems[0].el, 'single');
        } else if (creatorItems.length > 1) {
          creatorItems.forEach((entry, idx) => {
            nextCreatorPos.set(
              entry.el,
              idx === 0 ? 'first' : idx === creatorItems.length - 1 ? 'last' : 'mid',
            );
          });
        }

        // Разделяем пункты сайдбара на непрерывные вертикальные группы (разрыв > 18px)
        const clusters = [];
        for (const entry of groupItems) {
          const lastCluster = clusters[clusters.length - 1];
          const prev = lastCluster?.[lastCluster.length - 1];
          if (prev && entry.rect.top - prev.rect.bottom <= 18) {
            lastCluster.push(entry);
          } else {
            clusters.push([entry]);
          }
        }
        const findNavSlot = (item, sidebarEl) => {
          let slot = item;
          let cur = item.parentElement;
          const ir = item.getBoundingClientRect();
          for (let depth = 0; depth < 5 && cur && cur !== sidebarEl && cur !== document.body; depth += 1) {
            if (cur.matches('nav, ul, [class*="Scroll"]')) break;
            const hasSiblingControl = Array.from(
              cur.querySelectorAll('a, button, [role="button"]'),
            ).some((n) => n !== item && !item.contains(n) && !n.contains(item));
            if (hasSiblingControl) break;
            const cr = cur.getBoundingClientRect();
            if (cr.height > ir.height + 24) break;
            slot = cur;
            cur = cur.parentElement;
          }
          return slot;
        };

        const nextNavSlots = new Map();
        const nextNavSlotParents = new Set();
        for (const cluster of clusters) {
          if (cluster.length === 1) {
            const el = cluster[0].el;
            nextPosState.set(el, 'single');
            const slot = findNavSlot(el, sidebar);
            nextNavSlots.set(slot, slot === el ? 'self' : 'wrapper');
            if (slot.parentElement) nextNavSlotParents.add(slot.parentElement);
          } else {
            cluster.forEach((entry, idx) => {
              const role = idx === 0 ? 'first' : idx === cluster.length - 1 ? 'last' : 'mid';
              nextPosState.set(entry.el, role);
              const slot = findNavSlot(entry.el, sidebar);
              nextNavSlots.set(slot, slot === entry.el ? 'self' : 'wrapper');
              if (slot.parentElement) nextNavSlotParents.add(slot.parentElement);
            });
          }
        }

        for (const seed of headerSeeds) {
          let bestHeader = null;
          let cur = seed.parentElement;
          while (cur && cur !== sidebar) {
            if (
              (firstNavAnchor && cur.contains(firstNavAnchor)) ||
              cur.querySelector(
                '[data-e2e^="nav-"], [data-e2e="search-box"], [data-e2e="search-button"], [class*="Search"]',
              ) ||
              Array.from(nextSideSurfaces.entries()).some(
                ([el, role]) => role === 'sidenav-search' && cur.contains(el),
              )
            ) {
              break;
            }
            bestHeader = cur;
            cur = cur.parentElement;
          }
          if (bestHeader && bestHeader.getBoundingClientRect().height <= 120) {
            nextSideSurfaces.set(bestHeader, 'sidenav-header');
          }
        }

        // Diff-apply all sidebar attributes after reads
        sidebar
          .querySelectorAll(
            '[' +
              SURFACE +
              '="sidenav-search"], [' +
              SURFACE +
              '="sidenav-toggle"], [' +
              SURFACE +
              '="sidenav-header"], [' +
              SURFACE +
              '="sidenav-creator"], [' +
              SURFACE +
              '="sidenav-footer"]',
          )
          .forEach((el) => {
            if (!nextSideSurfaces.has(el)) delAttrIfSet(el, SURFACE);
          });
        for (const [el, val] of nextSideSurfaces) setAttrIfDiff(el, SURFACE, val);

        sidebar.querySelectorAll('[data-octo-md3-toggle-abs]').forEach((el) => {
          if (!nextToggleAbs.has(el)) delAttrIfSet(el, 'data-octo-md3-toggle-abs');
        });
        for (const el of nextToggleAbs) setAttrIfDiff(el, 'data-octo-md3-toggle-abs', '1');

        sidebar.querySelectorAll('[data-octo-md3-creator-pos]').forEach((el) => {
          if (!nextCreatorPos.has(el)) delAttrIfSet(el, 'data-octo-md3-creator-pos');
        });
        for (const [el, val] of nextCreatorPos) setAttrIfDiff(el, 'data-octo-md3-creator-pos', val);

        sidebar.querySelectorAll('[' + NAV + ']').forEach((el) => {
          if (!nextNavState.has(el)) delAttrIfSet(el, NAV);
        });
        for (const [el, val] of nextNavState) setAttrIfDiff(el, NAV, val);

        sidebar.querySelectorAll('[' + POS + ']').forEach((el) => {
          if (!nextPosState.has(el)) delAttrIfSet(el, POS);
        });
        for (const [el, val] of nextPosState) setAttrIfDiff(el, POS, val);

        sidebar.querySelectorAll('[' + ICON + ']').forEach((el) => {
          if (!nextNavIcons.has(el)) delAttrIfSet(el, ICON);
        });
        for (const [el, val] of nextNavIcons) setAttrIfDiff(el, ICON, val);

        sidebar.querySelectorAll('[data-octo-md3-nav-slot]').forEach((el) => {
          if (!nextNavSlots.has(el)) delAttrIfSet(el, 'data-octo-md3-nav-slot');
        });
        for (const [slot, val] of nextNavSlots) setAttrIfDiff(slot, 'data-octo-md3-nav-slot', val);

        sidebar.querySelectorAll('[data-octo-md3-nav-slot-parent]').forEach((el) => {
          if (!nextNavSlotParents.has(el)) delAttrIfSet(el, 'data-octo-md3-nav-slot-parent');
        });
        for (const parent of nextNavSlotParents) setAttrIfDiff(parent, 'data-octo-md3-nav-slot-parent', '1');
      }

      document.querySelectorAll('[data-octo-md3-logo]').forEach((el) => {
        if (!nextLogos.has(el)) delAttrIfSet(el, 'data-octo-md3-logo');
      });
      for (const el of nextLogos) setAttrIfDiff(el, 'data-octo-md3-logo', '1');
    };

    const syncButtonGroups = (root) => {
      const btnSelector = ':scope > button:not([id^="octo-"]):not([class*="PlayOverlay"]):not([class*="VideoMask"]):not([class*="ClickArea"]):not([class*="ButtonActionItem"]):not([role="tab"]):not([role="menuitem"]):not([role="switch"]), :scope > a[role="button"]:not([id^="octo-"]):not([data-e2e="tiktok-logo"]):not([role="tab"]):not([role="menuitem"]), :scope > [class*="TUXButton"]:not([id^="octo-"])';
      const containers = new Set();
      root.querySelectorAll('button, a[role="button"], [class*="TUXButton"]').forEach((btn) => {
        if (
          btn.id?.startsWith('octo-') ||
          btn.closest(
            '[class*="DivSideNavContainer"], [' +
              SURFACE +
              '="sidenav"], [' +
              SURFACE +
              '="drawer"], [class*="Player"], [class*="DivVideoWrapper"], [class*="SeekBar"], [class*="Control"], [class*="ActionBar"], [class*="DivActionItemContainer"]',
          ) ||
          btn.getAttribute(SURFACE) === 'player-more'
        ) {
          return;
        }
        if (btn.parentElement) containers.add(btn.parentElement);
      });

      const nextBtnGroup = new Map();
      const clearBtnGroup = [];
      for (const parent of containers) {
        if (parent.id?.startsWith('octo-')) continue;
        const buttons = Array.from(parent.querySelectorAll(btnSelector)).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height <= 64;
        });
        if (buttons.length < 2 || buttons.length > 6) {
          for (const el of buttons) {
            if (el.hasAttribute(BTN_GROUP)) clearBtnGroup.push(el);
          }
          continue;
        }

        const rects = buttons.map((el) => el.getBoundingClientRect());
        const horizontal = rects.every((r, i) => {
          if (i === 0) return true;
          const prev = rects[i - 1];
          const gap = r.left - prev.right;
          return Math.abs(r.top - prev.top) <= 8 && gap >= -2 && gap <= 18;
        });
        if (horizontal) {
          buttons.forEach((el, idx) => {
            nextBtnGroup.set(el, idx === 0 ? 'h-first' : idx === buttons.length - 1 ? 'h-last' : 'h-mid');
          });
          continue;
        }

        const vertical = rects.every((r, i) => {
          if (i === 0) return true;
          const prev = rects[i - 1];
          const gap = r.top - prev.bottom;
          return Math.abs(r.left - prev.left) <= 8 && gap >= -2 && gap <= 16;
        });
        if (vertical) {
          buttons.forEach((el, idx) => {
            nextBtnGroup.set(el, idx === 0 ? 'v-first' : idx === buttons.length - 1 ? 'v-last' : 'v-mid');
          });
        } else {
          for (const el of buttons) {
            if (el.hasAttribute(BTN_GROUP)) clearBtnGroup.push(el);
          }
        }
      }
      for (const el of clearBtnGroup) delAttrIfSet(el, BTN_GROUP);
      for (const [el, role] of nextBtnGroup) setAttrIfDiff(el, BTN_GROUP, role);
    };

    const syncMessagesLayout = () => {
      if (!isMessagesTopPage()) {
        if (document.querySelector('[' + CHAT_LAYOUT + ']')) {
          document.querySelectorAll('[' + CHAT_LAYOUT + ']').forEach((el) => delAttrIfSet(el, CHAT_LAYOUT));
        }
        return;
      }

      const nextLayout = new Map();
      const mediaOrInputSelector =
        'img, video, canvas, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], button, a[href], [data-e2e="tiktok-logo"], [data-e2e^="nav-"]';
      const hasRealNav = (el) =>
        el.matches('[class*="DivSideNavContainer"], nav') &&
        Boolean(el.querySelector('[data-e2e^="nav-"], a[href]'));
      let workspace = null;
      let isBusinessFrame = false;
      for (const frame of document.querySelectorAll('iframe')) {
        const src = frame.getAttribute('src') || '';
        if (/(?:recaptcha|hcaptcha|turnstile|arkoselabs|stripe|paypal|accounts\\.)/i.test(src)) {
          continue;
        }
        const r = frame.getBoundingClientRect();
        if (frame.getAttribute(CHAT_LAYOUT) === 'frame' || (r.width >= 240 && r.height >= 200)) {
          workspace = frame;
          isBusinessFrame = /(?:business-suite|business\\.tiktok)/i.test(src);
          break;
        }
      }

      const isEmptyPane = (el) => {
        if (!el || el.id?.startsWith('octo-')) return false;
        if (
          hasRealNav(el) ||
          el.querySelector('[class*="DivSideNavContainer"] [data-e2e^="nav-"], [class*="DivSideNavContainer"] a[href], nav a[href]')
        ) {
          return false;
        }
        if (el.querySelector(mediaOrInputSelector)) {
          if (
            isBusinessFrame &&
            !el.querySelector('img, video, canvas, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [data-e2e="chat-list-item"], [data-e2e^="nav-"]')
          ) {
            return true;
          }
          return false;
        }
        if (isBusinessFrame && !el.querySelector('[data-e2e="chat-list-item"], [class*="DivConversationItem"]')) {
          return true;
        }
        return (el.innerText || '').trim().length === 0;
      };

      if (!workspace) {
        for (const candidate of document.querySelectorAll(
          '[class*="SessionList" i], [class*="ConversationList" i], [class*="ChatList" i], [class*="Inbox" i]',
        )) {
          const r = candidate.getBoundingClientRect();
          const inManaged = Boolean(
            candidate.closest('[' + CHAT_LAYOUT + '="host"], [' + CHAT_LAYOUT + '="flush"]'),
          );
          if ((r.left >= 180 || inManaged) && r.width >= 200 && r.height >= 240 && (candidate.innerText || '').trim()) {
            workspace = candidate;
            break;
          }
        }
      }

      if (workspace) {
        const wsRect = workspace.getBoundingClientRect();
        const isFrame = workspace.tagName === 'IFRAME';
        const alreadyManaged =
          workspace.getAttribute(CHAT_LAYOUT) === 'frame' ||
          Boolean(workspace.closest('[' + CHAT_LAYOUT + '="host"], [' + CHAT_LAYOUT + '="flush"]'));
        if (wsRect.left >= 180 || alreadyManaged) {
          const ancestors = [];
          let anyHidden = false;
          let anyFlushed = false;
          let cur = workspace;
          while (cur && cur.parentElement && cur.parentElement !== document.documentElement) {
            const parent = cur.parentElement;
            for (const sibling of parent.children) {
              if (sibling === cur || sibling.id?.startsWith('octo-')) continue;
              const wasHidden = sibling.getAttribute(CHAT_LAYOUT) === 'hidden';
              if (!wasHidden) {
                const sr = sibling.getBoundingClientRect();
                if (sr.width < 40 || sr.height < 200 || sr.right > wsRect.left + 20) continue;
              }
              if (isEmptyPane(sibling)) {
                nextLayout.set(sibling, 'hidden');
                anyHidden = true;
              }
            }
            if (cur !== workspace && parent !== document.body) {
              ancestors.push(cur);
            }
            cur = parent;
          }

          if (isFrame) {
            nextLayout.set(workspace, 'frame');
          }

          const hasVisibleSideNav = Array.from(
            document.querySelectorAll('[class*="DivSideNavContainer"]'),
          ).some((nav) => {
            const nr = nav.getBoundingClientRect();
            return nr.width >= 48 && nr.height >= 200 && Boolean(nav.querySelector('[data-e2e^="nav-"], a[href]'));
          });

          if (!hasVisibleSideNav) {
            let node = workspace.parentElement;
            while (node && node !== document.body && node !== document.documentElement) {
              if (node.getAttribute(CHAT_LAYOUT) === 'flush') {
                nextLayout.set(node, 'flush');
                anyFlushed = true;
              } else {
                const st = getComputedStyle(node);
                if (parseFloat(st.marginLeft) >= 120 || parseFloat(st.paddingLeft) >= 120) {
                  nextLayout.set(node, 'flush');
                  anyFlushed = true;
                }
              }
              node = node.parentElement;
            }
          }

          if (isFrame || anyHidden || anyFlushed) {
            for (const el of ancestors) nextLayout.set(el, 'host');
          }
        }
      }

      document.querySelectorAll('[' + CHAT_LAYOUT + ']').forEach((el) => {
        if (!nextLayout.has(el)) delAttrIfSet(el, CHAT_LAYOUT);
      });
      for (const [el, val] of nextLayout) setAttrIfDiff(el, CHAT_LAYOUT, val);
    };

    const MANAGED_SURFACES = new Set([
      'drawer',
      'drawer-segmented',
      'page',
      'field',
      'tab-bar',
      'profile-head',
      'chip',
      'chip-active',
      'chip-bar',
      'setting-nav',
      'setting-nav-item',
      'setting-nav-active',
      'setting-pane',
      'live-stage',
      'live-footer',
      'live-chat',
      'live-chat-pane',
      'live-chat-input',
      'comments',
      'comment-input',
      'header',
      'chat-active',
      'card',
      'chat-input',
    ]);

    const syncSurfaces = (root) => {
      findSidebars();
      const nextSurface = new Map();
      const nextFg = new Set();
      const lumCache = new WeakMap();
      const hasPlannedAncestor = (el, value, includeSelf = false) => {
        let cur = includeSelf ? el : el.parentElement;
        while (cur && cur.nodeType === 1) {
          const planned = nextSurface.get(cur);
          if (planned === value) return true;
          if (!planned && cur.getAttribute(SURFACE) === value && !MANAGED_SURFACES.has(value)) return true;
          cur = cur.parentElement;
        }
        return false;
      };

      // Выдвижные шторки («Ещё», «Уведомления») помечаем первыми, чтобы вкладки и чипы внутри знали про drawer.
      const drawerCandidates = root.querySelectorAll(
        '[class*="DivSideNavContainer"] div, [class*="DivSideNavContainer"] section, [' +
          SURFACE +
          '="sidenav"] div, [' +
          SURFACE +
          '="sidenav"] section, body > div',
      );
      for (const el of drawerCandidates) {
        if (
          el.id?.startsWith('octo-') ||
          el.matches('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], [data-e2e="search-transfer-list"], [role="tooltip"]') ||
          el.querySelector('[' + SURFACE + '="sidenav"], [data-e2e="tiktok-logo"], [data-e2e="search-box"], [data-e2e="nav-foryou"], [data-e2e="nav-explore"], a[href="/live"]')
        ) {
          continue;
        }
        if (hasPlannedAncestor(el, 'drawer')) continue;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
          rect.left <= 340 &&
          rect.width >= 200 &&
          rect.width <= 480 &&
          rect.height >= 260 &&
          rect.height <= window.innerHeight &&
          el.querySelector('a, button, [role="button"], [role="menuitem"]')
        ) {
          nextSurface.set(el, 'drawer');
        }
      }

      const msgCtx = isMessagesContext();
      const pageContainers = root.querySelectorAll(
        '#app > div, #root > div, #root > div > div, main > div, [role="main"] > div, [id^="main-content-"] > div, [id^="main-content-"] > div > div',
      );
      for (const el of pageContainers) {
        if (
          el.id?.startsWith('octo-') ||
          el.matches('[role="dialog"], [role="menu"], [role="tooltip"], [class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], [' + SURFACE + '="live-chat"], [' + SURFACE + '="video-stage"], [data-e2e="live-room-content"], [class*="DivHeaderContainer"], [class*="DivMainContainer"], [class*="DivBodyContainer"], [class*="DivLayoutContainer"], video, iframe') ||
          el.closest('[role="dialog"], [role="menu"], [' + SURFACE + '="sidenav"]') ||
          hasPlannedAncestor(el, 'live-chat', true)
        ) {
          continue;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width >= window.innerWidth * 0.45 && rect.height >= window.innerHeight * 0.45) {
          const bg = getComputedStyle(el).backgroundColor;
          const isLight = MODE === 'dark' && msgCtx && isLightColor(bg);
          if (
            !isLight &&
            el.querySelector(':scope > video, :scope > [class*="DivBasicPlayerWrapper"], [class*="DivBrowserModeContainer"], [class*="BrowserMode"]')
          ) {
            continue;
          }
          const alreadyPage = el.getAttribute(SURFACE) === 'page';
          if (alreadyPage || (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent')) {
            nextSurface.set(el, 'page');
          }
        }
      }

      // Нормализуем текстовые поля (логин, 2FA, формы): только одна внешняя рамка без «скобок» по краям.
      for (const field of root.querySelectorAll(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="hidden"]):not([data-e2e="search-user-input"]):not([class*="Search"]), textarea',
      )) {
        if (
          field.id?.startsWith('octo-') ||
          field.closest('[data-e2e="search-box"], form[action*="/search"], [class*="DivSearchBar"], [data-e2e="comment-input"], [class*="DivCommentInput"], [data-e2e="message-input-area"], [class*="DivMessageInput"], [class*="DivChatInput"]')
        ) {
          continue;
        }
        const fr = field.getBoundingClientRect();
        if (fr.width < 60 || fr.height < 16) continue;
        let wrap = field.parentElement;
        let chosen = null;
        for (let depth = 0; depth < 3 && wrap && wrap !== document.body; depth += 1) {
          if (
            wrap.id?.startsWith('octo-') ||
            wrap.matches('[role="dialog"], [aria-modal="true"], form') ||
            wrap.querySelector('h1, h2, h3, h4, p')
          ) {
            break;
          }
          const wr = wrap.getBoundingClientRect();
          if (wr.width >= fr.width && wr.height >= fr.height && wr.height <= 72) {
            const inputsInside = wrap.querySelectorAll(
              'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea',
            ).length;
            if (inputsInside === 1) chosen = wrap;
          } else if (wr.height > 72) {
            break;
          }
          wrap = wrap.parentElement;
        }
        if (chosen) nextSurface.set(chosen, 'field');
      }

      // Полосы вкладок («Видео | Репосты | Избранное»): убираем чёрную подложку, ставим MD3-панель.
      for (const tablist of root.querySelectorAll('[role="tablist"], [class*="DivVideoFeedTab"]')) {
        if (
          tablist.id?.startsWith('octo-') ||
          hasPlannedAncestor(tablist, 'drawer') ||
          tablist.closest('[role="dialog"], [class*="DivSideNavContainer"]')
        ) {
          continue;
        }
        let bar = null;
        let cur = tablist;
        for (let depth = 0; depth < 3 && cur && cur !== document.body; depth += 1) {
          if (cur.matches('main, [role="main"], [id^="main-content-"]')) break;
          if (cur.querySelector('[data-e2e="user-post-item"], [data-e2e="explore-item"], video')) break;
          const r = cur.getBoundingClientRect();
          if (r.width >= 320 && r.height >= 28 && r.height <= 96) {
            const bg = getComputedStyle(cur).backgroundColor;
            if ((bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || cur === tablist) {
              bar = cur;
            }
          } else if (r.height > 96) {
            break;
          }
          cur = cur.parentElement;
        }
        if (bar && bar !== tablist) {
          nextSurface.set(bar, 'tab-bar');
        } else {
          const tb = tablist.getBoundingClientRect();
          const tbg = getComputedStyle(tablist).backgroundColor;
          if (
            tb.width >= 320 &&
            tb.height >= 28 &&
            tb.height <= 96 &&
            tbg &&
            tbg !== 'rgba(0, 0, 0, 0)' &&
            tbg !== 'transparent'
          ) {
            nextSurface.set(tablist, 'tab-bar');
          }
        }
      }

      // Шапка профиля: скругляем и выравниваем подложку карточки без резких прямоугольных краёв.
      for (const anchor of root.querySelectorAll('[data-e2e="user-avatar"], [data-e2e="user-title"]')) {
        let cur = anchor.parentElement;
        let head = null;
        for (let depth = 0; depth < 4 && cur && cur !== document.body; depth += 1) {
          if (cur.matches('main, [role="main"], [id^="main-content-"]')) break;
          if (cur.querySelector('[role="tablist"], [data-e2e="user-post-item"], video')) break;
          const r = cur.getBoundingClientRect();
          const bg = getComputedStyle(cur).backgroundColor;
          if (
            r.width >= 360 &&
            r.height >= 80 &&
            r.height <= 340 &&
            bg &&
            bg !== 'rgba(0, 0, 0, 0)' &&
            bg !== 'transparent'
          ) {
            head = cur;
          }
          cur = cur.parentElement;
        }
        if (head) nextSurface.set(head, 'profile-head');
      }

      // Горизонтальные ряды чипов фильтров («Смотреть», «Мини-сериалы», «Уведомления»).
      const rowParentCounts = new Map();
      for (const btn of root.querySelectorAll('button, a, [role="tab"], [role="button"]')) {
        if (
          btn.id?.startsWith('octo-') ||
          !btn.parentElement ||
          btn.closest('[class*="Player"], [class*="DivVideoWrapper"], [class*="DivBottomControls"]')
        ) {
          continue;
        }
        const inDrawer = hasPlannedAncestor(btn, 'drawer');
        if (!inDrawer && btn.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"]')) {
          continue;
        }
        if (!inDrawer && btn.closest('header, [role="banner"], [class*="DivHeaderContainer"]')) {
          continue;
        }
        rowParentCounts.set(btn.parentElement, (rowParentCounts.get(btn.parentElement) || 0) + 1);
      }
      for (const [parent, count] of rowParentCounts) {
        if (count < 3) continue;
        const inDrawer = hasPlannedAncestor(parent, 'drawer', true);
        if (
          parent.matches('[class*="Action"], [class*="Controls"], [class*="Sort" i], [role="radiogroup"]') ||
          (!inDrawer && parent.matches('[role="tablist"], [class*="DivVideoFeedTab"], [class*="DivTabList"], [class*="TUXTabBar"]'))
        ) {
          continue;
        }
        const btns = Array.from(parent.children).filter((el) => {
          if (!el.matches('button, a, [role="tab"], [role="button"]')) return false;
          const r = el.getBoundingClientRect();
          return r.width >= 24 && r.width <= 320 && r.height >= 20 && r.height <= 44;
        });
        if (btns.length < 3) continue;
        const rects = btns.map((el) => el.getBoundingClientRect());
        const sameRowCount = rects.filter((r) => Math.abs(r.top - rects[0].top) <= 6).length;
        const parentStyle = getComputedStyle(parent);
        const hasSharedRow = rects.some((a, i) =>
          rects.some((b, j) => i !== j && Math.abs(a.top - b.top) <= 6),
        );
        const isWrappingChipRow =
          inDrawer &&
          parentStyle.flexDirection !== 'column' &&
          (hasSharedRow || parentStyle.flexWrap === 'wrap');
        if (!inDrawer && sameRowCount < 3) continue;
        if (inDrawer && !isWrappingChipRow) continue;
        nextSurface.set(parent, 'chip-bar');
        for (const el of btns) {
          const st = getComputedStyle(el);
          const active =
            el.getAttribute('aria-selected') === 'true' ||
            el.getAttribute('aria-pressed') === 'true' ||
            el.getAttribute('data-active') === 'true' ||
            /(Active|Selected|is-active)/i.test(el.className || '') ||
            (MODE === 'dark' && isLightColor(st.backgroundColor)) ||
            (MODE === 'light' && isDarkColor(st.backgroundColor));
          nextSurface.set(el, active ? 'chip-active' : 'chip');
        }
      }

      // Соединённые пары/тройки кнопок внутри шторок («Ещё», «Уведомления»).
      for (const [drawer, val] of nextSurface) {
        if (val !== 'drawer') continue;
        for (const el of drawer.querySelectorAll('div, section, nav')) {
          if (
            nextSurface.get(el) === 'chip-bar' ||
            el.matches('[role="tablist"]') ||
            el.querySelector('a, h1, h2, h3, h4, p')
          ) {
            continue;
          }
          const directButtons = Array.from(el.children).filter((c) => c.tagName === 'BUTTON');
          if (directButtons.length < 2 || directButtons.length > 3) continue;
          if (directButtons.some((b) => nextSurface.get(b) === 'chip' || nextSurface.get(b) === 'chip-active')) {
            continue;
          }
          nextSurface.set(el, 'drawer-segmented');
        }
      }

      // Страница /setting: левая панель разделов и правая карточка настроек.
      if (/^\\/setting/i.test(location.pathname || '')) {
        const settingCandidates = Array.from(root.querySelectorAll('div, aside, nav, section')).filter((el) => {
          if (
            el.id?.startsWith('octo-') ||
            hasPlannedAncestor(el, 'drawer', true) ||
            el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], header, [role="banner"]')
          ) {
            return false;
          }
          const r = el.getBoundingClientRect();
          if (r.height < 260) return false;
          const c = parseRgb(getComputedStyle(el).backgroundColor);
          return Boolean(c && c.a >= 0.7 && (MODE === 'dark' ? c.r <= 65 && c.g <= 65 && c.b <= 65 : c.r >= 225));
        });
        let navCol = null;
        let paneCol = null;
        for (const el of settingCandidates) {
          const r = el.getBoundingClientRect();
          const items = el.querySelectorAll(':scope > a, :scope > button, :scope > [role="tab"], :scope > [role="button"], :scope > div, :scope > ul > li');
          if (!navCol && r.width >= 180 && r.width <= 380 && items.length >= 4 && !el.querySelector('[role="switch"]')) {
            navCol = el;
          } else if (!paneCol && r.width >= 380 && el.querySelectorAll('h1, h2, h3, [role="switch"], button').length >= 2) {
            paneCol = el;
          }
        }
        if (navCol) {
          nextSurface.set(navCol, 'setting-nav');
          const rows = Array.from(navCol.querySelectorAll(':scope > a, :scope > button, :scope > [role="tab"], :scope > [role="button"], :scope > ul > li, :scope > div')).filter((row) => {
            const rr = row.getBoundingClientRect();
            return rr.height >= 28 && rr.height <= 72;
          });
          for (const row of rows) {
            const rs = getComputedStyle(row);
            const active =
              row.getAttribute('aria-selected') === 'true' ||
              row.getAttribute('aria-current') === 'page' ||
              row.getAttribute('data-active') === 'true' ||
              /(Active|Selected)/i.test(row.className || '') ||
              isTikTokRed(rs.color) ||
              Array.from(row.querySelectorAll('span, div, p')).some((n) => isTikTokRed(getComputedStyle(n).color));
            nextSurface.set(row, active ? 'setting-nav-active' : 'setting-nav-item');
          }
        }
        if (paneCol) nextSurface.set(paneCol, 'setting-pane');
      }

      // Страница трансляций (/live, /@user/live, .live-room-container): сцена, донатная плашка и правый чат.
      const liveRoom = root.querySelector('.live-room-container');
      const liveContent = root.querySelector('[data-e2e="live-room-content"]');
      if (liveRoom || liveContent || isLiveRoute()) {
        const roomScope = liveRoom || liveContent?.parentElement || root;
        const stageAnchor = liveContent || roomScope.querySelector('[class*="DivLiveContainer"], [class*="Player"]');
        if (stageAnchor && stageAnchor !== document.body && !stageAnchor.matches('[data-e2e="live-room-content"]')) {
          nextSurface.set(stageAnchor, 'live-stage');
        }

        const stageHost = liveContent || stageAnchor;
        if (stageHost) {
          const sr = stageHost.getBoundingClientRect();
          for (const box of stageHost.querySelectorAll('div, section, footer')) {
            if (box.id?.startsWith('octo-') || box.querySelector('video')) continue;
            const br = box.getBoundingClientRect();
            if (
              br.width >= sr.width * 0.55 &&
              br.height >= 36 &&
              br.height <= 140 &&
              br.bottom >= sr.bottom - 24 &&
              box.querySelector('button, [role="button"]')
            ) {
              const rawBg = getComputedStyle(box).backgroundColor;
              const bg = parseRgb(rawBg);
              if (bg && bg.a >= 0.45 && (bg.r <= 95 || isLightColor(rawBg))) {
                nextSurface.set(box, 'live-footer');
              }
            }
          }
        }

        const chatCandidates = Array.from(
          (liveRoom || document).querySelectorAll('aside, section, div'),
        ).filter((el) => {
          if (
            el.id?.startsWith('octo-') ||
            el.matches('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], [role="dialog"], [role="menu"], [data-e2e="live-room-content"]') ||
            hasPlannedAncestor(el, 'drawer') ||
            el.closest('[' + SURFACE + '="sidenav"], [role="dialog"], [role="menu"], [data-e2e="live-room-content"]') ||
            el.querySelector('[data-e2e="live-room-content"], video')
          ) {
            return false;
          }
          const r = el.getBoundingClientRect();
          if (r.left < window.innerWidth * 0.45 || r.width < 250 || r.width > 540 || r.height < window.innerHeight * 0.45) {
            return false;
          }
          if (liveRoom && el.parentElement === liveRoom) return true;
          if (liveContent) {
            const lr = liveContent.getBoundingClientRect();
            if (r.left >= lr.right - 24) return true;
          }
          return Boolean(
            el.querySelector(
              '[data-e2e*="chat" i], [class*="Chat" i], [contenteditable="true"], [contenteditable="plaintext-only"], textarea, input[placeholder]',
            ),
          );
        });

        let liveChat = null;
        for (const el of chatCandidates) {
          if (!liveChat || el.contains(liveChat)) {
            if (el.getBoundingClientRect().width <= 540) liveChat = el;
          }
        }
        if (liveChat) {
          nextSurface.set(liveChat, 'live-chat');
          const chatInputs = [];
          for (const field of liveChat.querySelectorAll(
            '[contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
          )) {
            if (field.id?.startsWith('octo-')) continue;
            const fr = field.getBoundingClientRect();
            if (fr.width < 80 || fr.height < 14) continue;
            const wrap =
              field.closest('[class*="Input" i], [class*="Editor" i], [class*="Composer" i], [class*="bg-BGInput" i], form') ||
              field.parentElement;
            if (wrap && wrap !== liveChat && !wrap.id?.startsWith('octo-') && wrap.getBoundingClientRect().height <= 120) {
              nextSurface.set(wrap, 'live-chat-input');
              chatInputs.push(wrap);
            }
          }
          const cr = liveChat.getBoundingClientRect();
          for (const pane of liveChat.querySelectorAll('div, section, header, footer')) {
            if (
              pane.id?.startsWith('octo-') ||
              pane.matches('button, [role="button"], input, textarea, [contenteditable]') ||
              nextSurface.get(pane) === 'live-chat-input' ||
              chatInputs.some((inp) => inp.contains(pane))
            ) {
              continue;
            }
            const pr = pane.getBoundingClientRect();
            if (pr.width < cr.width * 0.72 || pr.height < 36) continue;
            const bg = getComputedStyle(pane).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              nextSurface.set(pane, 'live-chat-pane');
            }
          }
        }
      }

      // Комментарии справа: поднимаемся от маркеров комментариев вместо полного обхода всех div.
      const commentCandidates = new Set(root.querySelectorAll('aside, section'));
      for (const anchor of root.querySelectorAll('[data-e2e*="comment"], [class*="Comment"]')) {
        let cur = anchor;
        for (let depth = 0; depth < 6 && cur && cur !== root && cur !== document.body; depth += 1) {
          if (cur.id === 'app' || cur.id === 'root' || cur.matches('main, [role="main"], [id^="main-content-"]')) {
            break;
          }
          commentCandidates.add(cur);
          cur = cur.parentElement;
        }
      }
      for (const el of commentCandidates) {
        if (
          el.id?.startsWith('octo-') ||
          el.matches('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], [role="dialog"], [role="menu"]') ||
          nextSurface.get(el) === 'live-chat' ||
          hasPlannedAncestor(el, 'comments') ||
          hasPlannedAncestor(el, 'live-chat')
        ) {
          continue;
        }
        const rect = el.getBoundingClientRect();
        if (
          rect.left >= window.innerWidth * 0.45 &&
          rect.width >= 260 &&
          rect.width <= 560 &&
          rect.height >= window.innerHeight * 0.55 &&
          el.querySelector('[data-e2e*="comment"], [class*="Comment"]')
        ) {
          nextSurface.set(el, 'comments');
          const editable = el.querySelector('[contenteditable="true"], textarea');
          const inputWrap = editable?.closest('[data-e2e="comment-input"], [class*="DivCommentInput"], [class*="InputContainer"], [class*="InputWrapper"], form');
          if (inputWrap && inputWrap !== el && inputWrap.getBoundingClientRect().height <= 120) {
            nextSurface.set(inputWrap, 'comment-input');
          }
        }
      }

      if (MODE === 'dark') {
        const topBars = root.querySelectorAll(
          msgCtx
            ? 'header, nav, [role="banner"], [class*="Header" i], [class*="TopBar" i], [class*="NavBar" i], div, section'
            : 'body > div, #app > div, #app > div > div, #root > div, #root > div > div, #root header, header, nav, [class*="Header" i], [class*="TopBar" i], [class*="NavBar" i]',
        );
        const topLimit = msgCtx ? 140 : 20;
        for (const el of topBars) {
          if (el.id?.startsWith('octo-')) continue;
          if (!msgCtx && hasPlannedAncestor(el, 'header')) continue;
          const rect = el.getBoundingClientRect();
          if (
            rect.top >= -4 &&
            rect.top <= topLimit &&
            rect.height >= 32 &&
            rect.height <= 120 &&
            rect.width >= window.innerWidth * 0.45
          ) {
            const c = parseRgb(getComputedStyle(el).backgroundColor);
            if (c && c.a >= 0.7 && c.r >= 200 && c.g >= 200 && c.b >= 200) {
              nextSurface.set(el, 'header');
            }
          }
        }
      }

      if (MODE === 'dark' && msgCtx) {
        const chatRows = root.querySelectorAll(
          '[data-e2e="chat-list-item"], [class*="ConversationItem" i], [class*="ChatItem" i], [class*="SessionItem" i], [class*="ContactItem" i], [class*="SessionList" i] > div, [class*="SessionList" i] li, [class*="ConversationList" i] > div, [class*="ChatList" i] > div, [class*="InboxList" i] > div',
        );
        for (const row of chatRows) {
          if (row.id?.startsWith('octo-')) continue;
          const r = row.getBoundingClientRect();
          if (r.width < 120 || r.height < 36 || r.height > 150) continue;
          if (isLightColor(getComputedStyle(row).backgroundColor)) {
            nextSurface.set(row, 'chat-active');
          }
        }

        const msgPanels = root.querySelectorAll(
          'div, section, aside, nav, ul',
        );
        for (const panel of msgPanels) {
          if (
            panel.id?.startsWith('octo-') ||
            nextSurface.has(panel) ||
            panel.matches('button, [role="button"], input, textarea, [contenteditable], img, video, svg, [class*="Bubble" i], [class*="MessageContent" i], [class*="Avatar" i], [class*="Badge" i]') ||
            panel.closest('[role="dialog"], [role="menu"], [role="tooltip"]') ||
            hasPlannedAncestor(panel, 'chat-active') ||
            hasPlannedAncestor(panel, 'header')
          ) {
            continue;
          }
          const r = panel.getBoundingClientRect();
          if (r.width < 120 || r.height < 36) {
            continue;
          }
          if (isLightColor(getComputedStyle(panel).backgroundColor)) {
            nextSurface.set(
              panel,
              r.height >= window.innerHeight * 0.45 && r.width >= window.innerWidth * 0.45
                ? 'page'
                : 'card',
            );
          }
        }

        for (const field of root.querySelectorAll(
          '[contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], textarea',
        )) {
          if (field.id?.startsWith('octo-') || field.closest('[data-e2e="search-box"], form[action*="/search"]')) {
            continue;
          }
          const fr = field.getBoundingClientRect();
          if (fr.width < 80 || fr.height < 16) continue;
          const wrap = field.closest(
            '[data-e2e="message-input-area"], [class*="Input" i], [class*="Editor" i], [class*="Composer" i], form',
          ) || field.parentElement;
          if (wrap && !wrap.id?.startsWith('octo-') && wrap.getBoundingClientRect().height <= 180) {
            if (!nextSurface.has(wrap)) nextSurface.set(wrap, 'chat-input');
          }
        }

        for (const node of root.querySelectorAll(
          'span, p, div, a, strong, label, h1, h2, h3, h4, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]',
        )) {
          if (
            node.id?.startsWith('octo-') ||
            hasPlannedAncestor(node, 'chat-active', true) ||
            node.closest('[' + ACCENT + '="primary"], [' + ACCENT + '="tonal"], [' + ACCENT + '="badge"], [role="tooltip"], [class*="DivSideNavContainer"]')
          ) {
            continue;
          }
          const isField = node.matches('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]');
          if (!isField) {
            let hasDirectText = false;
            for (const child of node.childNodes) {
              if (child.nodeType === 3 && child.textContent.trim()) {
                hasDirectText = true;
                break;
              }
            }
            if (!hasDirectText) continue;
          }
          const style = getComputedStyle(node);
          if (isDarkColor(style.color) && effectiveBgLum(node, lumCache) < 105) {
            nextFg.add(node);
          }
        }
      }

      root.querySelectorAll('[' + SURFACE + ']').forEach((el) => {
        const cur = el.getAttribute(SURFACE);
        if (MANAGED_SURFACES.has(cur) && !nextSurface.has(el)) {
          delAttrIfSet(el, SURFACE);
        }
      });
      for (const [el, val] of nextSurface) setAttrIfDiff(el, SURFACE, val);

      root.querySelectorAll('[' + FG + ']').forEach((el) => {
        if (!nextFg.has(el)) delAttrIfSet(el, FG);
      });
      for (const el of nextFg) setAttrIfDiff(el, FG, 'on-surface');
    };

    const classify = (el, accentWrites) => {
      if (!(el instanceof Element) || el.id?.startsWith('octo-')) return;
      const existing = el.getAttribute(ACCENT);

      if (existing === 'badge' || existing === 'progress') return;
      if (existing === 'primary') {
        if (
          el.getAttribute('aria-pressed') === 'true' ||
          /(Following|Followed|Secondary|Outline)/i.test(el.className || '') ||
          el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"]')
        ) {
          accentWrites.del.add(el);
        }
        return;
      }
      if (existing === 'tonal') {
        if (MODE !== 'dark') accentWrites.del.add(el);
        return;
      }
      if (el.parentElement?.closest('[' + ACCENT + '="switch"], [' + ACCENT + '="switch-off"]')) {
        return;
      }

      const isSwitchMatch = el.matches('[role="switch"], [class*="Switch"], [class*="Toggle"]');
      const inAutoScroll = !isSwitchMatch && Boolean(el.closest('[class*="AutoScroll"]'));
      const inPlayerCtrl =
        !isSwitchMatch &&
        Boolean(el.closest('[class*="Control"], [class*="Bottom"], [class*="Player"], [' + SURFACE + '="player-controls"]'));

      if (isSwitchMatch || ((inAutoScroll || inPlayerCtrl) && el.children.length <= 2)) {
        const elRect = el.getBoundingClientRect();
        const isPillSize =
          elRect.width >= 24 && elRect.width <= 64 && elRect.height >= 12 && elRect.height <= 32;
        const isSwitchControl = isSwitchMatch || (inAutoScroll && isPillSize);
        const isPillInPlayer = !isSwitchControl && inPlayerCtrl && isPillSize;

        if (isSwitchControl || isPillInPlayer) {
          const checkedHost = el.closest('[aria-checked], [data-checked]');
          const checkbox = el.matches('input[type="checkbox"]')
            ? el
            : el.querySelector('input[type="checkbox"]') ||
              el.closest('[class*="AutoScroll"], [class*="Switch"], [class*="Toggle"]')?.querySelector('input[type="checkbox"]');
          let checkedAttr =
            el.getAttribute('aria-checked') ??
            el.getAttribute('data-checked') ??
            checkedHost?.getAttribute('aria-checked') ??
            checkedHost?.getAttribute('data-checked') ??
            null;
          if (checkedAttr === null && checkbox) {
            checkedAttr = checkbox.checked ? 'true' : 'false';
          }
          if (existing === 'switch' || existing === 'switch-off') {
            const prev = el.dataset.octoMd3Checked ?? null;
            if (checkedAttr !== null && checkedAttr !== prev) {
              el.dataset.octoMd3Checked = checkedAttr;
              accentWrites.set.set(el, checkedAttr === 'true' ? 'switch' : 'switch-off');
            }
            return;
          }
          const bg = getComputedStyle(el).backgroundColor;
          const parsed = parseRgb(bg);
          const red = isTikTokRed(bg);
          const cyan = isTikTokCyan(bg);
          const firstChildW = el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width : 0;
          const looksLikeTrack = Boolean(
            parsed && (el.children.length === 0 || (firstChildW > 0 && firstChildW < elRect.width * 0.65)),
          );
          if (
            !red &&
            !cyan &&
            checkedAttr === null &&
            !el.matches('[role="switch"]') &&
            !(inAutoScroll && looksLikeTrack)
          ) {
            return;
          }
          let thumbRight = false;
          if (checkedAttr === null && !red && !cyan && el.children.length === 1) {
            const thumbRect = el.firstElementChild.getBoundingClientRect();
            if (thumbRect.width > 0 && thumbRect.width < elRect.width * 0.65) {
              thumbRight = thumbRect.left + thumbRect.width / 2 > elRect.left + elRect.width / 2 + 2;
            }
          }
          const on =
            checkedAttr === 'true' ||
            thumbRight ||
            Boolean(parsed && ((cyan && parsed.g >= 175 && parsed.a >= 0.7) || (red && parsed.a >= 0.5)));
          if (checkedAttr !== null) el.dataset.octoMd3Checked = checkedAttr;
          accentWrites.set.set(el, on ? 'switch' : 'switch-off');
          return;
        }
      }

      if (existing) return;
      const bg = getComputedStyle(el).backgroundColor;
      const red = isTikTokRed(bg);
      const cyan = isTikTokCyan(bg);
      if (!red && !cyan) {
        if (
          MODE === 'dark' &&
          el.matches('button, [role="button"]') &&
          !el.matches(':disabled, [aria-disabled="true"]') &&
          !el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], [' + SURFACE + '="drawer"], [class*="Player"], [class*="DivVideoWrapper"]') &&
          !el.matches('[class*="PlayOverlay"], [class*="VideoMask"], [class*="ClickArea"], [class*="ButtonActionItem"], [data-e2e="search-button"], [data-e2e="comment-post"], [data-e2e="feed-navigation-next"], [data-e2e="feed-navigation-prev"], [data-e2e="arrow-down"], [data-e2e="arrow-up"]') &&
          isLightColor(bg)
        ) {
          accentWrites.set.set(el, 'tonal');
        }
        return;
      }

      if (el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"]') && el.matches('a, button, [role="button"]')) {
        return;
      }
      if (el.matches('button, [role="button"], a') && !el.matches(':disabled, [aria-disabled="true"]')) {
        accentWrites.set.set(el, 'primary');
        return;
      }
      const rect = el.getBoundingClientRect();
      if (
        el.closest('[' + SURFACE + '="live-chat"]') &&
        red &&
        rect.width >= 20 &&
        rect.width <= 80 &&
        rect.height >= 20 &&
        rect.height <= 80 &&
        !el.matches(':disabled, [aria-disabled="true"]')
      ) {
        accentWrites.set.set(el, 'primary');
        return;
      }
      if (rect.height >= 2 && rect.height <= 10 && rect.width >= 2) {
        accentWrites.set.set(el, 'progress');
        return;
      }
      if (rect.width > 0 && rect.width <= 36 && rect.height > 0 && rect.height <= 28) {
        accentWrites.set.set(el, 'badge');
      }
    };

    const isDimOrMutedColor = (value) => {
      const c = parseRgb(value);
      if (!c) return false;
      if (c.a < 0.85) return true;
      return MODE === 'dark' ? luminanceOf(c) < 155 : luminanceOf(c) > 120;
    };

    const markIconOnSurfaceIfDim = (svg, iconWrites) => {
      if (!(svg instanceof Element) || svg.id?.startsWith('octo-')) return;
      if (svg.getAttribute(ICON) === 'on-surface') return;
      const st = getComputedStyle(svg);
      let dim = isDimOrMutedColor(st.color) || isDimOrMutedColor(st.fill);
      if (!dim) {
        for (const p of svg.querySelectorAll('path, circle, rect, line, polyline, polygon')) {
          const ps = getComputedStyle(p);
          if (isDimOrMutedColor(ps.fill) || isDimOrMutedColor(ps.stroke)) {
            dim = true;
            break;
          }
        }
      }
      if (dim) iconWrites.add(svg);
    };

    const syncPlayerControls = (root) => {
      const nextPlayerSurfaces = new Map();
      const nextNavBtns = new Map();
      const nextProgress = new Set();
      const nextDimIcons = new Set();
      const markPlayerSurface = (el, value) => {
        nextPlayerSurfaces.set(el, value);
      };

      // 1. Связанная вертикальная группа стрелок навигации вверх/вниз в ленте
      const navPrevList = root.querySelectorAll('[data-e2e="feed-navigation-prev"], [data-e2e="arrow-up"]');
      for (const prev of navPrevList) {
        if (prev.id?.startsWith('octo-')) continue;
        let container = prev.parentElement;
        for (let depth = 0; depth < 3 && container && container !== document.body; depth += 1) {
          const next = container.querySelector('[data-e2e="feed-navigation-next"], [data-e2e="arrow-down"]');
          if (next && next !== prev) {
            const cr = container.getBoundingClientRect();
            const r0 = prev.getBoundingClientRect();
            const r1 = next.getBoundingClientRect();
            if (
              cr.width > 0 &&
              cr.width <= 120 &&
              r0.width > 0 &&
              r1.width > 0 &&
              Math.abs(r0.left - r1.left) <= 16 &&
              r1.top - r0.bottom >= -2 &&
              r1.top - r0.bottom <= 28
            ) {
              markPlayerSurface(container, 'feed-nav-group');
              nextNavBtns.set(prev, 'v-first');
              nextNavBtns.set(next, 'v-last');
            }
            break;
          }
          container = container.parentElement;
        }
      }

      // 2. Панели управления плеером и прогресс-бар внутри видеокарточек
      const playerScopes = new Set();
      for (const el of root.querySelectorAll(
        '[class*="DivBasicPlayerWrapper"], [class*="DivVideoWrapper"], [data-e2e="feed-video"]',
      )) {
        if (el.id?.startsWith('octo-')) continue;
        const r = el.getBoundingClientRect();
        if (r.width >= 180 && r.height >= 160) playerScopes.add(el);
      }
      for (const video of root.querySelectorAll('video')) {
        if (video.id?.startsWith('octo-') || video.closest('[role="dialog"], [aria-modal="true"]')) continue;
        const vr = video.getBoundingClientRect();
        if (vr.width < 120 || vr.height < 120) continue;
        const stageHost =
          video.closest(
            '[class*="DivBasicPlayerWrapper"], [class*="DivVideoWrapper"], [data-e2e="feed-video"], [data-e2e="live-room-content"], [class*="DivLivePlayer"], [class*="LivePlayer"], [class*="xgplayer"]',
          ) || video.parentElement;
        if (
          stageHost &&
          stageHost !== document.body &&
          stageHost !== document.documentElement &&
          !stageHost.id?.startsWith('octo-') &&
          !stageHost.matches(
            '[class*="DivBasicPlayerWrapper"], [data-e2e="live-room-content"], main, [role="main"], [id^="main-content-"], [class*="DivFeedContainer"], [class*="DivRecommendList"], [class*="DivItemContainerV2"]',
          )
        ) {
          markPlayerSurface(stageHost, 'video-stage');
        }
        if (vr.width < 180 || vr.height < 160) continue;
        const host =
          video.closest('[class*="DivItemContainerV2"], [class*="DivRecommendList"], [class*="DivBasicPlayerWrapper"], [class*="DivVideoWrapper"]') ||
          video.parentElement;
        if (host) playerScopes.add(host);
      }

      for (const scope of playerScopes) {
        const sr = scope.getBoundingClientRect();
        const localBars = new Set();
        for (const bar of scope.querySelectorAll(
          '[class*="DivVideoControlBottom"], [class*="DivPlayerControls"], [class*="DivBottomControls"], [class*="DivMediaControl"], [class*="DivControlBottom"]',
        )) {
          if (bar.id?.startsWith('octo-') || bar.querySelector('video')) continue;
          const br = bar.getBoundingClientRect();
          if (br.width >= 120 && br.height >= 16 && br.height <= 110) {
            markPlayerSurface(bar, 'player-controls');
            localBars.add(bar);
          }
        }

        // Структурный поиск нижней панели по таймкоду / автопрокрутке / скорости / звуку
        if (localBars.size === 0) {
          for (const leaf of scope.querySelectorAll(
            'time, span, [class*="AutoScroll"], [class*="PlaybackRate"], [data-e2e*="video-play"]',
          )) {
            if (leaf.id?.startsWith('octo-')) continue;
            let inMarkedBar = false;
            for (const b of localBars) {
              if (b.contains(leaf)) {
                inMarkedBar = true;
                break;
              }
            }
            if (inMarkedBar) continue;
            const isTime =
              leaf.children.length === 0 &&
              /^\\s*\\d{1,2}:\\d{2}\\s*\\/\\s*\\d{1,2}:\\d{2}\\s*$/.test(leaf.textContent || '');
            const isKnownCtrl = leaf.matches('[class*="AutoScroll"], [class*="PlaybackRate"], [data-e2e*="video-play"]');
            if (!isTime && !isKnownCtrl) continue;
            let cur = leaf.parentElement;
            let picked = null;
            while (cur && cur !== scope && cur !== document.body) {
              if (
                cur.querySelector(
                  'video, [data-e2e*="author"], [data-e2e*="desc"], [data-e2e*="follow"], [class*="SeekBar"], [class*="ProgressBar"], [role="slider"]',
                )
              ) {
                break;
              }
              const cr = cur.getBoundingClientRect();
              if (cr.height > 92) break;
              if (cr.width >= sr.width * 0.45 && cr.height >= 22 && cr.bottom >= sr.bottom - 110) {
                picked = cur;
              }
              cur = cur.parentElement;
            }
            if (picked) {
              markPlayerSurface(picked, 'player-controls');
              localBars.add(picked);
            }
          }
        }

        for (const bar of localBars) {
          let wrap = bar.parentElement;
          for (let d = 0; d < 2 && wrap && wrap !== scope && wrap !== document.body; d += 1) {
            if (wrap.querySelector('video, [data-e2e*="author"], [data-e2e*="desc"]')) break;
            if (
              wrap.getAttribute(SURFACE) === 'player-controls-wrap' ||
              parseFloat(getComputedStyle(wrap).opacity) < 0.85
            ) {
              markPlayerSurface(wrap, 'player-controls-wrap');
            }
            wrap = wrap.parentElement;
          }
          for (const svg of bar.querySelectorAll('svg')) {
            if (!svg.closest('[' + ACCENT + '="switch"], [' + ACCENT + '="switch-off"]')) {
              markIconOnSurfaceIfDim(svg, nextDimIcons);
            }
          }
        }

        // Прогресс-бар (seekbar) и ползунок внутри плеера
        for (const sb of scope.querySelectorAll('[class*="SeekBar"], [class*="ProgressBar"], [role="slider"]')) {
          if (sb.id?.startsWith('octo-') || sb.querySelector('video')) continue;
          const r = sb.getBoundingClientRect();
          if (r.width < 80 || r.height < 2 || r.height > 36) continue;
          markPlayerSurface(sb, 'player-seekbar');
          if (sb.parentElement && !sb.parentElement.querySelector('video, [data-e2e*="author"], [data-e2e*="desc"]')) {
            if (
              sb.parentElement.getAttribute(SURFACE) === 'player-controls-wrap' ||
              parseFloat(getComputedStyle(sb.parentElement).opacity) < 0.85
            ) {
              markPlayerSurface(sb.parentElement, 'player-controls-wrap');
            }
          }
          for (const child of sb.querySelectorAll('div, span')) {
            const cr = child.getBoundingClientRect();
            const isThumb =
              child.matches('[class*="Circle"], [class*="Dot"], [class*="Thumb"]') ||
              (cr.width >= 6 && cr.width <= 20 && cr.height >= 6 && cr.height <= 20 && Math.abs(cr.width - cr.height) <= 3);
            if (isThumb) {
              markPlayerSurface(child, 'player-seekbar-thumb');
              continue;
            }
            const inlineStyle = child.getAttribute('style') || '';
            const isFill =
              child.matches('[class*="Progress"], [class*="Played"], [class*="Fill"]') ||
              (cr.height >= 1 && cr.height <= 10 && /(?:width\\s*:\\s*[\\d.]+%|scaleX\\()/i.test(inlineStyle));
            if (isFill) {
              nextProgress.add(child);
            }
          }
        }
      }

      // 3. Кнопка «•••» (дополнительные действия у видео)
      for (const btn of root.querySelectorAll(
        '[data-e2e="feed-more-button"], [data-e2e*="more-button"], [class*="DivMoreButton"] button, [class*="MoreButton"], [class*="ActionBar"] button, [class*="DivActionItemContainer"] button',
      )) {
        if (
          btn.id?.startsWith('octo-') ||
          btn.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="drawer"], [role="dialog"], header') ||
          (() => {
            for (const [el, val] of nextPlayerSurfaces) {
              if (val === 'player-controls' && el.contains(btn)) return true;
            }
            return false;
          })()
        ) {
          continue;
        }
        if (
          btn.matches(
            '[class*="ButtonActionItem"], [class*="PlayOverlay"], [class*="VideoMask"], [class*="ClickArea"], [data-e2e*="like"], [data-e2e*="comment"], [data-e2e*="favorite"], [data-e2e*="share"], [data-e2e*="follow"], [data-e2e*="arrow"], [data-e2e*="feed-navigation"]',
          ) ||
          btn.querySelector('[data-e2e*="like"], [data-e2e*="comment"], [data-e2e*="favorite"], [data-e2e*="share"], [data-e2e*="follow"]')
        ) {
          continue;
        }
        const br = btn.getBoundingClientRect();
        if (br.width < 28 || br.width > 56 || br.height < 28 || br.height > 56) continue;
        const explicitMore = btn.matches(
          '[data-e2e="feed-more-button"], [data-e2e*="more-button"], [class*="DivMoreButton"] button, [class*="MoreButton"]',
        );
        const label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim();
        const isMoreLabel = /^(?:more|ещ[её]|опци|options?)$/i.test(label);
        const svg = btn.querySelector('svg');
        const dotsCount = svg ? svg.querySelectorAll('circle, path').length : 0;
        if (!explicitMore && !isMoreLabel && (!svg || dotsCount === 0 || dotsCount > 4 || (btn.textContent || '').trim())) {
          continue;
        }
        if (btn.hasAttribute(BTN_GROUP)) delAttrIfSet(btn, BTN_GROUP);
        markPlayerSurface(btn, 'player-more');
        if (svg) markIconOnSurfaceIfDim(svg, nextDimIcons);
      }

      root
        .querySelectorAll(
          '[' +
            SURFACE +
            '="player-controls"], [' +
            SURFACE +
            '="player-controls-wrap"], [' +
            SURFACE +
            '="player-seekbar"], [' +
            SURFACE +
            '="player-seekbar-thumb"], [' +
            SURFACE +
            '="player-more"], [' +
            SURFACE +
            '="feed-nav-group"], [' +
            SURFACE +
            '="video-stage"]',
        )
        .forEach((el) => {
          if (!nextPlayerSurfaces.has(el)) delAttrIfSet(el, SURFACE);
        });
      for (const [el, val] of nextPlayerSurfaces) {
        setAttrIfDiff(el, SURFACE, val);
      }
      for (const el of nextProgress) {
        setAttrIfDiff(el, ACCENT, 'progress');
      }
      for (const svg of nextDimIcons) {
        setAttrIfDiff(svg, ICON, 'on-surface');
      }
      root
        .querySelectorAll('[' + BTN_GROUP + '="v-first"], [' + BTN_GROUP + '="v-last"]')
        .forEach((el) => {
          if (el.closest('[' + SURFACE + '="feed-nav-group"]') && !nextNavBtns.has(el)) {
            delAttrIfSet(el, BTN_GROUP);
          }
        });
      for (const [el, val] of nextNavBtns) {
        setAttrIfDiff(el, BTN_GROUP, val);
      }
    };

    const syncActionIcons = (root) => {
      const icons = root.querySelectorAll(
        '[data-e2e*="like-icon"], [data-e2e*="like-icon"] svg, [data-e2e*="like-icon"] path, [data-e2e*="favorite-icon"], [data-e2e*="favorite-icon"] svg, [data-e2e*="favorite-icon"] path, [class*="DivComment"] [data-e2e*="like"] svg, [class*="DivComment"] [data-e2e*="like"] svg path, [class*="DivComment"] [class*="Like" i] svg, [class*="DivComment"] [class*="Like" i] svg path',
      );
      const toCheck = [];
      const toReset = [];
      const nextActive = new Set();
      for (const node of icons) {
        if (node.id?.startsWith('octo-') || node.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"]')) continue;
        if (isTikTokRedAttr(node)) {
          nextActive.add(node);
          continue;
        }
        const btn = node.closest('button, [role="button"]');
        const key =
          (node.getAttribute('class') || '') +
          '|' +
          (node.getAttribute('fill') || '') +
          '|' +
          (btn?.getAttribute('aria-pressed') || '') +
          '|' +
          (btn?.getAttribute('class') || '');
        if (node.dataset.octoMd3IconKey === key) continue;
        node.dataset.octoMd3IconKey = key;
        if (node.hasAttribute(ICON)) toReset.push(node);
        toCheck.push(node);
      }
      for (const node of toReset) node.removeAttribute(ICON);
      for (const node of toCheck) {
        const style = getComputedStyle(node);
        if (isTikTokRed(style.color) || isTikTokRed(style.fill)) {
          nextActive.add(node);
        }
      }
      for (const node of nextActive) setAttrIfDiff(node, ICON, 'active');

      if (MODE === 'dark' && isMessagesContext()) {
        const lumCache = new WeakMap();
        const uiSvgs = root.querySelectorAll(
          '[' +
            SURFACE +
            '="header"] svg, [' +
            SURFACE +
            '="card"] svg, [' +
            SURFACE +
            '="chat-input"] svg, [role="menu"] svg, [role="listbox"] svg, [class*="TUXPopover-content"] svg, [class*="DivPopupContainer"] svg, [class*="DivDropdown"] svg, [class*="DivMenuContainer"] svg, [class*="Header" i] svg, [class*="Toolbar" i] svg, [class*="MessageEditor" i] svg, [class*="ChatEditor" i] svg',
        );
        const nextOnSurface = new Set();
        const delOnSurface = [];
        for (const svg of uiSvgs) {
          if (
            svg.id?.startsWith('octo-') ||
            svg.closest('[class*="Avatar" i], [class*="Emoji" i], [class*="Sticker" i], [class*="Video" i], [class*="DivSideNavContainer"]')
          ) {
            continue;
          }
          const r = svg.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0 || r.width > 180 || r.height > 56) continue;
          const style = getComputedStyle(svg);
          let hasDark = isDarkColor(style.color) || isDarkColor(style.fill);
          if (!hasDark) {
            for (const p of svg.querySelectorAll('path, circle, rect, line, polyline, polygon')) {
              const ps = getComputedStyle(p);
              if (isDarkColor(ps.fill) || isDarkColor(ps.stroke)) {
                hasDark = true;
                break;
              }
            }
          }
          if (hasDark && effectiveBgLum(svg, lumCache) < 105) {
            nextOnSurface.add(svg);
          } else if (svg.getAttribute(ICON) === 'on-surface') {
            delOnSurface.push(svg);
          }
        }
        for (const svg of delOnSurface) delAttrIfSet(svg, ICON);
        for (const svg of nextOnSurface) setAttrIfDiff(svg, ICON, 'on-surface');
      }
    };

    const scan = (root = document) => {
      if (!root || !root.querySelectorAll) return;
      syncMessagesLayout();
      syncSurfaces(root);
      syncSidebarNav();
      syncActionIcons(root);
      syncButtonGroups(root);
      syncPlayerControls(root);
      const candidates = root.querySelectorAll(
        'button, [role="button"], [role="switch"], [class*="Switch"], [class*="Toggle"], [class*="AutoScroll"] div, [class*="DivPlayerControls"] > div, [class*="DivBottomControls"] > div, [' +
          SURFACE +
          '="player-controls"] div, [class*="Progress"], [class*="SeekBar"] div, [class*="Badge" i], [class*="Unread" i], sup, [' +
          SURFACE +
          '="comments"] a, [class*="DivComment"] a, [' +
          SURFACE +
          '="live-chat"] [data-e2e], [' +
          SURFACE +
          '="live-chat"] [class*="Like" i], [' +
          SURFACE +
          '="live-chat"] [class*="Heart" i]',
      );
      const accentWrites = { set: new Map(), del: new Set() };
      for (const el of candidates) classify(el, accentWrites);

      // Красные текстовые ссылки в модалках (например «Отправить код заново») перекрашиваем в primary
      const dialogs = root.querySelectorAll('[role="dialog"], [aria-modal="true"]');
      if (dialogs.length) {
        for (const dialog of dialogs) {
          for (const node of dialog.querySelectorAll('button, a, span, p, div')) {
            if (
              node.id?.startsWith('octo-') ||
              node.matches('button:disabled, [aria-disabled="true"]') ||
              node.getAttribute(ACCENT) === 'primary-text'
            ) {
              continue;
            }
            const tc = (node.textContent || '').trim();
            if (!tc || tc.length > 64) continue;
            if (isTikTokRed(getComputedStyle(node).color)) {
              accentWrites.set.set(node, 'primary-text');
            }
          }
        }
      }

      for (const el of accentWrites.del) delAttrIfSet(el, ACCENT);
      for (const [el, val] of accentWrites.set) setAttrIfDiff(el, ACCENT, val);
    };

    const apply = () => {
      const root = document.documentElement;
      if (root && root.getAttribute(ATTR) !== MODE) {
        root.setAttribute(ATTR, MODE);
      }
      lastScanAt = Date.now();
      scan(document);
    };

    if (window.__octoMd3) {
      window.__octoMd3.mode = MODE;
      apply();
      return 0;
    }

    let timer = null;
    let lastScanAt = 0;
    let dirtyWhileHidden = false;
    const runScan = () => {
      if (document.visibilityState === 'hidden') {
        dirtyWhileHidden = true;
        return;
      }
      dirtyWhileHidden = false;
      lastScanAt = Date.now();
      scan(document);
    };
    const scheduleScan = () => {
      if (timer) return;
      const elapsed = Date.now() - lastScanAt;
      const delay = elapsed < 400 ? Math.max(150, 400 - elapsed) : 150;
      timer = setTimeout(() => {
        timer = null;
        runScan();
      }, delay);
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'hidden' && dirtyWhileHidden) {
        scheduleScan();
      }
    };
    const onPopState = () => scheduleScan();

    const state = {
      mode: MODE,
      attrObserver: null,
      domObserver: null,
      stop() {
        if (timer) clearTimeout(timer);
        window.removeEventListener('popstate', onPopState);
        document.removeEventListener('visibilitychange', onVisibility);
        if (railObserver) railObserver.disconnect();
        if (state.attrObserver) state.attrObserver.disconnect();
        if (state.domObserver) state.domObserver.disconnect();
        if (document.documentElement) document.documentElement.removeAttribute(ATTR);
        document.querySelectorAll('[' + ACCENT + ']').forEach((el) => el.removeAttribute(ACCENT));
        document.querySelectorAll('[' + NAV + ']').forEach((el) => el.removeAttribute(NAV));
        document.querySelectorAll('[' + POS + ']').forEach((el) => el.removeAttribute(POS));
        document.querySelectorAll('[' + BTN_GROUP + ']').forEach((el) => el.removeAttribute(BTN_GROUP));
        document.querySelectorAll('[' + ICON + ']').forEach((el) => el.removeAttribute(ICON));
        document.querySelectorAll('[' + ACTION + ']').forEach((el) => el.removeAttribute(ACTION));
        document.querySelectorAll('[' + SURFACE + ']').forEach((el) => el.removeAttribute(SURFACE));
        document.querySelectorAll('[' + FG + ']').forEach((el) => el.removeAttribute(FG));
        document.querySelectorAll('[data-octo-md3-rail]').forEach((el) => el.removeAttribute('data-octo-md3-rail'));
        document.querySelectorAll('[data-octo-md3-logo]').forEach((el) => el.removeAttribute('data-octo-md3-logo'));
        document
          .querySelectorAll('[data-octo-md3-toggle-abs]')
          .forEach((el) => el.removeAttribute('data-octo-md3-toggle-abs'));
        document
          .querySelectorAll('[data-octo-md3-nav-slot]')
          .forEach((el) => el.removeAttribute('data-octo-md3-nav-slot'));
        document
          .querySelectorAll('[data-octo-md3-nav-slot-parent]')
          .forEach((el) => el.removeAttribute('data-octo-md3-nav-slot-parent'));
        document
          .querySelectorAll('[data-octo-md3-creator-pos]')
          .forEach((el) => el.removeAttribute('data-octo-md3-creator-pos'));
        document.querySelectorAll('[' + CHAT_LAYOUT + ']').forEach((el) => el.removeAttribute(CHAT_LAYOUT));
        delete window.__octoMd3;
      },
    };

    window.addEventListener('popstate', onPopState);
    document.addEventListener('visibilitychange', onVisibility);

    const root = document.documentElement;
    if (root && typeof MutationObserver !== 'undefined') {
      state.attrObserver = new MutationObserver(() => {
        const current = document.documentElement;
        if (current && current.getAttribute(ATTR) !== state.mode) {
          current.setAttribute(ATTR, state.mode);
        }
      });
      state.attrObserver.observe(root, { attributes: true, attributeFilter: [ATTR] });

      const CLASS_TARGET_SELECTOR =
        'button, a, [role="button"], [role="tab"], [role="switch"], [role="dialog"], [class*="Switch"], [class*="Toggle"], [class*="TabItem"], [class*="DivSideNavContainer"], [' +
        SURFACE +
        '="sidenav"], [' +
        SURFACE +
        '="drawer"], [class*="ConversationItem" i], [class*="ChatItem" i], [class*="SessionItem" i]';

      state.domObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const t = mutation.target;
          if (t instanceof Element) {
            if (t.id?.startsWith('octo-') || t.closest('#octo-badge-modal, .octo-user-badge')) continue;
            if (mutation.type === 'attributes') {
              if (mutation.attributeName === 'class' && !t.matches(CLASS_TARGET_SELECTOR)) {
                continue;
              }
              scheduleScan();
              return;
            }
          }
          if (mutation.addedNodes.length > 0) {
            let relevant = false;
            for (const n of mutation.addedNodes) {
              if (n.nodeType === 1 && !n.id?.startsWith('octo-') && !n.classList?.contains('octo-user-badge')) {
                relevant = true;
                break;
              }
            }
            if (relevant) {
              scheduleScan();
              return;
            }
          }
        }
      });
      state.domObserver.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'aria-current',
          'aria-selected',
          'aria-checked',
          'aria-pressed',
          'data-checked',
          'data-active',
          'data-selected',
          'class',
        ],
      });
    }

    window.__octoMd3 = state;
    apply();
    return 1;
  })()`;
}

const CLEANUP_JS = `(() => {
  if (window.__octoMd3) {
    window.__octoMd3.stop();
    return;
  }
  if (document.documentElement) {
    document.documentElement.removeAttribute('${MD3_ATTR}');
  }
  document
    .querySelectorAll('[${ACCENT_ATTR}]')
    .forEach((el) => el.removeAttribute('${ACCENT_ATTR}'));
  document
    .querySelectorAll('[${NAV_ATTR}]')
    .forEach((el) => el.removeAttribute('${NAV_ATTR}'));
  document
    .querySelectorAll('[${POS_ATTR}]')
    .forEach((el) => el.removeAttribute('${POS_ATTR}'));
  document
    .querySelectorAll('[${BTN_GROUP_ATTR}]')
    .forEach((el) => el.removeAttribute('${BTN_GROUP_ATTR}'));
  document
    .querySelectorAll('[${ICON_ATTR}]')
    .forEach((el) => el.removeAttribute('${ICON_ATTR}'));
  document
    .querySelectorAll('[${ACTION_ATTR}]')
    .forEach((el) => el.removeAttribute('${ACTION_ATTR}'));
  document
    .querySelectorAll('[${SURFACE_ATTR}]')
    .forEach((el) => el.removeAttribute('${SURFACE_ATTR}'));
  document
    .querySelectorAll('[${FG_ATTR}]')
    .forEach((el) => el.removeAttribute('${FG_ATTR}'));
  document
    .querySelectorAll('[data-octo-md3-rail]')
    .forEach((el) => el.removeAttribute('data-octo-md3-rail'));
  document
    .querySelectorAll('[data-octo-md3-logo]')
    .forEach((el) => el.removeAttribute('data-octo-md3-logo'));
  document
    .querySelectorAll('[data-octo-md3-toggle-abs]')
    .forEach((el) => el.removeAttribute('data-octo-md3-toggle-abs'));
  document
    .querySelectorAll('[data-octo-md3-nav-slot]')
    .forEach((el) => el.removeAttribute('data-octo-md3-nav-slot'));
  document
    .querySelectorAll('[data-octo-md3-nav-slot-parent]')
    .forEach((el) => el.removeAttribute('data-octo-md3-nav-slot-parent'));
  document
    .querySelectorAll('[data-octo-md3-creator-pos]')
    .forEach((el) => el.removeAttribute('data-octo-md3-creator-pos'));
  document
    .querySelectorAll('[${CHAT_LAYOUT_ATTR}]')
    .forEach((el) => el.removeAttribute('${CHAT_LAYOUT_ATTR}'));
})()`;

module.exports = {
  MD3_ATTR,
  ACCENT_ATTR,
  NAV_ATTR,
  POS_ATTR,
  BTN_GROUP_ATTR,
  ICON_ATTR,
  ACTION_ATTR,
  SURFACE_ATTR,
  FG_ATTR,
  CHAT_LAYOUT_ATTR,
  DARK_TOKENS,
  LIGHT_TOKENS,
  siteCss,
  shadowCss,
  syncScript,
  CLEANUP_JS,
};
