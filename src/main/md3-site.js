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

const { DEFAULT_PALETTE, getPaletteTokens, getIridescentCssTokens } = require('./md3-palettes');

const MD3_ATTR = 'data-octo-md3';
const AMOLED_ATTR = 'data-octo-md3-amoled';
const RAINBOW_ATTR = 'data-octo-rainbow';
const ACCENT_ATTR = 'data-octo-md3-accent';
const NAV_ATTR = 'data-octo-md3-nav';
const POS_ATTR = 'data-octo-md3-pos';
const BTN_GROUP_ATTR = 'data-octo-md3-btn';
const ICON_ATTR = 'data-octo-md3-icon';
const ACTION_ATTR = 'data-octo-md3-action';
const SURFACE_ATTR = 'data-octo-md3-surface';
const FG_ATTR = 'data-octo-md3-fg';
const CHAT_LAYOUT_ATTR = 'data-octo-md3-chat-layout';
const PROBE_ATTR = 'data-octo-md3-probe';
const RIPPLE_ATTR = 'data-octo-md3-ripple';

const DARK_TOKENS = getPaletteTokens(DEFAULT_PALETTE, true);
const LIGHT_TOKENS = getPaletteTokens(DEFAULT_PALETTE, false);

function mixAlpha(color, pct) {
  if (typeof color === 'string' && color.startsWith('oklch(') && !color.includes('/')) {
    return `${color.slice(0, -1)} / ${(pct / 100).toFixed(2)})`;
  }
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

function tokenDeclarations(
  dark,
  paletteId = DEFAULT_PALETTE,
  customTheme = null,
  amoled = false,
  rainbow = false,
) {
  const opts = { amoled: Boolean(dark && amoled) };
  const t = rainbow
    ? getIridescentCssTokens(dark, opts)
    : getPaletteTokens(paletteId, dark, customTheme, opts);
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
    --tux-colorBGReverse: ${t.inverseSurface} !important;
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
    --tux-colorTextTertiary: ${t.onSurfaceVariant} !important;
    --tux-colorTextQuaternary: ${t.onSurfaceVariant} !important;
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
    --bg-inverse-3: ${mixAlpha(t.surfaceContainerHigh, 78)} !important;
    --BG-Dark-BGLevitation: ${t.surfaceContainerHigh} !important;
    --primary: ${t.primary} !important;
    --primary-2: ${t.onSurface} !important;
    --live-color-start: ${t.primary} !important;
    --live-color-end: ${t.secondary} !important;
    --text-primary: ${t.onSurface} !important;
    --text-secondary: ${t.onSurfaceVariant} !important;
    --text-tertiary: ${t.onSurfaceVariant} !important;
    --text-tertiary-2: ${t.onSurfaceVariant} !important;
    --text-tertiary-alt: ${t.onSurfaceVariant} !important;
    --text-quaternary: ${t.onSurfaceVariant} !important;
    --text-reverse: ${t.onSurface} !important;
    --text-reverse-2: ${t.onSurfaceVariant} !important;
    --const-text-primary: #ffffff !important;
    --line-primary: ${mixAlpha(t.outlineVariant, 45)} !important;
    --line-primary-2: ${mixAlpha(t.outlineVariant, 55)} !important;
    --line-secondary: ${mixAlpha(t.outlineVariant, 42)} !important;
    --line-reverse-2: ${mixAlpha(t.outlineVariant, 42)} !important;
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
    --ui-shape-primary-2: ${mixAlpha(t.primary, 60)} !important;
    --ui-shape-primary-3: ${mixAlpha(t.primary, 42)} !important;
    --ui-shape-primary-4: ${mixAlpha(t.primary, 24)} !important;
    --ui-shape-text-1-on-primary: ${t.onPrimary} !important;
    --ui-shape-neutral: ${t.onSurface} !important;
    --ui-shape-neutral-2: ${mixAlpha(t.onSurface, 24)} !important;
    --ui-shape-neutral-3: ${mixAlpha(t.onSurface, 14)} !important;
    --ui-shape-neutral-4: ${mixAlpha(t.onSurface, 8)} !important;
    --ui-shape-text-1-on-neutral: ${t.surface} !important;
    --ui-text-1: ${t.onSurface} !important;
    --ui-text-1-display: ${t.onSurface} !important;
    --ui-text-2: ${t.onSurfaceVariant} !important;
    --ui-text-3: ${t.onSurfaceVariant} !important;
    --ui-text-placeholder: ${t.onSurfaceVariant} !important;
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
    --tux-v2-color-ui-sheet-backdrop-2: ${mixAlpha(t.scrim, 72)} !important;
    --tux-v2-color-ui-shape-primary: ${t.primary} !important;
    --tux-v2-color-ui-shape-primary-2: ${mixAlpha(t.primary, 60)} !important;
    --tux-v2-color-ui-shape-primary-3: ${mixAlpha(t.primary, 42)} !important;
    --tux-v2-color-ui-shape-primary-4: ${mixAlpha(t.primary, 24)} !important;
    --tux-v2-color-ui-shape-text-1-on-primary: ${t.onPrimary} !important;
    --tux-v2-color-ui-shape-text-2-on-primary: ${t.onPrimaryContainer} !important;
    --tux-v2-color-ui-shape-neutral: ${t.onSurface} !important;
    --tux-v2-color-ui-shape-neutral-2: ${mixAlpha(t.onSurface, 24)} !important;
    --tux-v2-color-ui-shape-neutral-3: ${mixAlpha(t.onSurface, 14)} !important;
    --tux-v2-color-ui-shape-neutral-4: ${mixAlpha(t.onSurface, 8)} !important;
    --tux-v2-color-ui-shape-text-1-on-neutral: ${t.surface} !important;
    --tux-v2-color-ui-text-1: ${t.onSurface} !important;
    --tux-v2-color-ui-text-1-display: ${t.onSurface} !important;
    --tux-v2-color-ui-text-2: ${t.onSurfaceVariant} !important;
    --tux-v2-color-ui-text-3: ${t.onSurfaceVariant} !important;
    --tux-v2-color-ui-text-placeholder: ${t.onSurfaceVariant} !important;
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
    --tux-v2-color-live-foundation-background-1: ${mixAlpha(t.surfaceContainer, 78)} !important;
    --tux-v2-color-live-foundation-shape-1: ${mixAlpha(t.surfaceContainerHigh, 72)} !important;
    --tux-v2-color-live-foundation-shape-2: ${t.surfaceContainerHigh} !important;
    --tux-v2-color-live-revenue-recharge-shape-1: ${t.surfaceContainerHigh} !important;
    --tux-v2-color-live-revenue-recharge-shape-2: ${mixAlpha(t.surfaceContainerHigh, 76)} !important;

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
    --semi-color-text-2: ${t.onSurfaceVariant} !important;
    --semi-color-text-3: ${t.onSurfaceVariant} !important;
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
    --color-text-3: ${t.onSurfaceVariant} !important;
    --color-background-primary: ${t.surface} !important;
    --color-background-secondary: ${t.surfaceContainerLow} !important;
    --color-text-primary: ${t.onSurface} !important;
    --color-text-secondary: ${t.onSurfaceVariant} !important;
  `;
}

function expressiveBg(
  dark = true,
  paletteId = DEFAULT_PALETTE,
  customTheme = null,
  amoled = false,
  rainbow = false,
) {
  if (rainbow) {
    return `
      radial-gradient(520px 360px at 18% 22%, color-mix(in srgb, var(--octo-md-primary) 13%, transparent), transparent 70%),
      radial-gradient(460px 340px at 84% 76%, color-mix(in srgb, var(--octo-md-primary-container) 36%, transparent), transparent 72%)
    `;
  }
  const t = getPaletteTokens(paletteId, dark, customTheme, { amoled: Boolean(dark && amoled) });
  const c1 = encodeURIComponent(t.primaryContainer);
  const c2 = encodeURIComponent(t.primary);
  const c3 = encodeURIComponent(t.tertiary);
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900' fill='none'%3E%3Crect x='250' y='96' width='220' height='98' rx='49' transform='rotate(-18 360 145)' fill='${c1}' fill-opacity='0.34'/%3E%3Cpath d='M335 560c22-40 78-40 100 0 18 32 58 39 85 15 34-30 90-2 85 45-4 36 25 66 60 63 46-4 75 50 45 85-24 28-16 68 15 85 40 22 40 78 0 100-32 18-39 58-15 85 30 34 2 90-45 85-36-4-66 25-63 60 4 46-50 75-85 45-28-24-68-16-85 15-22 40-78 40-100 0-18-32-58-39-85-15-34 30-90 2-85-45 4-36-25-66-60-63-46 4-75-50-45-85 24-28 16-68-15-85-40-22-40-78 0-100 32-18 39-58 15-85-30-34-2-90 45-85 36 4 66-25 63-60-4-46 50-75 85-45 28 24 68 16 85-15Z' fill='${c2}' fill-opacity='0.065'/%3E%3Cpath d='M1040 110q11 58 69 69-58 11-69 69-11-58-69-69 58-11 69-69Z' fill='${c3}' fill-opacity='0.065'/%3E%3Crect x='1100' y='240' width='200' height='200' rx='58' transform='rotate(22 1200 340)' fill='${c1}' fill-opacity='0.24'/%3E%3Cpath d='M1190 610c14-26 50-26 64 0 12 21 38 25 56 10 22-20 59-1 55 29-3 24 16 43 40 41 30-3 49 33 29 56-16 18-11 44 10 55 26 14 26 50 0 64-21 12-25 38-10 56 20 22 1 59-29 55-24-3-43 16-41 40 3 30-33 49-56 29-18-16-44-11-55 10-14 26-50 26-64 0-12-21-38-25-56-10-22 20-59 1-55-29 3-24-16-43-40-41-30 3-49-33-29-56 16-18 11-44-10-55-26-14-26-50 0-64 21-12 25-38 10-56-20-22-1-59 29-55 24 3 43-16 41-40-3-30 33-49 56-29 18 16 44 11 55-10Z' fill='${c2}' fill-opacity='0.075'/%3E%3Crect x='230' y='340' width='90' height='42' rx='21' transform='rotate(32 275 361)' stroke='${c2}' stroke-opacity='0.14' stroke-width='2'/%3E%3Cpath d='M950 510q7 34 41 41-34 7-41 41-7-34-41-41 34-7 41-41Z' fill='${c2}' fill-opacity='0.1'/%3E%3C/svg%3E")`;
}

function baseCanvasCss(
  dark = true,
  paletteId = DEFAULT_PALETTE,
  customTheme = null,
  amoled = false,
  rainbow = false,
) {
  const bgLayer = expressiveBg(dark, paletteId, customTheme, amoled, rainbow);
  return `
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
      ${bgLayer},
      radial-gradient(640px 440px at 26% 14%, color-mix(in srgb, var(--octo-md-primary) 12%, transparent), transparent 70%),
      radial-gradient(580px 420px at 76% 84%, color-mix(in srgb, var(--octo-md-primary-container) 34%, transparent), transparent 72%) !important;
    background-repeat: no-repeat, no-repeat, no-repeat !important;
    background-size: cover, auto, auto !important;
    background-position: center, center, center !important;
  }

  [${MD3_ATTR}="light"] body {
    background-image:
      ${bgLayer},
      radial-gradient(640px 440px at 26% 14%, color-mix(in srgb, var(--octo-md-primary) 14%, transparent), transparent 70%),
      radial-gradient(580px 420px at 76% 84%, color-mix(in srgb, var(--octo-md-primary-container) 55%, transparent), transparent 72%) !important;
  }

  [${MD3_ATTR}="dark"][${AMOLED_ATTR}="true"] body {
    background-color: #000000 !important;
    background-image: none !important;
  }

  video {
    background-color: transparent !important;
    background-image: none !important;
  }
`;
}

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

  [${SURFACE_ATTR}="drawer"] :where(a, span, p, div, h1, h2, h3, h4, label, strong, button, [role="button"], [role="menuitem"], svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([${SURFACE_ATTR}="chip-active"]):not([${SURFACE_ATTR}="chip-active"] *):not([${SURFACE_ATTR}="chip"]):not([role="switch"]):not([${ACCENT_ATTR}="switch"]):not([${ACCENT_ATTR}="switch-off"]):not([${ICON_ATTR}="active"]):not([${ICON_ATTR}="active"] *):not([${ACTION_ATTR}="active"]):not([${ACTION_ATTR}="active"] *):not([${PROBE_ATTR}]):not(:disabled):not([aria-disabled="true"]) {
    color: var(--octo-md-on-surface) !important;
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
    box-shadow: none !important;
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
    box-shadow: none !important;
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
    box-shadow: none !important;
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
  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"]):not([${SURFACE_ATTR}="sidenav-search"]):not([${RIPPLE_ATTR}])::after {
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
    box-shadow: none !important;
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
  ) :where(span, p, div, a, label, strong):not([class*="Badge"]):not([class*="Badge"] *):not([class*="Sup"]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *) {
    color: var(--octo-md-on-secondary-container) !important;
  }

  :is([class*="DivSideNavContainer"], [${SURFACE_ATTR}="sidenav"]) :is(a, button, [role="button"]):where(:not([${NAV_ATTR}="active"]):not([aria-current="page"]):not([aria-selected="true"]):not([data-active="true"]):not([class*="-Active"]):not([class*="--active"]):not([class*="IsActive"]):not([class*="is-active"]):not([data-e2e="tiktok-logo"]):not([data-octo-md3-logo="1"]):not([class*="Search"]):not([${SURFACE_ATTR}="sidenav-search"]):not([${SURFACE_ATTR}="sidenav-creator"]):not([${SURFACE_ATTR}="drawer"] *):not([data-e2e*="login" i]):not([class*="LoginButton" i]):not([id^="octo-"])) :where(span, p, div, label, strong):not([class*="Badge" i]):not([class*="Badge" i] *):not([class*="Sup"]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *):not([${ICON_ATTR}="active"]) {
    color: inherit !important;
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

  [${SURFACE_ATTR}="sidenav"] [${SURFACE_ATTR}="sidenav-creator"] :where(span, p, div, label, strong):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]) {
    color: var(--octo-md-on-surface) !important;
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
  [${SURFACE_ATTR}="header"][${SURFACE_ATTR}="header"][${SURFACE_ATTR}="header"] {
    background-color: var(--octo-md-surface-container-low) !important;
    background-image: none !important;
    color: var(--octo-md-on-surface) !important;
    border-bottom: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
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
    header[class*="Header"],
    [${SURFACE_ATTR}="header"]
  ) :where(div, nav, section, ul, li):not([${PROBE_ATTR}]):not([${PROBE_ATTR}] *):not([${SURFACE_ATTR}="header"]):not([data-e2e="search-box"]):not([class*="Search"]):not([role="button"]):not(button):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="tonal"]):not([class*="TUXButton"]):not([role="menu"]):not([role="menu"] *):not([role="listbox"]):not([role="listbox"] *):not([role="dialog"]):not([role="dialog"] *):not([role="tooltip"]):not([role="tooltip"] *):not([data-e2e="search-transfer-list"]):not([data-e2e="search-transfer-list"] *):not([class*="TUXPopover"]):not([class*="TUXPopover"] *):not([class*="DivPopupContainer"]):not([class*="DivPopupContainer"] *):not([class*="DivDropdown"]):not([class*="DivDropdown"] *):not([class*="DivMenuContainer"]):not([class*="DivMenuContainer"] *):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([class*="Avatar" i]):not([id^="octo-"]) {
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
  ) :where(a, span, p, div, h1, h2, h3, h4, label, button, svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *):not([class*="TUXButton--primary"]):not([class*="TUXButton--primary"] *):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([role="tooltip"]):not([role="tooltip"] *):not([${ICON_ATTR}="inverse"]):not([${ICON_ATTR}="inverse"] *):not([${FG_ATTR}="inverse"]):not([${FG_ATTR}="inverse"] *):not([${ICON_ATTR}="active"]):not([${ICON_ATTR}="active"] *):not([${ACTION_ATTR}="active"]):not([${ACTION_ATTR}="active"] *):not([${PROBE_ATTR}]) {
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
    box-shadow: none !important;
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

  :is([data-e2e="search-transfer-list"], [class*="DivSearchSuggestion"], [class*="DivSearchHistory"]) :where(a, span, p, div, label, strong, li, button, svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not(:disabled):not([aria-disabled="true"]) {
    color: var(--octo-md-on-surface) !important;
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
    box-shadow: none !important;
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

  /* Активные реакции с круглой подложкой (лайк, избранное, репост): заметный акцент темы */
  [${ACTION_ATTR}="active"][${ACTION_ATTR}="active"] {
    background-color: var(--octo-md-primary) !important;
    color: var(--octo-md-on-primary) !important;
    box-shadow: var(--octo-md-elevation-1) !important;
  }

  [${ACTION_ATTR}="active"] svg {
    color: var(--octo-md-on-primary) !important;
  }

  [${ACTION_ATTR}="active"] svg:not([fill="none"]),
  [${ACTION_ATTR}="active"] svg:not([fill="none"]) :where(path, circle, rect, polygon, polyline, ellipse):not([fill="none"]),
  [${ACTION_ATTR}="active"] svg[fill="none"] :where(path, circle, rect, polygon, polyline, ellipse)[fill]:not([fill="none"]) {
    fill: var(--octo-md-on-primary) !important;
  }

  [${ACTION_ATTR}="active"] svg[stroke]:not([stroke="none"]),
  [${ACTION_ATTR}="active"] svg :where(path, circle, rect, polygon, polyline, ellipse)[stroke]:not([stroke="none"]) {
    stroke: var(--octo-md-on-primary) !important;
  }

  /* Активные иконки без круглой подложки (комментарии, компактная вёрстка) */
  [${ICON_ATTR}="active"]:not([${ACTION_ATTR}="active"] *) {
    color: var(--octo-md-primary) !important;
  }

  [${ICON_ATTR}="active"]:not([${ACTION_ATTR}="active"] *):not([fill="none"]):is(svg, path, circle, rect, polygon, polyline, ellipse),
  svg[${ICON_ATTR}="active"]:not([${ACTION_ATTR}="active"] *):not([fill="none"]) :where(path, circle, rect, polygon, polyline, ellipse):not([fill="none"]),
  svg[fill="none"][${ICON_ATTR}="active"]:not([${ACTION_ATTR}="active"] *) :where(path, circle, rect, polygon, polyline, ellipse)[fill]:not([fill="none"]) {
    fill: var(--octo-md-primary) !important;
  }

  [${ICON_ATTR}="active"]:not([${ACTION_ATTR}="active"] *)[stroke]:not([stroke="none"]),
  [${ICON_ATTR}="active"]:not([${ACTION_ATTR}="active"] *) :where(path, circle, rect, polygon, polyline, ellipse)[stroke]:not([stroke="none"]) {
    stroke: var(--octo-md-primary) !important;
  }

  :is(
    [class*="ButtonActionItem"],
    [data-e2e*="like-icon"],
    [data-e2e*="favorite-icon"],
    [data-e2e="undefined-icon"],
    [data-e2e*="collect-icon"],
    [data-e2e*="bookmark-icon"],
    [data-e2e*="repost-icon"]
  ):not([${ACTION_ATTR}="active"]):not(:has([${ACTION_ATTR}="active"])) :is(path, circle, rect, polygon, polyline, ellipse):is(
    [fill="#FE2C55" i],
    [fill="#FF3B5C" i],
    [fill="#EA284E" i],
    [fill="#FACE15" i],
    [fill="#FFB800" i],
    [fill="#FFC800" i],
    [fill="#FFCC00" i]
  ) {
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
    box-shadow: var(--octo-md-elevation-1) !important;
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

  [${SURFACE_ATTR}="player-seekbar"][data-octo-md3-seek-wave="1"] {
    overflow: visible !important;
  }

  [${SURFACE_ATTR}="player-seekbar"][data-octo-md3-seek-rel="1"] {
    position: relative !important;
  }

  [${SURFACE_ATTR}="player-seekbar"][data-octo-md3-seek-wave="1"] *:not(.octo-md3-seek-canvas) {
    opacity: 0 !important;
  }

  .octo-md3-seek-canvas {
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    top: 50% !important;
    width: 100% !important;
    height: 20px !important;
    transform: translateY(-50%) !important;
    pointer-events: none !important;
    z-index: 3 !important;
    display: block !important;
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
  ) :where(div, span, p, label, time, a, strong, button, [role="button"], svg, g, path, circle, rect, line, polyline, polygon, ellipse, use):not([${ACCENT_ATTR}="switch"]):not([${ACCENT_ATTR}="switch"] *):not([${ACCENT_ATTR}="switch-off"]):not([${ACCENT_ATTR}="switch-off"] *):not([${ACCENT_ATTR}="progress"]):not([${SURFACE_ATTR}="player-seekbar"]):not([${SURFACE_ATTR}="player-seekbar"] *):not([${SURFACE_ATTR}="player-seekbar-thumb"]):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ICON_ATTR}="active"]):not([${ICON_ATTR}="active"] *):not([${ACTION_ATTR}="active"]):not([${ACTION_ATTR}="active"] *):not([${PROBE_ATTR}]):not([${PROBE_ATTR}] *) {
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
    color: var(--octo-md-on-surface) !important;
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

  [${SURFACE_ATTR}="comments"] :where(span, p, div, h1, h2, h3, h4, label, a, strong, button, svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([${ICON_ATTR}="active"]):not([${ICON_ATTR}="active"] *):not([${ACTION_ATTR}="active"]):not([${ACTION_ATTR}="active"] *):not([${PROBE_ATTR}]):not([data-e2e="comment-post"]):not(:disabled):not([aria-disabled="true"]) {
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="comments"] :is(button, [role="button"]):not([data-e2e="comment-post"]):not([class*="Primary"]):not([${ACCENT_ATTR}="primary"]):not([${ACTION_ATTR}="active"]) {
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

  [${SURFACE_ATTR}="live-footer"] :where(span, p, div, label, strong, a, svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not(:disabled):not([aria-disabled="true"]) {
    color: var(--octo-md-on-surface) !important;
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

  :is([${CHAT_LAYOUT_ATTR}="host"], [${CHAT_LAYOUT_ATTR}="host-flush"]) {
    flex: 1 1 auto !important;
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin-inline: 0 !important;
  }

  :is([${CHAT_LAYOUT_ATTR}="flush"], [${CHAT_LAYOUT_ATTR}="host-flush"]) {
    margin-inline: 0 !important;
    padding-inline: 0 !important;
  }

  [${CHAT_LAYOUT_ATTR}="sidebar"] {
    min-width: 348px !important;
    width: 348px !important;
    box-sizing: border-box !important;
    flex-shrink: 0 !important;
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    border-inline-end: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${CHAT_LAYOUT_ATTR}="main"] {
    flex: 1 1 0% !important;
    width: auto !important;
    max-width: none !important;
    min-width: 0 !important;
    background-color: var(--octo-md-surface) !important;
    color: var(--octo-md-on-surface) !important;
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

  :is([${CHAT_LAYOUT_ATTR}="host"], [${CHAT_LAYOUT_ATTR}="host-flush"]) :is(
    [class*="DivChatMain"],
    [class*="DivMessageContainer"],
    [class*="DivChatBox"],
    [class*="ChatDetail"],
    [class*="MessageDetail"],
    [class*="ConversationDetail"],
    [class*="ChatArea"]
  ) {
    flex: 1 1 0% !important;
    width: auto !important;
    max-width: none !important;
    min-width: 0 !important;
  }

  [${SURFACE_ATTR}="card"][${SURFACE_ATTR}="card"][${SURFACE_ATTR}="card"] {
    background-color: var(--octo-md-surface-container-low) !important;
    color: var(--octo-md-on-surface) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 40%, transparent) !important;
  }

  :is(
    [data-e2e="chat-list-item"],
    [class*="DivConversationItem"],
    [class*="DivChatItem"],
    [class*="SessionItem"],
    [class*="ContactItem"],
    [class*="ConversationItem"],
    [class*="ChatItem"]
  ):not([${PROBE_ATTR}]) {
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
  ) :where(span, p, div, strong, label, h1, h2, h3, h4):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *):not([class*="Avatar" i]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *) {
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
  [${SURFACE_ATTR}="chat-active"][${SURFACE_ATTR}="chat-active"][${SURFACE_ATTR}="chat-active"] {
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

  /* Строка списка, которую сайт подсвечивает светлым :hover (классы не известны
     заранее — строку находит скрипт по цвету): тональная подсветка MD3. */
  html[${MD3_ATTR}] [${SURFACE_ATTR}="chat-hover"][${SURFACE_ATTR}="chat-hover"][${SURFACE_ATTR}="chat-hover"],
  [${SURFACE_ATTR}="chat-hover"][${SURFACE_ATTR}="chat-hover"][${SURFACE_ATTR}="chat-hover"] {
    border-radius: 14px !important;
    background-color: var(--octo-md-surface-container-high) !important;
    background-image: none !important;
    color: var(--octo-md-on-surface) !important;
  }

  [${SURFACE_ATTR}="chat-hover"]::before,
  [${SURFACE_ATTR}="chat-hover"]:not([${RIPPLE_ATTR}])::after,
  [${SURFACE_ATTR}="chat-hover"] :where(div, section, li, a):not(button):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *):not([class*="Avatar" i]):not([data-e2e*="more" i]):not([aria-haspopup])::before,
  [${SURFACE_ATTR}="chat-hover"] :where(div, section, li, a):not(button):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *):not([class*="Avatar" i]):not([data-e2e*="more" i]):not([aria-haspopup]):not([${RIPPLE_ATTR}])::after {
    background-color: transparent !important;
    background-image: none !important;
  }

  [${SURFACE_ATTR}="chat-hover"] :where(div, section, li, a):not(button):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *):not([class*="Avatar" i]):not([data-e2e*="more" i]):not([aria-haspopup]) {
    background-color: transparent !important;
    background-image: none !important;
  }

  [${SURFACE_ATTR}="chat-hover"] :where(span, p, div, strong, h1, h2, h3, h4):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="badge"] *):not([data-e2e="inbox-badge"]):not([data-e2e="inbox-badge"] *):not([class*="Avatar" i]) {
    color: var(--octo-md-on-surface) !important;
  }

  /* Замер собственного цвета сайта: на время замера снятой подложки переходы
     выключены, иначе getComputedStyle вернёт промежуточный цвет, а возврат
     подложки покажет белую вспышку. */
  [${PROBE_ATTR}],
  [${PROBE_ATTR}] * {
    transition: none !important;
  }

  [${FG_ATTR}="on-surface"] {
    color: var(--octo-md-on-surface) !important;
  }

  [${FG_ATTR}="inverse"] {
    color: var(--octo-md-inverse-on-surface) !important;
  }

  [${FG_ATTR}="const-white"] {
    color: #ffffff !important;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.72) !important;
  }

  [${ICON_ATTR}="on-surface"] {
    color: var(--octo-md-on-surface) !important;
  }

  [${ICON_ATTR}="inverse"] {
    color: var(--octo-md-inverse-on-surface) !important;
  }

  [${ICON_ATTR}="const-white"] {
    color: #ffffff !important;
  }

  [${ICON_ATTR}="fill"],
  [${ICON_ATTR}="fill-stroke"] {
    fill: var(--octo-md-on-surface) !important;
  }

  [${ICON_ATTR}="stroke"],
  [${ICON_ATTR}="fill-stroke"] {
    stroke: var(--octo-md-on-surface) !important;
  }

  [${ICON_ATTR}="inverse-fill"],
  [${ICON_ATTR}="inverse-fill-stroke"] {
    fill: var(--octo-md-inverse-on-surface) !important;
  }

  [${ICON_ATTR}="inverse-stroke"],
  [${ICON_ATTR}="inverse-fill-stroke"] {
    stroke: var(--octo-md-inverse-on-surface) !important;
  }

  [${ICON_ATTR}="const-fill"],
  [${ICON_ATTR}="const-fill-stroke"] {
    fill: #ffffff !important;
  }

  [${ICON_ATTR}="const-stroke"],
  [${ICON_ATTR}="const-fill-stroke"] {
    stroke: #ffffff !important;
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

  :is(
    [role="dialog"]:not([id^="octo-"]):not([${PROBE_ATTR}]),
    [aria-modal="true"]:not([id^="octo-"]):not([${PROBE_ATTR}]),
    [class*="TUXModal-content"]:not([id^="octo-"]):not([${PROBE_ATTR}]),
    [class*="DivModalContainer"]:not([id^="octo-"]):not([${PROBE_ATTR}]),
    [class*="DivDialogContainer"]:not([id^="octo-"]):not([${PROBE_ATTR}])
  ) :where(h1, h2, h3, h4, p, span, label, strong, a, button, svg):not([${ACCENT_ATTR}="primary-text"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([${ACCENT_ATTR}="badge"]):not([class*="Badge" i]):not([${ICON_ATTR}="active"]):not([${ICON_ATTR}="active"] *):not([${ACTION_ATTR}="active"]):not([${ACTION_ATTR}="active"] *):not([${PROBE_ATTR}]):not(:disabled):not([aria-disabled="true"]):not([role="switch"]):not([${ACCENT_ATTR}="switch"]):not([${ACCENT_ATTR}="switch-off"]):not([class*="DivVideoWrapper"] *):not([class*="DivBasicPlayerWrapper"] *) {
    color: var(--octo-md-on-surface) !important;
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
  ) :where(a, span, p, div, label, strong, li, button, svg, [role="menuitem"], [role="option"]):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([${ACCENT_ATTR}="primary-text"]):not([${ICON_ATTR}="active"]):not([${ICON_ATTR}="active"] *):not([${ACTION_ATTR}="active"]):not([${ACTION_ATTR}="active"] *):not([${PROBE_ATTR}]):not(:disabled):not([aria-disabled="true"]) {
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
  ) :where(span, p, div, strong, label, a, svg) {
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

  [${SURFACE_ATTR}="setting-pane"] :where(h1, h2, h3, h4, p, span, label, a, strong, button, svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([role="switch"]):not([${ACCENT_ATTR}="switch"]):not([${ACCENT_ATTR}="switch-off"]):not(:disabled):not([aria-disabled="true"]) {
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

  [${RIPPLE_ATTR}="rel"] {
    position: relative !important;
    overflow: hidden !important;
  }

  [${RIPPLE_ATTR}="1"] {
    overflow: hidden !important;
  }

  :is([${RIPPLE_ATTR}="1"], [${RIPPLE_ATTR}="rel"])::after {
    content: '' !important;
    position: absolute !important;
    left: var(--octo-rx, 50%) !important;
    top: var(--octo-ry, 50%) !important;
    width: var(--octo-rd, 72px) !important;
    height: var(--octo-rd, 72px) !important;
    border-radius: 50% !important;
    background-color: currentColor !important;
    background-image: none !important;
    border: 0 !important;
    box-shadow: none !important;
    opacity: 0;
    transform: translate(-50%, -50%) scale(0);
    pointer-events: none !important;
    animation: octo-md3-site-ripple ${motion(0.44)} var(--octo-md-ease) forwards !important;
  }

  @keyframes octo-md3-site-ripple {
    0% {
      opacity: 0.16;
      transform: translate(-50%, -50%) scale(0.18);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.15);
    }
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

function rainbowPerformanceCss(
  dark = true,
  paletteId = DEFAULT_PALETTE,
  customTheme = null,
  amoled = false,
) {
  const bgLayer = expressiveBg(dark, paletteId, customTheme, amoled, true);
  return `
    html[${RAINBOW_ATTR}="true"] {
      --octo-md-motion-scale: 0 !important;
    }
    html[${RAINBOW_ATTR}="true"] body {
      background-image: ${bgLayer} !important;
    }
    html[${RAINBOW_ATTR}="true"][${AMOLED_ATTR}="true"] body {
      background-image: none !important;
    }
  `;
}

function siteCss(
  dark = true,
  paletteId = DEFAULT_PALETTE,
  customTheme = null,
  amoled = false,
  rainbow = false,
) {
  return `
    ${TOKEN_ROOTS} {
      ${tokenDeclarations(dark, paletteId, customTheme, amoled, rainbow)}
    }
    ${reducedMotionCss(TOKEN_ROOTS)}
    ${baseCanvasCss(dark, paletteId, customTheme, amoled, rainbow)}
    ${rainbow ? rainbowPerformanceCss(dark, paletteId, customTheme, amoled) : ''}
    ${COMPONENT_CSS}
  `;
}

function shadowCss(
  dark = true,
  paletteId = DEFAULT_PALETTE,
  customTheme = null,
  amoled = false,
  rainbow = false,
) {
  return `
    :host {
      ${tokenDeclarations(dark, paletteId, customTheme, amoled, rainbow)}
      ${rainbow ? '--octo-md-motion-scale: 0 !important;' : ''}
    }
    ${reducedMotionCss(':host')}
    ${COMPONENT_CSS}
  `;
}

function syncScript(dark = true, amoled = false) {
  const mode = dark ? 'dark' : 'light';
  const useAmoled = Boolean(dark && amoled);
  return `(() => {
    const ATTR = '${MD3_ATTR}';
    const AMOLED_ATTR = '${AMOLED_ATTR}';
    const ACCENT = '${ACCENT_ATTR}';
    const NAV = '${NAV_ATTR}';
    const POS = '${POS_ATTR}';
    const BTN_GROUP = '${BTN_GROUP_ATTR}';
    const ICON = '${ICON_ATTR}';
    const ACTION = '${ACTION_ATTR}';
    const SURFACE = '${SURFACE_ATTR}';
    const FG = '${FG_ATTR}';
    const CHAT_LAYOUT = '${CHAT_LAYOUT_ATTR}';
    const PROBE = '${PROBE_ATTR}';
    const MODE = '${mode}';
    const AMOLED = ${useAmoled ? 'true' : 'false'};

    const setAttrIfDiff = (el, name, value) => {
      if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    };
    const delAttrIfSet = (el, name) => {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    };
    const isTikTokRedAttr = (el) => {
      const fill = (el.getAttribute('fill') || '').trim();
      const stroke = (el.getAttribute('stroke') || '').trim();
      const re = /^#(?:fe2c55|ff3b5c|ea284e)$/i;
      return re.test(fill) || re.test(stroke);
    };

    const isTikTokYellowAttr = (el) => {
      const fill = (el.getAttribute('fill') || '').trim();
      const stroke = (el.getAttribute('stroke') || '').trim();
      const re = /^#(?:face15|ffc800|ffb800|ffcc00|f5b800|f9c900|ffd400)$/i;
      return re.test(fill) || re.test(stroke);
    };

    const parseAlpha = (raw) => {
      if (raw === undefined || raw === null || raw === '') return 1;
      const s = String(raw).trim();
      const num = parseFloat(s);
      if (!Number.isFinite(num)) return 1;
      return Math.max(0, Math.min(1, s.endsWith('%') ? num / 100 : num));
    };

    const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

    const linearToByte = (c) => {
      const clamped = Math.max(0, Math.min(1, c));
      const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
      return clampByte(srgb * 255);
    };

    const oklabToRgb = (L, a, b, alpha) => {
      const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
      const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
      const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
      return {
        r: linearToByte(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: linearToByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: linearToByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
        a: alpha,
      };
    };

    const parseRgb = (value) => {
      const str = String(value || '').trim();
      if (!str || str === 'none' || str === 'transparent') return null;
      const m = str.match(/^rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)(?:\\s*,\\s*([\\d.%]+))?\\s*\\)$/i);
      if (m) {
        const alpha = parseAlpha(m[4]);
        if (!alpha) return null;
        return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
      }
      const m4 = str.match(/^rgba?\\(\\s*([\\d.%]+)\\s+([\\d.%]+)\\s+([\\d.%]+)(?:\\s*\\/\\s*([\\d.%]+))?\\s*\\)$/i);
      if (m4) {
        const alpha = parseAlpha(m4[4]);
        if (!alpha) return null;
        const ch = (s) => (s.endsWith('%') ? (parseFloat(s) / 100) * 255 : parseFloat(s));
        return { r: ch(m4[1]), g: ch(m4[2]), b: ch(m4[3]), a: alpha };
      }
      const cs = str.match(/^color\\(\\s*srgb\\s+([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)(?:\\s*\\/\\s*([\\d.%]+))?\\s*\\)$/i);
      if (cs) {
        const alpha = parseAlpha(cs[4]);
        if (!alpha) return null;
        return {
          r: clampByte(parseFloat(cs[1]) * 255),
          g: clampByte(parseFloat(cs[2]) * 255),
          b: clampByte(parseFloat(cs[3]) * 255),
          a: alpha,
        };
      }
      const lch = str.match(/^oklch\\(\\s*([\\d.%]+)\\s+([\\d.%]+)\\s+([-\\d.]+(?:deg|rad|turn)?)(?:\\s*\\/\\s*([\\d.%]+))?\\s*\\)$/i);
      if (lch) {
        const alpha = parseAlpha(lch[4]);
        if (!alpha) return null;
        const L = lch[1].endsWith('%') ? parseFloat(lch[1]) / 100 : parseFloat(lch[1]);
        const C = lch[2].endsWith('%') ? (parseFloat(lch[2]) / 100) * 0.4 : parseFloat(lch[2]);
        let hDeg = parseFloat(lch[3]);
        if (lch[3].endsWith('rad')) hDeg = (hDeg * 180) / Math.PI;
        else if (lch[3].endsWith('turn')) hDeg *= 360;
        const rad = (hDeg * Math.PI) / 180;
        return oklabToRgb(L, C * Math.cos(rad), C * Math.sin(rad), alpha);
      }
      const lab = str.match(/^oklab\\(\\s*([\\d.%]+)\\s+([-\\d.%]+)\\s+([-\\d.%]+)(?:\\s*\\/\\s*([\\d.%]+))?\\s*\\)$/i);
      if (lab) {
        const alpha = parseAlpha(lab[4]);
        if (!alpha) return null;
        const L = lab[1].endsWith('%') ? parseFloat(lab[1]) / 100 : parseFloat(lab[1]);
        const ab = (s) => (s.endsWith('%') ? (parseFloat(s) / 100) * 0.4 : parseFloat(s));
        return oklabToRgb(L, ab(lab[2]), ab(lab[3]), alpha);
      }
      return null;
    };

    const parseCssColor = (value) => {
      const rgb = parseRgb(value);
      if (rgb) return rgb;
      let clean = String(value || '').trim().replace(/^#/, '');
      if (/^[0-9a-f]{3}$/i.test(clean)) {
        clean = clean.split('').map((ch) => ch + ch).join('');
      }
      if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
      const n = parseInt(clean, 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    };

    const colorDist = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

    const isLightColor = (value) => {
      const c = typeof value === 'object' && value ? value : parseRgb(value);
      return Boolean(c && c.a >= 0.7 && c.r >= 200 && c.g >= 200 && c.b >= 200);
    };

    const isDarkColor = (value) => {
      const c = typeof value === 'object' && value ? value : parseRgb(value);
      return Boolean(c && c.a >= 0.5 && c.r <= 115 && c.g <= 115 && c.b <= 115);
    };

    const luminanceOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

    const srgbChannel = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };

    const relLuminance = (c) =>
      0.2126 * srgbChannel(c.r) + 0.7152 * srgbChannel(c.g) + 0.0722 * srgbChannel(c.b);

    const blendOver = (fg, bg) => {
      const a = fg.a >= 1 ? 1 : Math.max(0, fg.a);
      return {
        r: fg.r * a + bg.r * (1 - a),
        g: fg.g * a + bg.g * (1 - a),
        b: fg.b * a + bg.b * (1 - a),
        a: 1,
      };
    };

    const contrastRatioRgb = (fg, bg) => {
      const eff = fg.a < 1 ? blendOver(fg, bg) : fg;
      const l1 = relLuminance(eff);
      const l2 = relLuminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const collectMediaRects = (root) => {
      const rects = [];
      for (const node of root.querySelectorAll(
        'video, [data-e2e="user-post-item"] img, [data-e2e="explore-item"] img, [data-e2e="search_top-item"] img, [data-e2e="favorites-item"] img, [class*="DivVideoCard"] img, [class*="DivExploreCard"] img, [class*="DivLiveCard"] img, [class*="DivBasicPlayerWrapper"] img, [class*="DivVideoWrapper"] img',
      )) {
        if (node.id?.startsWith('octo-')) continue;
        const r = node.getBoundingClientRect();
        if (r.width >= 60 && r.height >= 60) rects.push({ node, rect: r });
      }
      return rects;
    };

    const MEDIA_UI_EXCLUDE =
      '[' +
      SURFACE +
      '="player-controls"], [' +
      SURFACE +
      '="comments"], [' +
      SURFACE +
      '="live-chat"], [' +
      SURFACE +
      '="drawer"], [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], header, [' +
      SURFACE +
      '="header"], [' +
      SURFACE +
      '="sidenav"]';

    const overlapsMedia = (el, mediaRects) => {
      if (!mediaRects || mediaRects.length === 0) return false;
      if (el.closest(MEDIA_UI_EXCLUDE)) return false;
      const er = el.getBoundingClientRect();
      if (er.width <= 0 || er.height <= 0) return false;
      for (const item of mediaRects) {
        if (item.node === el || el.contains(item.node)) continue;
        const mr = item.rect;
        if (er.right > mr.left + 1 && er.left < mr.right - 1 && er.bottom > mr.top + 1 && er.top < mr.bottom - 1) {
          return true;
        }
      }
      return false;
    };

    const plannedSurfaceBg = (kind) => {
      if (kind === 'chat-active') {
        return MODE === 'dark' ? { r: 86, g: 78, b: 112, a: 1 } : { r: 228, g: 219, b: 233, a: 1 };
      }
      if (kind === 'chat-hover' || kind === 'chat-input' || kind === 'live-chat-input' || kind === 'comment-input' || kind === 'field') {
        return MODE === 'dark' ? { r: 62, g: 56, b: 84, a: 1 } : { r: 226, g: 216, b: 232, a: 1 };
      }
      return MODE === 'dark'
        ? (AMOLED ? { r: 8, g: 8, b: 10, a: 1 } : { r: 33, g: 29, b: 48, a: 1 })
        : { r: 239, g: 233, b: 243, a: 1 };
    };

    const effectiveBgInfo = (el, bgCache = null, mediaRects = null, nextSurface = null) => {
      if (bgCache && bgCache.has(el)) return bgCache.get(el);
      const layers = [];
      let cur = el;
      let base = MODE === 'dark' ? (AMOLED ? { r: 0, g: 0, b: 0, a: 1 } : { r: 25, g: 22, b: 36, a: 1 }) : { r: 246, g: 241, b: 248, a: 1 };
      let onMedia = false;
      while (cur && cur.nodeType === 1) {
        const planned = nextSurface ? nextSurface.get(cur) : null;
        if (planned && planned !== 'page' && planned !== 'video-stage' && planned !== 'live-stage') {
          base = plannedSurfaceBg(planned);
          break;
        }
        const cs = getComputedStyle(cur);
        const opRaw = parseFloat(cs.opacity);
        const op = Number.isFinite(opRaw) ? Math.max(0, Math.min(1, opRaw)) : 1;
        if (op < 1 && layers.length > 0) {
          for (const layer of layers) layer.a *= op;
        }
        const c = parseRgb(cs.backgroundColor);
        if (c && c.a * op > 0.02) {
          const effA = c.a * op;
          if (effA >= 0.96) {
            base = { r: c.r, g: c.g, b: c.b, a: 1 };
            break;
          }
          layers.push({ r: c.r, g: c.g, b: c.b, a: effA });
        }
        cur = cur.parentElement || (cur.parentNode && cur.parentNode.host ? cur.parentNode.host : null);
      }
      if (cur == null || cur.nodeType !== 1) {
        if (overlapsMedia(el, mediaRects)) {
          base = { r: 16, g: 16, b: 18, a: 1 };
          onMedia = true;
        }
      }
      let rgb = base;
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        rgb = blendOver(layers[i], rgb);
      }
      const info = { rgb, lum: relLuminance(rgb), lum255: luminanceOf(rgb), onMedia };
      if (bgCache) bgCache.set(el, info);
      return info;
    };

    const effectiveBgLum = (el, lumCache = null) => effectiveBgInfo(el, lumCache).lum255;

    const isMessagesTopPage = () => /^\\/(?:messages|inbox)(?:\\/|$)/i.test(location.pathname || '');

    const topPathIsMessages = () => {
      try {
        return Boolean(
          window.top &&
            window.top !== window &&
            /^\\/(?:messages|inbox)(?:\\/|$)/i.test(window.top.location?.pathname || ''),
        );
      } catch {
        return false;
      }
    };

    const isMessagesRoute = () =>
      isMessagesTopPage() ||
      topPathIsMessages() ||
      /^\\/(?:business-suite|tiktokstudio|creator-center|web[-_]?dm)(?:\\/|$)/i.test(location.pathname || '') ||
      /business\\.tiktok\\.com/i.test(location.hostname || '') ||
      /\\/(?:messages|inbox|business-suite)(?:\\/|$)/i.test(document.referrer || '');

    const isMessagesContext = () =>
      isMessagesRoute() ||
      Boolean(
        document.querySelector(
          '[data-e2e="chat-list-item"], [class*="SessionList" i], [class*="DivConversationList"], [class*="DivChatMain"], [data-e2e="message-input-area"], [class*="InboxList" i]',
        ),
      );

    // Фирменный розово-красный TikTok (#fe2c55, #ff3b5c, #ea284e и приглушённый)
    const isTikTokRed = (value) => {
      const c = parseRgb(value);
      if (!c || c.a < 0.15) return false;
      if (c.r >= 200 && c.g <= 105 && c.b >= 35 && c.b <= 145) return true;
      return c.r >= 95 && c.r >= c.g * 1.65 && c.r > c.b * 1.15 && c.g <= 115 && c.b <= 140;
    };

    // Фирменный жёлто-золотой TikTok (#face15, #ffc800, #ffb800 — «Избранное», репосты)
    const isTikTokYellow = (value) => {
      const c = parseRgb(value);
      if (!c || c.a < 0.25) return false;
      return c.r >= 200 && c.g >= 145 && c.g <= 235 && c.b <= 95 && c.r - c.b >= 110;
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

    let lastLayoutFallbackAt = 0;
    let layoutFallbackTimer = 0;
    const syncMessagesLayout = () => {
      if (layoutFallbackTimer) {
        clearTimeout(layoutFallbackTimer);
        layoutFallbackTimer = 0;
      }
      if (!isMessagesTopPage()) {
        lastLayoutFallbackAt = 0;
        if (document.querySelector('[' + CHAT_LAYOUT + ']')) {
          document.querySelectorAll('[' + CHAT_LAYOUT + ']').forEach((el) => delAttrIfSet(el, CHAT_LAYOUT));
        }
        return;
      }

      const nextLayout = new Map();
      const mediaOrInputSelector =
        'iframe, img, video, canvas, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], button, a[href], [data-e2e="tiktok-logo"], [data-e2e^="nav-"]';
      const chatPaneSelector =
        '[class*="DivChatMain" i], [class*="DivMessageContainer" i], [class*="ChatArea" i]';
      const hasRealNav = (el) =>
        el.matches('[class*="DivSideNavContainer"], nav') &&
        Boolean(el.querySelector('[data-e2e^="nav-"], a[href]'));
      // Вложенный iframe (например, Business Suite) проверяем раньше всего остального,
      // чтобы позднее появление iframe всегда перебивало ранние обёртки/заглушки.
      let workspace = null;
      let isBusinessFrame = false;
      for (const frame of document.querySelectorAll('iframe')) {
        const src = frame.getAttribute('src') || '';
        if (/(?:recaptcha|hcaptcha|turnstile|arkoselabs|stripe|paypal|accounts\\.)/i.test(src)) {
          continue;
        }
        const r = frame.getBoundingClientRect();
        if (frame.getAttribute(CHAT_LAYOUT) === 'frame' || (r.width >= 200 && r.height >= 200)) {
          workspace = frame;
          isBusinessFrame = /(?:business-suite|business\\.tiktok)/i.test(src);
          break;
        }
      }

      const isEmptyPane = (el) => {
        if (!el || el.id?.startsWith('octo-')) return false;
        if (el.matches('header, [role="banner"], [' + SURFACE + '="header"]')) return false;
        if (el.querySelector('iframe')) return false;
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
        return (el.textContent || '').trim().length === 0;
      };

      const hasVisibleSideNav = Array.from(
        document.querySelectorAll('[class*="DivSideNavContainer"]'),
      ).some((nav) => {
        const nr = nav.getBoundingClientRect();
        return nr.width >= 48 && nr.height >= 200 && Boolean(nav.querySelector('[data-e2e^="nav-"], a[href]'));
      });

      if (!workspace) {
        for (const candidate of document.querySelectorAll(
          '[class*="SessionList" i], [class*="ConversationList" i], [class*="ChatList" i], [class*="Inbox" i]',
        )) {
          const r = candidate.getBoundingClientRect();
          const inManaged = Boolean(
            candidate.closest('[' + CHAT_LAYOUT + '="host"], [' + CHAT_LAYOUT + '="host-flush"], [' + CHAT_LAYOUT + '="flush"]'),
          );
          if ((r.left >= 180 || !hasVisibleSideNav || inManaged) && r.width >= 200 && r.height >= 240 && (candidate.textContent || '').trim()) {
            workspace = candidate;
            break;
          }
        }
      }

      if (!workspace) {
        const firstChatRow = document.querySelector('[data-e2e="chat-list-item"]');
        const listWrap = firstChatRow?.parentElement?.closest('div, ul, section, aside');
        if (listWrap) {
          const r = listWrap.getBoundingClientRect();
          if (r.width >= 200 && r.height >= 240) workspace = listWrap;
        }
      }

      // Предыдущую эвристическую разметку переиспользуем только если она сама не является
      // пустой правой заглушкой диалога (💬) и всё ещё содержит список переписок.
      if (!workspace) {
        const sticky = document.querySelector('[' + CHAT_LAYOUT + '="sidebar"], [' + CHAT_LAYOUT + '="list"]');
        if (
          sticky &&
          sticky.isConnected &&
          sticky.clientHeight >= 200 &&
          !sticky.matches(chatPaneSelector) &&
          (sticky.textContent || '').trim()
        ) {
          workspace = sticky;
        }
      }

      const elapsedFallback = Date.now() - lastLayoutFallbackAt;
      if (!workspace && elapsedFallback < 1200) {
        layoutFallbackTimer = setTimeout(syncMessagesLayout, Math.max(50, 1200 - elapsedFallback));
      } else if (!workspace && elapsedFallback >= 1200) {
        lastLayoutFallbackAt = Date.now();
        for (const candidate of document.querySelectorAll('div, section, aside, ul')) {
          if (
            candidate.childElementCount < 2 ||
            candidate.clientWidth < 200 ||
            candidate.clientWidth > 460 ||
            candidate.clientHeight < 260 ||
            candidate.id?.startsWith('octo-') ||
            candidate.matches(
              'header, [role="banner"], [class*="DivSideNavContainer"], [' +
                SURFACE +
                '="sidenav"], [role="dialog"], [role="menu"], ' +
                chatPaneSelector,
            ) ||
            candidate.closest(
              'header, [role="banner"], [class*="DivSideNavContainer"], [' +
                SURFACE +
                '="sidenav"], [role="dialog"], [role="menu"], ' +
                chatPaneSelector,
            )
          ) {
            continue;
          }
          const r = candidate.getBoundingClientRect();
          if (r.top < 0 || !(candidate.textContent || '').trim()) continue;
          const hasRightPane = Boolean(
            candidate.parentElement &&
              Array.from(candidate.parentElement.children).some((sib) => {
                if (sib === candidate || sib.id?.startsWith('octo-')) return false;
                if (sib.clientWidth < 200 || sib.clientHeight < 220) return false;
                const sr = sib.getBoundingClientRect();
                return sr.left >= r.right - 20;
              }),
          );
          if (hasRightPane) {
            workspace = candidate;
            break;
          }
          let rowCount = 0;
          for (const ch of candidate.children) {
            if (ch.clientWidth >= 180 && ch.clientHeight >= 36 && ch.clientHeight <= 140) rowCount += 1;
            if (rowCount >= 3) break;
          }
          if (rowCount >= 3) {
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
          Boolean(
            workspace.closest(
              '[' +
                CHAT_LAYOUT +
                '="host"], [' +
                CHAT_LAYOUT +
                '="host-flush"], [' +
                CHAT_LAYOUT +
                '="flush"], [' +
                CHAT_LAYOUT +
                '="sidebar"]',
            ),
          );
        let constrainedAncestor = !hasVisibleSideNav && wsRect.left >= 12;
        if (!constrainedAncestor && !hasVisibleSideNav) {
          let probe = workspace.parentElement;
          while (probe && probe !== document.body && probe !== document.documentElement) {
            const pr = probe.getBoundingClientRect();
            const pst = getComputedStyle(probe);
            if (
              pr.width < window.innerWidth - 20 ||
              (pst.maxWidth && pst.maxWidth !== 'none') ||
              parseFloat(pst.marginLeft) >= 16 ||
              parseFloat(pst.marginRight) >= 16 ||
              parseFloat(pst.paddingLeft) >= 48 ||
              parseFloat(pst.paddingRight) >= 48
            ) {
              constrainedAncestor = true;
              break;
            }
            probe = probe.parentElement;
          }
        }

        if (wsRect.left >= 180 || alreadyManaged || constrainedAncestor) {
          const ancestors = [];
          let anyHidden = false;
          let anyFlushed = false;
          let cur = workspace;
          while (cur && cur !== document.body && cur !== document.documentElement) {
            const parent = cur.parentElement;
            if (!parent) break;
            // Соседние пустые панели скрываем только при активном iframe (например Business Suite):
            // в обычном /messages загружающаяся или пустая левая колонка со списком не должна
            // получать display: none, иначе список переписок пропадает полностью.
            if (isFrame) {
              for (const sibling of parent.children) {
                if (sibling === cur || sibling.id?.startsWith('octo-')) continue;
                const wasHidden = sibling.getAttribute(CHAT_LAYOUT) === 'hidden';
                if (!wasHidden) {
                  const sr = sibling.getBoundingClientRect();
                  const onLeft = sr.right <= wsRect.left + 20;
                  const onRight = cur !== workspace && sr.left >= wsRect.right - 20;
                  if (sr.width < 32 || sr.height < 200 || (!onLeft && !onRight)) continue;
                }
                if (isEmptyPane(sibling)) {
                  nextLayout.set(sibling, 'hidden');
                  anyHidden = true;
                }
              }
            }
            if (cur !== workspace) {
              ancestors.push(cur);
            }
            cur = parent;
          }

          if (isFrame) {
            nextLayout.set(workspace, 'frame');
          } else {
            let sidebarSet = false;
            if (window.innerWidth >= 820 && wsRect.width >= 240 && wsRect.width < 460 && workspace.parentElement) {
              const rightPane = Array.from(workspace.parentElement.children).find((sib) => {
                if (sib === workspace || sib.id?.startsWith('octo-') || nextLayout.get(sib) === 'hidden') return false;
                const sr = sib.getBoundingClientRect();
                return sr.left >= wsRect.right - 20 && sr.width >= 200 && sr.height >= 200;
              });
              if (rightPane) {
                if (wsRect.width < 348) {
                  nextLayout.set(workspace, 'sidebar');
                  sidebarSet = true;
                }
                nextLayout.set(rightPane, 'main');
              }
            }
            if (!sidebarSet) nextLayout.set(workspace, 'list');
          }

          if (!hasVisibleSideNav) {
            let node = workspace.parentElement;
            while (node && node !== document.body && node !== document.documentElement) {
              const prevLayout = node.getAttribute(CHAT_LAYOUT);
              if (prevLayout === 'flush' || prevLayout === 'host-flush') {
                nextLayout.set(node, 'flush');
                anyFlushed = true;
              } else {
                const st = getComputedStyle(node);
                if (
                  parseFloat(st.marginLeft) >= 24 ||
                  parseFloat(st.marginRight) >= 24 ||
                  parseFloat(st.paddingLeft) >= 48 ||
                  parseFloat(st.paddingRight) >= 48
                ) {
                  nextLayout.set(node, 'flush');
                  anyFlushed = true;
                }
              }
              node = node.parentElement;
            }
          }

          if (isFrame || anyHidden || anyFlushed || constrainedAncestor) {
            for (const el of ancestors) {
              nextLayout.set(el, nextLayout.get(el) === 'flush' ? 'host-flush' : 'host');
            }
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
      'chat-hover',
    ]);

    const syncSurfacesNow = (root) => {
      if (root === document) findSidebars();
      const nextSurface = new Map();
      const nextFg = new Map();
      const lumCache = new WeakMap();
      const mediaRects = collectMediaRects(root);
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
        const rect = el.getBoundingClientRect();
        if (
          rect.left > 340 ||
          rect.width < 200 ||
          rect.width > 480 ||
          rect.height < 260 ||
          rect.height > window.innerHeight
        ) {
          continue;
        }
        const style = getComputedStyle(el);
        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
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
        const btnsWithRect = [];
        for (const el of parent.children) {
          if (!el.matches('button, a, [role="tab"], [role="button"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width >= 24 && r.width <= 320 && r.height >= 20 && r.height <= 44) {
            btnsWithRect.push({ el, rect: r });
          }
        }
        if (btnsWithRect.length < 3) continue;
        const btns = btnsWithRect.map((entry) => entry.el);
        const rects = btnsWithRect.map((entry) => entry.rect);
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
            const alreadyPane = pane.getAttribute(SURFACE) === 'live-chat-pane';
            const bg = getComputedStyle(pane).backgroundColor;
            if (alreadyPane || (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent')) {
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
          if (commentCandidates.has(cur)) break;
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
            rect.height <= 140 &&
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
          '[data-e2e="chat-list-item"], [role="listitem"], [class*="ConversationItem" i], [class*="ChatItem" i], [class*="SessionItem" i], [class*="ContactItem" i], [class*="ListItem" i], [class*="SessionList" i] > div, [class*="SessionList" i] li, [class*="ConversationList" i] > div, [class*="ConversationList" i] li, [class*="ChatList" i] > div, [class*="ChatList" i] li, [class*="InboxList" i] > div, [class*="InboxList" i] li',
        );
        const rowProbes = [];
        for (const row of chatRows) {
          if (row.id?.startsWith('octo-') || row.hasAttribute(PROBE)) continue;
          row.setAttribute(PROBE, '');
          rowProbes.push(row);
        }
        try {
          for (const row of chatRows) {
            if (row.id?.startsWith('octo-')) continue;
            const r = row.getBoundingClientRect();
            if (r.width < 44 || r.height < 36 || r.height > 150) continue;
            if (isLightColor(getComputedStyle(row).backgroundColor)) {
              nextSurface.set(row, row.matches(':hover') ? 'chat-hover' : 'chat-active');
            }
          }
        } finally {
          endProbe(rowProbes);
        }

        const msgPanels = root.querySelectorAll(
          'div, section, aside, nav, ul, li, [role="button"]',
        );
        for (const panel of msgPanels) {
          if (
            panel.id?.startsWith('octo-') ||
            nextSurface.has(panel) ||
            panel.matches('button, input, textarea, [contenteditable], img, video, svg, [class*="Bubble" i], [class*="MessageContent" i], [class*="Avatar" i], [class*="Badge" i]') ||
            panel.closest('[role="dialog"], [role="menu"], [role="tooltip"]') ||
            hasPlannedAncestor(panel, 'chat-active') ||
            hasPlannedAncestor(panel, 'chat-hover') ||
            hasPlannedAncestor(panel, 'header')
          ) {
            continue;
          }
          const r = panel.getBoundingClientRect();
          if (r.width < 44 || r.height < 36) {
            continue;
          }
          if (isLightColor(getComputedStyle(panel).backgroundColor)) {
            const listRow = isListRow(panel, r);
            if (panel.matches('[role="button"]') && !listRow) continue;
            if (!panel.matches('[role="button"]') && r.height >= window.innerHeight * 0.45 && r.width >= window.innerWidth * 0.45) {
              nextSurface.set(panel, 'page');
            } else if (listRow) {
              nextSurface.set(panel, panel.matches(':hover') ? 'chat-hover' : 'chat-active');
            } else if (r.width >= 64 || r.height >= 120) {
              nextSurface.set(panel, 'card');
            }
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
      }

      for (const node of root.querySelectorAll(
        'span, p, div, a, strong, em, b, i, small, label, time, button, h1, h2, h3, h4, h5, h6, li, td, th, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]',
      )) {
        if (node.id?.startsWith('octo-')) continue;
        const tag = node.tagName;
        const ce = tag === 'INPUT' || tag === 'TEXTAREA' ? '' : node.getAttribute('contenteditable');
        const isField = tag === 'INPUT' || tag === 'TEXTAREA' || ce === 'true' || ce === 'plaintext-only';
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
        if (
          hasPlannedAncestor(node, 'chat-active', true) ||
          hasPlannedAncestor(node, 'chat-hover', true) ||
          node.matches(':disabled, [role="button"][aria-disabled="true"]:not([class*="Player"] *), video, img, svg') ||
          node.closest(
            'button:disabled, [role="button"][aria-disabled="true"]:not([class*="Player"] *), [' +
              ACCENT +
              '="primary"], [' +
              ACCENT +
              '="tonal"], [' +
              ACCENT +
              '="badge"], [' +
              ACCENT +
              '="primary-text"], [' +
              ACCENT +
              '="switch"], [' +
              ACCENT +
              '="switch-off"], [data-e2e="inbox-badge"], [role="tooltip"], [class*="Avatar" i], [class*="Emoji" i], [class*="Sticker" i], [class*="DivSideNavContainer"], [' +
              SURFACE +
              '="sidenav"]',
          )
        ) {
          continue;
        }
        const style = getComputedStyle(node);
        const fgColor = parseRgb(style.color);
        const bgInfo = effectiveBgInfo(node, lumCache, mediaRects, nextSurface);
        if (
          !fgColor ||
          fgColor.a < 0.45 ||
          contrastRatioRgb(fgColor, bgInfo.rgb) < 2.8 ||
          (MODE === 'dark' && isDarkColor(fgColor) && bgInfo.lum255 < 105)
        ) {
          if (bgInfo.lum < 0.22) {
            nextFg.set(node, bgInfo.onMedia && MODE === 'light' ? 'const-white' : 'on-surface');
          } else {
            nextFg.set(node, MODE === 'light' ? 'on-surface' : 'inverse');
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
      for (const [el, val] of nextFg) setAttrIfDiff(el, FG, val);
    };

    // Подложки, которые ставятся по светлому цвету сайта (шапка, карточка, строка
    // диалога), сами перекрашивают элемент: при следующем сканировании цвет уже
    // тёмный, подложка снималась, и элемент мигал белым с белым текстом. Поэтому
    // перед сканированием снимаем их под «замером» без переходов, читаем цвет
    // сайта и возвращаем подложку до первой отрисовки.
    const PROBED_SURFACES = ['header', 'page', 'card', 'chat-active', 'chat-hover'];
    const PROBED_SELECTOR = PROBED_SURFACES.map((v) => '[' + SURFACE + '="' + v + '"]').join(', ');

    const beginProbe = (els, fgEls = []) => {
      for (const el of els) {
        el.setAttribute(PROBE, '');
        el.removeAttribute(SURFACE);
      }
      for (const el of fgEls) {
        el.setAttribute(PROBE, '');
        el.removeAttribute(FG);
      }
    };

    const endProbe = (els) => {
      if (!els.length) return;
      // Стиль пересчитывается при чтении: подложка уже вернулась, переходы ещё выключены.
      void getComputedStyle(els[0]).backgroundColor;
      for (const el of els) el.removeAttribute(PROBE);
    };

    const syncSurfaces = (root) => {
      const probed = MODE === 'dark' ? Array.from(root.querySelectorAll(PROBED_SELECTOR)) : [];
      const probedFg = Array.from(root.querySelectorAll('[' + FG + ']'));
      beginProbe(probed, probedFg);
      try {
        syncSurfacesNow(root);
      } finally {
        endProbe(probed.concat(probedFg));
      }
      if (MODE === 'dark' && isMessagesContext()) syncChatHover();
    };

    // Строка списка сообщений: светлая подложка высотой со строку, у которой есть
    // соседи той же высоты. Выбранная строка — капсула, строка под курсором — hover.
    const isListRow = (el, r) => {
      if (r.width < 44 || r.height < 36 || r.height > 150) return false;
      const parent = el.parentElement;
      if (!parent) return false;
      let similar = 0;
      for (const sibling of parent.children) {
        if (sibling === el || sibling.tagName !== el.tagName) continue;
        const sr = sibling.getBoundingClientRect();
        if (Math.abs(sr.height - r.height) <= 12 && Math.abs(sr.width - r.width) <= 24) {
          similar += 1;
          if (similar >= 2) return true;
        }
      }
      return false;
    };

    // Наведение не меняет DOM, поэтому сканирование его не видит: светлый :hover
    // сайта оставался белым, а текст строки уже был светлым. Проверяем только
    // цепочку элементов под курсором.
    let hoverFrame = 0;
    let hoverRetryTimer = null;
    let lastHoverTarget = null;
    const hasLightHoverPaint = (el, r) => {
      if (
        isLightColor(getComputedStyle(el).backgroundColor) ||
        isLightColor(getComputedStyle(el, '::before').backgroundColor) ||
        isLightColor(getComputedStyle(el, '::after').backgroundColor)
      ) {
        return true;
      }
      if (el.childElementCount <= 6) {
        for (const ch of el.children) {
          if (ch.id?.startsWith('octo-') || ch.matches('img, video, canvas, svg, [class*="Avatar" i], [class*="Badge" i]')) {
            continue;
          }
          if (ch.clientWidth >= r.width * 0.65 && ch.clientHeight >= r.height * 0.65) {
            if (
              isLightColor(getComputedStyle(ch).backgroundColor) ||
              isLightColor(getComputedStyle(ch, '::before').backgroundColor) ||
              isLightColor(getComputedStyle(ch, '::after').backgroundColor)
            ) {
              return true;
            }
          }
        }
      }
      return false;
    };

    const syncChatHover = () => {
      hoverFrame = 0;
      if (MODE !== 'dark' || !isMessagesContext()) return;
      for (const el of document.querySelectorAll('[' + SURFACE + '="chat-hover"]')) {
        if (!el.matches(':hover')) el.removeAttribute(SURFACE);
      }
      const chain = Array.from(document.querySelectorAll(':hover')).reverse();
      if (!chain.length) return;
      const candidates = [];
      for (const el of chain) {
        if (el === document.body || el === document.documentElement) break;
        const surf = el.getAttribute(SURFACE);
        if (surf && surf !== 'chat-hover') {
          if (
            surf === 'header' ||
            surf === 'page' ||
            surf === 'card' ||
            surf === 'live-chat' ||
            surf === 'sidenav' ||
            surf === 'chat-active'
          ) {
            break;
          }
        }
        if (!el.id?.startsWith('octo-')) candidates.push(el);
      }
      if (!candidates.length) return;
      const existingHover = candidates.find((el) => el.getAttribute(SURFACE) === 'chat-hover');
      if (existingHover && !existingHover.hasAttribute(PROBE)) {
        return;
      }
      const toProbe = [];
      const hadHover = [];
      for (const el of candidates) {
        if (el.getAttribute(SURFACE) === 'chat-hover') {
          hadHover.push(el);
          el.removeAttribute(SURFACE);
          el.setAttribute(PROBE, '');
          toProbe.push(el);
        }
      }
      let row = null;
      for (const el of candidates) {
        if (el.clientHeight < 36 || el.clientHeight > 150 || el.clientWidth < 44) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 36 || r.height > 150) continue;
        if (hasLightHoverPaint(el, r)) {
          row = el;
        }
      }
      for (const el of document.querySelectorAll('[' + SURFACE + '="chat-hover"]')) {
        if (el !== row) el.removeAttribute(SURFACE);
      }
      if (row) {
        row.setAttribute(SURFACE, 'chat-hover');
      } else {
        for (const el of hadHover) el.removeAttribute(SURFACE);
      }
      if (toProbe.length) endProbe(toProbe);
    };

    const onPointerMove = (event) => {
      if (event?.type === 'pointerover' && event.target instanceof Element) {
        const player = event.target.closest(
          '[class*="DivBasicPlayerWrapper"], [class*="DivVideoWrapper"], [data-e2e="feed-video"]',
        );
        if (player && !player.dataset.octoHoverScanned) {
          player.dataset.octoHoverScanned = '1';
          scheduleScan();
        }
      }
      if (MODE !== 'dark' || !isMessagesContext()) return;
      if (event?.type === 'pointermove' && event.target === lastHoverTarget) return;
      if (event?.target instanceof Element) lastHoverTarget = event.target;
      if (!hoverFrame) hoverFrame = requestAnimationFrame(syncChatHover);
      if (event?.type === 'pointerover') {
        clearTimeout(hoverRetryTimer);
        hoverRetryTimer = setTimeout(() => {
          hoverRetryTimer = null;
          syncChatHover();
        }, 120);
      }
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
        if (MODE === 'dark' && isLightColor(bg)) {
          const isCtrl = el.matches('button, [role="button"]');
          const rect = el.getBoundingClientRect();
          const isMsgCompactBtn =
            !isCtrl &&
            isMessagesContext() &&
            ((el.matches('a') && rect.width <= 120 && rect.height <= 64) ||
              (rect.width >= 24 &&
                rect.width <= 56 &&
                rect.height >= 24 &&
                rect.height <= 56 &&
                Boolean(el.querySelector('svg')) &&
                !el.querySelector('img, video, canvas') &&
                !(el.innerText || '').trim()));
          if (
            (isCtrl || isMsgCompactBtn) &&
            !el.matches(':disabled, [aria-disabled="true"]') &&
            !el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], [' + SURFACE + '="drawer"], [class*="Player"], [class*="DivVideoWrapper"]') &&
            !el.matches('[class*="PlayOverlay"], [class*="VideoMask"], [class*="ClickArea"], [class*="ButtonActionItem"], [data-e2e="search-button"], [data-e2e="comment-post"], [data-e2e="feed-navigation-next"], [data-e2e="feed-navigation-prev"], [data-e2e="arrow-down"], [data-e2e="arrow-up"]')
          ) {
            accentWrites.set.set(el, 'tonal');
          }
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
      if (rect.width > 0 && rect.width <= 48 && rect.height > 0 && rect.height <= 32) {
        accentWrites.set.set(el, 'badge');
      }
    };

    const iconTonePrefix = (bgInfo) => {
      if (bgInfo.lum < 0.22) {
        return bgInfo.onMedia && MODE === 'light' ? 'const-' : '';
      }
      return MODE === 'light' ? '' : 'inverse-';
    };

    const isLowContrastPaint = (value, bgInfo, strictPlayer = false) => {
      const c = parseRgb(value);
      if (!c) return false;
      if (c.a < 0.5) return true;
      if (strictPlayer && c.a < 0.85) return true;
      if (contrastRatioRgb(c, bgInfo.rgb) < 2.8) return true;
      if (strictPlayer) {
        return bgInfo.lum < 0.22 ? luminanceOf(c) < 155 : luminanceOf(c) > 120;
      }
      return false;
    };

    const HDR_ANCESTOR_SELECTOR =
      'header, [role="banner"], [class*="DivHeaderContainer"], [class*="DivHeaderWrapper"], [class*="NavHeader"], [class*="BusinessHeader"], [class*="LayoutHeader"], [class*="TopBar"], [class*="NavBar"], [class*="HeaderBar"], [' +
      SURFACE +
      '="header"]';

    const isTopHeaderSvg = (svg, r = svg.getBoundingClientRect()) =>
      Boolean(svg.closest(HDR_ANCESTOR_SELECTOR)) ||
      (r.top >= -4 &&
        r.top <= 110 &&
        r.bottom <= 145 &&
        r.width <= 240 &&
        r.height <= 64 &&
        !svg.closest('main, [role="main"], [class*="Video"], [class*="Player"], [class*="Card"], [class*="Item"]'));

    const checkSvgContrast = (svg, iconWrites, bgCache, mediaRects, strictPlayer = false) => {
      if (!(svg instanceof Element) || svg.id?.startsWith('octo-')) return;
      const inPlayerCtrl =
        strictPlayer ||
        Boolean(
          svg.closest(
            'button, [role="button"], [' +
              SURFACE +
              '="player-controls"], [class*="DivVideoControlBottom"], [class*="DivPlayerControls"], [class*="DivBottomControls"], [class*="DivMediaControl"], [class*="DivControlBottom"]',
          ),
        );
      if (
        svg.closest(
          '[' +
            ACTION +
            '="active"], [' +
            ACCENT +
            '="switch"], [' +
            ACCENT +
            '="switch-off"], [' +
            ACCENT +
            '="primary"], [' +
            ACCENT +
            '="tonal"], [' +
            ACCENT +
            '="badge"], [role="tooltip"], [data-octo-md3-logo="1"], [data-octo-brand], [class*="Avatar" i], [class*="Emoji" i], [class*="Sticker" i], [class*="Lottie" i], [class*="DivSideNavContainer"], [' +
            SURFACE +
            '="sidenav"]',
        ) ||
        (!inPlayerCtrl && svg.closest('[class*="Animation" i]')) ||
        (svg.closest('[data-e2e="tiktok-logo"]') && !isTopHeaderSvg(svg))
      ) {
        return;
      }
      if (svg.getAttribute(ICON) === 'active' || svg.querySelector('[' + ICON + '="active"]')) return;
      const bgInfo = effectiveBgInfo(svg, bgCache, mediaRects);
      const prefix = iconTonePrefix(bgInfo);
      const st = getComputedStyle(svg);
      const svgBadFill =
        st.fill !== 'none' &&
        !isTikTokRed(st.fill) &&
        !isTikTokYellow(st.fill) &&
        !isTikTokCyan(st.fill) &&
        isLowContrastPaint(st.fill, bgInfo, strictPlayer);
      if (svgBadFill) {
        iconWrites.set(svg, prefix + 'fill');
      } else if (
        !isTikTokRed(st.color) &&
        !isTikTokYellow(st.color) &&
        !isTikTokCyan(st.color) &&
        isLowContrastPaint(st.color, bgInfo, strictPlayer)
      ) {
        iconWrites.set(svg, prefix ? prefix.slice(0, -1) : 'on-surface');
      }
      const checkShape = (p) => {
        if (p.getAttribute(ICON) === 'active') return;
        const ps = getComputedStyle(p);
        const badFill =
          ps.fill !== 'none' &&
          !isTikTokRed(ps.fill) &&
          !isTikTokYellow(ps.fill) &&
          !isTikTokCyan(ps.fill) &&
          isLowContrastPaint(ps.fill, bgInfo, strictPlayer);
        const badStroke =
          ps.stroke !== 'none' &&
          !isTikTokRed(ps.stroke) &&
          !isTikTokYellow(ps.stroke) &&
          !isTikTokCyan(ps.stroke) &&
          isLowContrastPaint(ps.stroke, bgInfo, strictPlayer);
        if (badFill && badStroke) {
          iconWrites.set(p, prefix + 'fill-stroke');
        } else if (badFill) {
          iconWrites.set(p, prefix + 'fill');
        } else if (badStroke) {
          iconWrites.set(p, prefix + 'stroke');
        }
      };
      for (const p of svg.querySelectorAll('g, path, circle, rect, line, polyline, polygon, ellipse, use')) {
        checkShape(p);
        if (p.tagName && p.tagName.toLowerCase() === 'use') {
          const ref = (p.getAttribute('href') || p.getAttribute('xlink:href') || '').trim();
          if (ref.startsWith('#') && ref.length > 1) {
            const rootNode = svg.getRootNode();
            const target =
              (rootNode && typeof rootNode.getElementById === 'function'
                ? rootNode.getElementById(ref.slice(1))
                : null) || document.getElementById(ref.slice(1));
            if (target) {
              if (target.matches('g, path, circle, rect, line, polyline, polygon, ellipse')) {
                checkShape(target);
              }
              for (const tp of target.querySelectorAll('g, path, circle, rect, line, polyline, polygon, ellipse')) {
                checkShape(tp);
              }
            }
          }
        }
      }
    };

    const SEEK_WAVE_ATTR = 'data-octo-md3-seek-wave';
    const SEEK_REL_ATTR = 'data-octo-md3-seek-rel';
    const activeSeekbars = new Set();
    const seekbarState = new WeakMap();
    const SEEK_FRAME_MS = 32;
    let seekSeq = 0;
    let seekRafId = 0;
    let seekLastTime = performance.now();
    let seekLastDrawAt = 0;
    let seekWakeBound = false;
    let seekScrollTimer = null;

    const seekSmoothstep = (edge0, edge1, x) => {
      const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
      return t * t * (3 - 2 * t);
    };

    const pickBestVideo = (videos) => {
      if (!videos || !videos.length) return null;
      if (videos.length === 1) return videos[0];
      const vh = window.innerHeight || 900;
      let visibleFallback = null;
      for (const v of videos) {
        const vr = v.getBoundingClientRect();
        if (vr.width > 80 && vr.height > 80 && vr.bottom > 0 && vr.top < vh) {
          if (!v.paused && !v.ended) return v;
          if (!visibleFallback) visibleFallback = v;
        }
      }
      for (const v of videos) {
        if (!v.paused && !v.ended) return v;
      }
      return visibleFallback || videos[0];
    };

    const findSeekVideo = (sb) => {
      let cur = sb.parentElement;
      for (let depth = 0; depth < 7 && cur && cur !== document.body; depth += 1) {
        const videos = cur.querySelectorAll('video');
        if (videos.length) return pickBestVideo(videos);
        cur = cur.parentElement;
      }
      return pickBestVideo(document.querySelectorAll('video'));
    };

    const readSeekProgress = (sb, cachedVideo) => {
      const sbRect = sb.getBoundingClientRect();
      if (!sbRect.width) return 0;
      const thumb = sb.querySelector('[' + SURFACE + '="player-seekbar-thumb"]');
      const readThumb = () => {
        if (!thumb) return null;
        const tr = thumb.getBoundingClientRect();
        if (tr.width > 0 && tr.width <= 28) {
          const cx = tr.left + tr.width / 2;
          return Math.min(1, Math.max(0, (cx - sbRect.left) / sbRect.width));
        }
        return null;
      };
      const vmax = Number(sb.getAttribute('aria-valuemax'));
      const vnow = Number(sb.getAttribute('aria-valuenow'));
      if (sb.matches(':active')) {
        const tp = readThumb();
        if (tp !== null) return tp;
        if (vmax > 0 && Number.isFinite(vnow)) return Math.min(1, Math.max(0, vnow / vmax));
      }
      const video = cachedVideo && cachedVideo.isConnected ? cachedVideo : findSeekVideo(sb);
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        return Math.min(1, Math.max(0, video.currentTime / video.duration));
      }
      if (vmax > 0 && Number.isFinite(vnow)) return Math.min(1, Math.max(0, vnow / vmax));
      const tp = readThumb();
      if (tp !== null) return tp;
      const fill = sb.querySelector('[' + ACCENT + '="progress"]');
      if (fill) {
        const fr = fill.getBoundingClientRect();
        if (fr.left < sbRect.left - 1) {
          return Math.min(1, Math.max(0, (fr.right - sbRect.left) / sbRect.width));
        }
        if (fr.width >= 0 && fr.width < sbRect.width - 1) {
          return Math.min(1, Math.max(0, fr.width / sbRect.width));
        }
      }
      return 0;
    };

    const drawSeekbar = (sb, dt, reduced, themeColors, vh) => {
      const meta = seekbarState.get(sb);
      if (!meta || !meta.canvas.isConnected) return { keep: false, animating: false };
      const rect = sb.getBoundingClientRect();
      if (rect.width < 40 || rect.bottom < -20 || rect.top > vh + 20) {
        return { keep: true, animating: false };
      }

      if (meta.drawnOnce && typeof sb.checkVisibility === 'function') {
        if (!sb.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
          return { keep: true, animating: false };
        }
      }

      if (!meta.video || !meta.video.isConnected || meta.video.paused) {
        meta.video = findSeekVideo(sb);
      }
      const video = meta.video;
      const isPlaying = Boolean(video && !video.paused && !video.ended);
      const hovered =
        sb.matches(':hover') ||
        sb.matches(':active') ||
        Boolean(sb.closest('[' + SURFACE + '="player-controls-wrap"]:hover'));
      const progress = readSeekProgress(sb, video);
      const width = Math.round(rect.width);
      const { primary, onSurface } = themeColors;

      const sameColors = meta.lastPrimary === primary && meta.lastOnSurface === onSurface;
      const sameProgress = Math.abs(progress - meta.lastProgress) < 0.0004;
      const sameStatic =
        meta.drawnOnce &&
        !meta.dirty &&
        !isPlaying &&
        hovered === meta.lastHovered &&
        width === meta.lastWidth &&
        sameProgress &&
        sameColors;
      if (sameStatic) {
        return { keep: true, animating: false };
      }

      const height = 20;
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (meta.canvas.width !== targetW || meta.canvas.height !== targetH) {
        meta.canvas.width = targetW;
        meta.canvas.height = targetH;
      }
      const ctx = meta.canvas.getContext('2d');
      if (!ctx) return { keep: false, animating: false };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const wavelength = 26;
      if (!reduced && isPlaying) {
        meta.phase = (meta.phase + dt * 32) % wavelength;
      }

      const strokeW = hovered ? 5.0 : 4.4;
      const pad = 5;
      const usable = Math.max(0, width - pad * 2);
      const handleX = pad + usable * progress;
      const midY = height / 2;
      const gap = hovered ? 7.5 : 6.5;
      const amp = reduced
        ? 0
        : (hovered ? 3.5 : 3.0) *
          seekSmoothstep(0.003, 0.025, progress) *
          seekSmoothstep(0.997, 0.975, progress);

      // Неактивная дорожка справа с точкой-ограничителем на конце
      const trackStart = progress > 0.004 ? handleX + gap : pad;
      if (width - pad > trackStart + 1) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = onSurface;
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(trackStart, midY);
        ctx.lineTo(width - pad, midY);
        ctx.stroke();
        ctx.restore();

        if (progress < 0.985) {
          ctx.fillStyle = primary;
          ctx.beginPath();
          ctx.arc(width - pad, midY, Math.max(1.8, strokeW * 0.45), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Активный волновой сегмент
      const activeEnd = Math.max(pad, handleX - gap);
      if (progress > 0.004 && activeEnd > pad + 0.5) {
        ctx.strokeStyle = primary;
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (amp <= 0.08) {
          ctx.moveTo(pad, midY);
          ctx.lineTo(activeEnd, midY);
        } else {
          const twoPiOverL = (Math.PI * 2) / wavelength;
          const yAt = (x) => midY + amp * Math.sin((x - meta.phase) * twoPiOverL);
          ctx.moveTo(pad, yAt(pad));
          for (let x = pad + 1.5; x < activeEnd; x += 1.5) {
            ctx.lineTo(x, yAt(x));
          }
          ctx.lineTo(activeEnd, yAt(activeEnd));
        }
        ctx.stroke();
      }

      // Вертикальная пилюля-бегунок в текущей точке воспроизведения
      const handleW = hovered ? 4.8 : 4.0;
      const handleH = hovered ? 18 : 14;
      const hx = Math.max(pad, Math.min(width - pad, handleX));
      ctx.fillStyle = primary;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(hx - handleW / 2, midY - handleH / 2, handleW, handleH, handleW / 2);
      } else {
        ctx.rect(hx - handleW / 2, midY - handleH / 2, handleW, handleH);
      }
      ctx.fill();

      meta.drawnOnce = true;
      meta.dirty = false;
      meta.lastWidth = width;
      meta.lastProgress = progress;
      meta.lastHovered = hovered;
      meta.lastPrimary = primary;
      meta.lastOnSurface = onSurface;

      return { keep: true, animating: isPlaying && !reduced };
    };

    const tickSeekbars = (now) => {
      seekRafId = 0;
      if (document.visibilityState === 'hidden' || !activeSeekbars.size) return;
      let anyDirty = false;
      for (const sb of activeSeekbars) {
        if (seekbarState.get(sb)?.dirty) {
          anyDirty = true;
          break;
        }
      }
      if (!anyDirty && now - seekLastDrawAt < SEEK_FRAME_MS) {
        seekRafId = requestAnimationFrame(tickSeekbars);
        return;
      }
      seekLastDrawAt = now;
      const dt = Math.min(0.1, Math.max(0, (now - seekLastTime) / 1000));
      seekLastTime = now;
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const vh = window.innerHeight || 900;
      const rootStyle = getComputedStyle(document.documentElement);
      const themeColors = {
        primary: rootStyle.getPropertyValue('--octo-md-primary').trim() || '#9ac1fc',
        onSurface: rootStyle.getPropertyValue('--octo-md-on-surface').trim() || '#f2ecf8',
      };

      let anyAnimating = false;
      for (const sb of Array.from(activeSeekbars)) {
        if (!sb.isConnected || sb.getAttribute(SURFACE) !== 'player-seekbar') {
          activeSeekbars.delete(sb);
          continue;
        }
        const res = drawSeekbar(sb, dt, reduced, themeColors, vh);
        if (!res.keep) {
          activeSeekbars.delete(sb);
        } else if (res.animating) {
          anyAnimating = true;
        }
      }
      if (anyAnimating && activeSeekbars.size > 0) {
        seekRafId = requestAnimationFrame(tickSeekbars);
      }
    };

    const scheduleSeekLoop = (markDirty = false) => {
      if (markDirty) {
        for (const sb of activeSeekbars) {
          const meta = seekbarState.get(sb);
          if (meta) meta.dirty = true;
        }
      }
      if (seekRafId || !activeSeekbars.size || document.visibilityState === 'hidden') return;
      seekLastTime = performance.now();
      seekRafId = requestAnimationFrame(tickSeekbars);
    };

    const onSeekVideoEvent = () => {
      if (activeSeekbars.size) scheduleSeekLoop(true);
    };

    const onSeekPointerEvent = (event) => {
      if (!activeSeekbars.size) return;
      const t = event?.target;
      if (
        t instanceof Element &&
        t.closest('[' + SURFACE + '="player-seekbar"], [' + SURFACE + '="player-controls-wrap"]')
      ) {
        scheduleSeekLoop(true);
      }
    };

    const onSeekScrollOrResize = () => {
      if (!activeSeekbars.size) return;
      clearTimeout(seekScrollTimer);
      seekScrollTimer = setTimeout(() => {
        seekScrollTimer = null;
        scheduleSeekLoop(true);
      }, 90);
    };

    const bindSeekWakeEvents = () => {
      if (seekWakeBound) return;
      seekWakeBound = true;
      document.addEventListener('play', onSeekVideoEvent, true);
      document.addEventListener('playing', onSeekVideoEvent, true);
      document.addEventListener('pause', onSeekVideoEvent, true);
      document.addEventListener('ended', onSeekVideoEvent, true);
      document.addEventListener('seeked', onSeekVideoEvent, true);
      document.addEventListener('timeupdate', onSeekVideoEvent, true);
      document.addEventListener('pointerover', onSeekPointerEvent, true);
      document.addEventListener('pointerout', onSeekPointerEvent, true);
      window.addEventListener('scroll', onSeekScrollOrResize, { passive: true, capture: true });
      window.addEventListener('resize', onSeekScrollOrResize, { passive: true });
    };

    const unbindSeekWakeEvents = () => {
      if (!seekWakeBound) return;
      seekWakeBound = false;
      clearTimeout(seekScrollTimer);
      seekScrollTimer = null;
      document.removeEventListener('play', onSeekVideoEvent, true);
      document.removeEventListener('playing', onSeekVideoEvent, true);
      document.removeEventListener('pause', onSeekVideoEvent, true);
      document.removeEventListener('ended', onSeekVideoEvent, true);
      document.removeEventListener('seeked', onSeekVideoEvent, true);
      document.removeEventListener('timeupdate', onSeekVideoEvent, true);
      document.removeEventListener('pointerover', onSeekPointerEvent, true);
      document.removeEventListener('pointerout', onSeekPointerEvent, true);
      window.removeEventListener('scroll', onSeekScrollOrResize, { capture: true });
      window.removeEventListener('resize', onSeekScrollOrResize);
    };

    const ensureSeekbarWave = (sb) => {
      bindSeekWakeEvents();
      let meta = seekbarState.get(sb);
      if (!meta || !meta.canvas.isConnected) {
        let canvas = sb.querySelector(':scope > canvas.octo-md3-seek-canvas');
        if (!canvas) {
          seekSeq += 1;
          canvas = document.createElement('canvas');
          canvas.id = 'octo-md3-seek-' + seekSeq;
          canvas.className = 'octo-md3-seek-canvas';
          canvas.setAttribute('aria-hidden', 'true');
          sb.appendChild(canvas);
        }
        meta = {
          canvas,
          phase: 0,
          video: null,
          drawnOnce: false,
          dirty: true,
          lastWidth: -1,
          lastProgress: -1,
          lastHovered: false,
          lastPrimary: '',
          lastOnSurface: '',
        };
        seekbarState.set(sb, meta);
      } else {
        meta.dirty = true;
      }
      if (getComputedStyle(sb).position === 'static') {
        setAttrIfDiff(sb, SEEK_REL_ATTR, '1');
      } else {
        delAttrIfSet(sb, SEEK_REL_ATTR);
      }
      setAttrIfDiff(sb, SEEK_WAVE_ATTR, '1');
      activeSeekbars.add(sb);
      scheduleSeekLoop();
    };

    const stopSeekbars = () => {
      if (seekRafId) {
        cancelAnimationFrame(seekRafId);
        seekRafId = 0;
      }
      unbindSeekWakeEvents();
      activeSeekbars.clear();
      document.querySelectorAll('canvas.octo-md3-seek-canvas').forEach((el) => el.remove());
      document.querySelectorAll('[' + SEEK_WAVE_ATTR + ']').forEach((el) => el.removeAttribute(SEEK_WAVE_ATTR));
      document.querySelectorAll('[' + SEEK_REL_ATTR + ']').forEach((el) => el.removeAttribute(SEEK_REL_ATTR));
    };

    const syncPlayerControls = (root, bgCache, mediaRects) => {
      const nextPlayerSurfaces = new Map();
      const nextNavBtns = new Map();
      const nextProgress = new Set();
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
        const innerHost =
          video.closest('[class*="DivBasicPlayerWrapper"], [class*="DivVideoWrapper"]') ||
          video.parentElement;
        if (innerHost) playerScopes.add(innerHost);
        const outerHost = video.closest(
          '[class*="DivItemContainerV2"], [class*="DivRecommendList"], [class*="DivBrowserModeContainer"], [class*="DivVideoDetailContainer"], [data-e2e="feed-video"]',
        );
        if (outerHost) playerScopes.add(outerHost);
      }

      const globalBars = new Set();
      for (const bar of root.querySelectorAll(
        '[class*="DivVideoControlBottom"], [class*="DivPlayerControls"], [class*="DivBottomControls"], [class*="DivMediaControl"], [class*="DivControlBottom"]',
      )) {
        if (bar.id?.startsWith('octo-') || bar.querySelector('video')) continue;
        const br = bar.getBoundingClientRect();
        if (br.width >= 120 && br.height >= 16 && br.height <= 140) {
          markPlayerSurface(bar, 'player-controls');
          globalBars.add(bar);
        }
      }

      for (const scope of playerScopes) {
        const sr = scope.getBoundingClientRect();
        const localBars = new Set();
        for (const bar of globalBars) {
          if (scope.contains(bar)) localBars.add(bar);
        }

        // Структурный поиск нижней панели по таймкоду / автопрокрутке / скорости / звуку
        if (localBars.size === 0) {
          for (const leaf of scope.querySelectorAll(
            'time, span, div, [class*="AutoScroll"], [class*="PlaybackRate"], [data-e2e*="video-play"]',
          )) {
            if (leaf.id?.startsWith('octo-')) continue;
            const isTime =
              leaf.children.length === 0 &&
              /^\\s*\\d{1,2}:\\d{2}\\s*\\/\\s*\\d{1,2}:\\d{2}\\s*$/.test(leaf.textContent || '');
            const isKnownCtrl =
              !isTime &&
              leaf.matches('[class*="AutoScroll"], [class*="PlaybackRate"], [data-e2e*="video-play"]');
            if (!isTime && !isKnownCtrl) continue;
            let inMarkedBar = false;
            for (const b of localBars) {
              if (b.contains(leaf)) {
                inMarkedBar = true;
                break;
              }
            }
            if (inMarkedBar) continue;
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
              globalBars.add(picked);
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
        }

        // Прогресс-бар (seekbar) и ползунок внутри плеера (внутри scope и вне его)
      }

      const SEEKBAR_CHILD_NOISE =
        '[class*="Track" i], [class*="Background" i], [class*="Played" i], [class*="Fill" i], [class*="Buffer" i], [class*="Thumb" i], [class*="Circle" i], [class*="Dot" i]';
      for (const sb of root.querySelectorAll(
        '[class*="SeekBar"], [class*="ProgressBar"], [class*="DivSlider"], [role="slider"]',
      )) {
        if (
          sb.id?.startsWith('octo-') ||
          sb.querySelector('video') ||
          sb.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="drawer"], [role="dialog"], nav')
        ) {
          continue;
        }
        if (
          sb.matches(SEEKBAR_CHILD_NOISE) ||
          (sb.matches('[class*="Progress" i]') && !sb.matches('[class*="ProgressBar" i]'))
        ) {
          continue;
        }
        let parentHasSeek = false;
        for (const [el, val] of nextPlayerSurfaces) {
          if (val === 'player-seekbar' && el !== sb && el.contains(sb)) {
            parentHasSeek = true;
            break;
          }
        }
        if (parentHasSeek) continue;
        const r = sb.getBoundingClientRect();
        if (r.width < 80 || r.height < 1 || r.height > 48) continue;
        markPlayerSurface(sb, 'player-seekbar');
        if (
          sb.parentElement &&
          !sb.parentElement.querySelector('video, [data-e2e*="author"], [data-e2e*="desc"]')
        ) {
          if (
            sb.parentElement.getAttribute(SURFACE) === 'player-controls-wrap' ||
            parseFloat(getComputedStyle(sb.parentElement).opacity) < 0.85
          ) {
            markPlayerSurface(sb.parentElement, 'player-controls-wrap');
          }
        }
        for (const child of sb.querySelectorAll('div, span')) {
          if (child.classList?.contains('octo-md3-seek-canvas')) continue;
          const cr = child.getBoundingClientRect();
          const isThumb =
            child.matches('[class*="Circle"], [class*="Dot"], [class*="Thumb"]') ||
            (cr.width >= 6 &&
              cr.width <= 20 &&
              cr.height >= 6 &&
              cr.height <= 20 &&
              Math.abs(cr.width - cr.height) <= 3);
          if (isThumb) {
            markPlayerSurface(child, 'player-seekbar-thumb');
            continue;
          }
          const inlineStyle = child.getAttribute('style') || '';
          const isFill =
            child.matches('[class*="Progress"], [class*="Played"], [class*="Fill"]') ||
            (cr.height >= 1 &&
              cr.height <= 10 &&
              /(?:width\\s*:\\s*[\\d.]+%|scaleX\\(|translateX\\()/i.test(inlineStyle));
          if (isFill) {
            nextProgress.add(child);
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
      for (const [el, val] of nextPlayerSurfaces) {
        if (val === 'player-seekbar') ensureSeekbarWave(el);
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

      const strictSvgs = new Set();
      for (const bar of globalBars) {
        for (const svg of bar.querySelectorAll('svg')) strictSvgs.add(svg);
      }
      for (const bar of root.querySelectorAll(
        '[class*="DivVideoControlBottom"], [class*="DivPlayerControls"], [class*="DivBottomControls"], [class*="DivMediaControl"], [class*="DivControlBottom"]',
      )) {
        if (bar.id?.startsWith('octo-') || bar.querySelector('video')) continue;
        for (const svg of bar.querySelectorAll('svg')) strictSvgs.add(svg);
      }
      for (const [el, val] of nextPlayerSurfaces) {
        if (val === 'player-more' || val === 'player-controls') {
          for (const svg of el.querySelectorAll('svg')) strictSvgs.add(svg);
        }
      }
      return strictSvgs;
    };

    const REACTION_CONTROL_SELECTOR = [
      '[data-e2e*="like-icon"]',
      '[data-e2e*="favorite-icon"]',
      '[data-e2e="undefined-icon"]',
      '[data-e2e*="collect-icon"]',
      '[data-e2e*="bookmark-icon"]',
      '[data-e2e*="repost-icon"]',
      '[data-e2e="comment-like-icon"]',
      '[class*="ButtonActionItem"]',
      '[class*="DivActionItemContainer"] button:not([data-e2e*="more"]):not([data-e2e*="follow"])',
      '[class*="ActionBar"] button:not([data-e2e*="more"]):not([data-e2e*="follow"])',
      '[class*="DivComment"] [data-e2e*="like"]',
      '[class*="DivComment"] [class*="Like" i]',
    ].join(', ');

    const REACTION_INCLUDE_E2E =
      '[data-e2e*="like"], [data-e2e*="favorite"], [data-e2e="undefined-icon"], [data-e2e*="collect"], [data-e2e*="bookmark"], [data-e2e*="repost"]';
    const REACTION_EXCLUDE_E2E =
      '[data-e2e*="comment-icon"], [data-e2e*="share-icon"], [data-e2e*="more"], [data-e2e*="follow"], [data-e2e*="arrow"], [data-e2e*="feed-navigation"]';

    const syncActionIcons = (root, strictSvgs = null, bgCache = new WeakMap(), mediaRects = null) => {
      const rootStyle = getComputedStyle(document.documentElement);
      const primaryRgb = parseCssColor(rootStyle.getPropertyValue('--octo-md-primary'));
      const onSurfaceRgb = parseCssColor(rootStyle.getPropertyValue('--octo-md-on-surface'));
      const onSurfaceVarRgb = parseCssColor(rootStyle.getPropertyValue('--octo-md-on-surface-variant'));
      const primaryChroma =
        primaryRgb && Math.max(primaryRgb.r, primaryRgb.g, primaryRgb.b) - Math.min(primaryRgb.r, primaryRgb.g, primaryRgb.b) >= 20;
      const canMatchPrimary = Boolean(
        primaryRgb &&
          primaryChroma &&
          colorDist(primaryRgb, { r: 255, g: 255, b: 255 }) > 45 &&
          colorDist(primaryRgb, { r: 22, g: 24, b: 35 }) > 45 &&
          (!onSurfaceRgb || colorDist(primaryRgb, onSurfaceRgb) > 36) &&
          (!onSurfaceVarRgb || colorDist(primaryRgb, onSurfaceVarRgb) > 24),
      );
      const isPrimaryPaint = (value) => {
        if (!canMatchPrimary) return false;
        const c = parseRgb(value);
        return Boolean(c && c.a >= 0.45 && colorDist(c, primaryRgb) <= 10);
      };
      const isActivePaint = (value) => isTikTokRed(value) || isTikTokYellow(value) || isPrimaryPaint(value);
      const isActiveAttr = (el) => isTikTokRedAttr(el) || isTikTokYellowAttr(el);

      const controls = new Set();
      for (const el of root.querySelectorAll(REACTION_CONTROL_SELECTOR)) {
        if (el.id?.startsWith('octo-') || el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"]')) {
          continue;
        }
        const ctrl = el.closest('button, [role="button"]') || el;
        if (
          ctrl.id?.startsWith('octo-') ||
          ctrl.matches('[' + SURFACE + '="player-more"]') ||
          ctrl.closest('[' + SURFACE + '="player-more"]')
        ) {
          continue;
        }
        if (
          ctrl.matches(REACTION_EXCLUDE_E2E) ||
          (ctrl.querySelector(REACTION_EXCLUDE_E2E) && !ctrl.querySelector(REACTION_INCLUDE_E2E))
        ) {
          continue;
        }
        controls.add(ctrl);
      }

      const entries = [];
      const toProbe = [];
      for (const ctrl of controls) {
        const svgs = ctrl.matches('svg') ? [ctrl] : Array.from(ctrl.querySelectorAll('svg'));
        const shapes = [];
        for (const svg of svgs) {
          for (const s of svg.querySelectorAll('path, circle, rect, line, polyline, polygon, ellipse')) {
            shapes.push(s);
          }
        }
        let circleEl = null;
        const midNodes = [];
        for (const svg of svgs) {
          let cur = svg.parentElement;
          while (cur && cur !== ctrl && cur !== document.body) {
            if (!midNodes.includes(cur)) midNodes.push(cur);
            if (!circleEl && !cur.querySelector('strong, [data-e2e*="count"]')) {
              const r = cur.getBoundingClientRect();
              if (r.width >= 26 && r.width <= 72 && r.height >= 26 && r.height <= 72 && Math.abs(r.width - r.height) <= 12) {
                circleEl = cur;
              }
            }
            cur = cur.parentElement;
          }
        }
        const pressedHost =
          ctrl.getAttribute('aria-pressed') === 'true' ||
          ctrl.getAttribute('aria-checked') === 'true' ||
          ctrl.getAttribute('data-active') === 'true' ||
          Boolean(ctrl.querySelector('[aria-pressed="true"], [aria-checked="true"], [data-active="true"]'));
        const nodes = [ctrl, ...midNodes, ...svgs, ...shapes];
        const attrActive = pressedHost || nodes.some(isActiveAttr);
        entries.push({ ctrl, circleEl, svgs, shapes, nodes, attrActive });
        if (!attrActive || circleEl) {
          for (const node of nodes) toProbe.push(node);
        }
      }

      const probeReset = [];
      for (const node of toProbe) {
        const prevIcon = node.getAttribute(ICON);
        const prevAction = node.getAttribute(ACTION);
        if (prevIcon !== null || prevAction !== null) {
          probeReset.push({ node, prevIcon, prevAction });
          if (prevIcon !== null) node.removeAttribute(ICON);
          if (prevAction !== null) node.removeAttribute(ACTION);
        }
        node.setAttribute(PROBE, '');
      }

      const nextActiveCircles = new Set();
      const nextActiveIcons = new Set();
      try {
        for (const entry of entries) {
          let active = entry.attrActive;
          if (!active) {
            for (const node of entry.nodes) {
              const st = getComputedStyle(node);
              if (isActivePaint(st.color) || isActivePaint(st.fill) || isActivePaint(st.stroke)) {
                active = true;
                break;
              }
            }
          }
          if (!active) continue;
          let hasCircleBg = false;
          if (entry.circleEl) {
            const cs = getComputedStyle(entry.circleEl);
            const bg = parseRgb(cs.backgroundColor);
            const radius = parseFloat(cs.borderTopLeftRadius) || 0;
            hasCircleBg = Boolean(bg && bg.a >= 0.03 && radius >= 12);
          }
          if (hasCircleBg) {
            nextActiveCircles.add(entry.circleEl);
          } else if (entry.svgs.length > 0) {
            for (const svg of entry.svgs) nextActiveIcons.add(svg);
            for (const s of entry.shapes) nextActiveIcons.add(s);
          } else {
            nextActiveIcons.add(entry.ctrl);
          }
        }
      } finally {
        for (const item of probeReset) {
          if (item.prevIcon !== null) item.node.setAttribute(ICON, item.prevIcon);
          if (item.prevAction !== null) item.node.setAttribute(ACTION, item.prevAction);
        }
        endProbe(toProbe);
      }

      root.querySelectorAll('[' + ACTION + '="active"]').forEach((el) => {
        if (!nextActiveCircles.has(el)) delAttrIfSet(el, ACTION);
      });
      for (const el of nextActiveCircles) setAttrIfDiff(el, ACTION, 'active');

      root.querySelectorAll('[' + ICON + '="active"]').forEach((el) => {
        if (!el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"]') && !nextActiveIcons.has(el)) {
          delAttrIfSet(el, ICON);
        }
      });
      for (const el of nextActiveIcons) setAttrIfDiff(el, ICON, 'active');

      const probedIcons = Array.from(root.querySelectorAll('[' + ICON + ']')).filter(
        (el) =>
          el.getAttribute(ICON) !== 'active' &&
          !el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"]'),
      );
      for (const el of probedIcons) {
        el.setAttribute(PROBE, '');
        el.removeAttribute(ICON);
      }
      const nextContrastIcons = new Map();
      try {
        if (strictSvgs) {
          for (const svg of strictSvgs) {
            if (!svg.isConnected || svg.id?.startsWith('octo-')) continue;
            if (svg.closest('defs, symbol')) continue;
            checkSvgContrast(svg, nextContrastIcons, bgCache, mediaRects, true);
          }
        }
        const SVG_QUICK_SKIP =
          '[role="tooltip"], [data-octo-md3-logo="1"], [data-octo-brand], [class*="Avatar" i], [class*="Emoji" i], [class*="Sticker" i], [class*="Lottie" i], [class*="DivSideNavContainer"], [' +
          SURFACE +
          '="sidenav"]';
        for (const svg of root.querySelectorAll('svg')) {
          if (svg.id?.startsWith('octo-') || (strictSvgs && strictSvgs.has(svg))) continue;
          if (svg.closest(SVG_QUICK_SKIP)) continue;
          const r = svg.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const inHdr = isTopHeaderSvg(svg, r);
          if (inHdr ? (r.width > 240 || r.height > 64) : (r.width > 72 || r.height > 72)) {
            continue;
          }
          checkSvgContrast(svg, nextContrastIcons, bgCache, mediaRects, false);
        }
        for (const el of probedIcons) {
          if (!nextContrastIcons.has(el)) delAttrIfSet(el, ICON);
        }
        for (const [el, val] of nextContrastIcons) {
          if (el.getAttribute(ICON) !== 'active') setAttrIfDiff(el, ICON, val);
        }
      } finally {
        endProbe(probedIcons);
      }
    };

    const knownShadowHosts = new Set();
    let shadowScanAt = 0;
    let shadowDirty = true;

    const collectShadowSubtree = (root, out = []) => {
      if (!root || !root.querySelectorAll) return out;
      if (root instanceof Element && root.shadowRoot) {
        knownShadowHosts.add(root);
        out.push(root.shadowRoot);
        collectShadowSubtree(root.shadowRoot, out);
      }
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          knownShadowHosts.add(el);
          out.push(el.shadowRoot);
          collectShadowSubtree(el.shadowRoot, out);
        }
      }
      return out;
    };

    const collectShadowRoots = (root, out = []) => {
      if (!root || !root.querySelectorAll) return out;
      if (root === document) {
        const now = Date.now();
        if (shadowDirty || now - shadowScanAt >= 5000) {
          shadowDirty = false;
          shadowScanAt = now;
          knownShadowHosts.clear();
          return collectShadowSubtree(document, out);
        }
        for (const host of Array.from(knownShadowHosts)) {
          if (!host.isConnected || !host.shadowRoot) {
            knownShadowHosts.delete(host);
            continue;
          }
          out.push(host.shadowRoot);
          collectShadowSubtree(host.shadowRoot, out);
        }
        return out;
      }
      return collectShadowSubtree(root, out);
    };

    const observedShadows = new WeakSet();
    let observerOpts = null;

    const CLASSIFY_SELECTOR =
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
      '="live-chat"] [class*="Heart" i]';

    const scanFragment = (frag) => {
      if (!frag || !frag.isConnected || !frag.querySelectorAll) return;
      const bgCache = new WeakMap();
      const mediaRects = collectMediaRects(frag);
      for (const node of frag.querySelectorAll(
        'span, p, div, a, strong, em, b, i, small, label, time, button, h1, h2, h3, h4, h5, h6, li',
      )) {
        if (node.id?.startsWith('octo-')) continue;
        let hasDirectText = false;
        for (const child of node.childNodes) {
          if (child.nodeType === 3 && child.textContent.trim()) {
            hasDirectText = true;
            break;
          }
        }
        if (!hasDirectText) continue;
        if (
          node.closest(
            'button:disabled, [role="button"][aria-disabled="true"], [' +
              ACCENT +
              '="primary"], [' +
              ACCENT +
              '="tonal"], [' +
              ACCENT +
              '="badge"], [' +
              ACCENT +
              '="primary-text"], [' +
              ACCENT +
              '="switch"], [' +
              ACCENT +
              '="switch-off"], [data-e2e="inbox-badge"], [role="tooltip"], [class*="Avatar" i], [class*="Emoji" i], [class*="Sticker" i]',
          )
        ) {
          continue;
        }
        const style = getComputedStyle(node);
        const fgColor = parseRgb(style.color);
        const bgInfo = effectiveBgInfo(node, bgCache, mediaRects, null);
        if (
          !fgColor ||
          fgColor.a < 0.45 ||
          contrastRatioRgb(fgColor, bgInfo.rgb) < 2.8 ||
          (MODE === 'dark' && isDarkColor(fgColor) && bgInfo.lum255 < 105)
        ) {
          setAttrIfDiff(
            node,
            FG,
            bgInfo.lum < 0.22
              ? bgInfo.onMedia && MODE === 'light'
                ? 'const-white'
                : 'on-surface'
              : MODE === 'light'
                ? 'on-surface'
                : 'inverse',
          );
        }
      }
      syncActionIcons(frag, null, bgCache, mediaRects);
      const accentWrites = { set: new Map(), del: new Set() };
      for (const el of frag.querySelectorAll(CLASSIFY_SELECTOR)) classify(el, accentWrites);
      for (const el of accentWrites.del) delAttrIfSet(el, ACCENT);
      for (const [el, val] of accentWrites.set) setAttrIfDiff(el, ACCENT, val);
    };

    const scan = (root = document) => {
      if (!root || !root.querySelectorAll) return;

      // Красные текстовые ссылки в модалках (например «Отправить код заново») перекрашиваем в primary
      const dialogs = Array.from(root.querySelectorAll('[role="dialog"], [aria-modal="true"]'));
      if (dialogs.length) {
        const dialogProbes = [];
        for (const dialog of dialogs) {
          if (dialog.id?.startsWith('octo-')) continue;
          dialog.setAttribute(PROBE, '');
          dialogProbes.push(dialog);
        }
        try {
          for (const dialog of dialogProbes) {
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
                setAttrIfDiff(node, ACCENT, 'primary-text');
              }
            }
          }
        } finally {
          endProbe(dialogProbes);
        }
      }

      if (root === document) syncMessagesLayout();
      const shadowRoots = root === document ? collectShadowRoots(document) : [];
      if (state.domObserver && observerOpts) {
        for (const sr of shadowRoots) {
          if (!observedShadows.has(sr)) {
            observedShadows.add(sr);
            state.domObserver.observe(sr, observerOpts);
          }
        }
      }
      const allRoots = root === document ? [document, ...shadowRoots] : [root];
      const bgCache = new WeakMap();
      const mediaRects = collectMediaRects(root);
      for (const scopeRoot of allRoots) {
        syncSurfaces(scopeRoot);
      }
      if (root === document) syncSidebarNav();
      for (const scopeRoot of allRoots) {
        syncButtonGroups(scopeRoot);
        const strictSvgs = syncPlayerControls(scopeRoot, bgCache, mediaRects);
        syncActionIcons(scopeRoot, strictSvgs, bgCache, mediaRects);
      }
      const candidates = root.querySelectorAll(CLASSIFY_SELECTOR);
      const accentWrites = { set: new Map(), del: new Set() };
      for (const el of candidates) classify(el, accentWrites);
      if (isMessagesContext()) {
        const hdrProbes = Array.from(root.querySelectorAll(HDR_ANCESTOR_SELECTOR)).filter(
          (h) => !h.id?.startsWith('octo-'),
        );
        const hdrCand = [];
        const listScope =
          root.querySelector('[' + CHAT_LAYOUT + '="sidebar"], [' + CHAT_LAYOUT + '="list"]') || root;
        for (const h of hdrProbes) {
          for (const el of h.querySelectorAll('span, div, b, strong, a')) {
            if (el.children.length > 2 || el.id?.startsWith('octo-') || el.hasAttribute(ACCENT)) continue;
            const tc = (el.textContent || '').trim();
            if ((tc.length > 0 && tc.length <= 6) || el.querySelector('svg')) hdrCand.push(el);
          }
        }
        if (hdrCand.length) {
          for (const h of hdrProbes) h.setAttribute(PROBE, '');
          for (const el of hdrCand) el.setAttribute(PROBE, '');
          try {
            for (const el of hdrCand) classify(el, accentWrites);
          } finally {
            endProbe(hdrProbes.concat(hdrCand));
          }
        }
        for (const el of listScope.querySelectorAll('span, div, b, strong')) {
          if (
            el.children.length > 0 ||
            el.id?.startsWith('octo-') ||
            el.hasAttribute(ACCENT) ||
            el.matches('[class*="Emoji" i], [class*="Sticker" i], [class*="Avatar" i]')
          ) {
            continue;
          }
          const tc = (el.textContent || '').trim();
          if (tc.length >= 1 && tc.length <= 4) classify(el, accentWrites);
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
      if (root) {
        if (AMOLED) setAttrIfDiff(root, AMOLED_ATTR, 'true');
        else delAttrIfSet(root, AMOLED_ATTR);
      }
      lastScanAt = Date.now();
      scan(document);
    };

    if (window.__octoMd3) {
      window.__octoMd3.mode = MODE;
      window.__octoMd3.amoled = AMOLED;
      apply();
      return 0;
    }

    let timer = null;
    let lastScanAt = 0;
    let dirtyWhileHidden = false;
    let scrolling = false;
    let scrollScanTimer = null;
    let fullScanPending = true;
    const pendingFragments = new Set();
    const runScan = () => {
      if (document.visibilityState === 'hidden') {
        dirtyWhileHidden = true;
        return;
      }
      if (scrolling) {
        scheduleScan();
        return;
      }
      dirtyWhileHidden = false;
      lastScanAt = Date.now();
      if (fullScanPending || pendingFragments.size === 0 || pendingFragments.size > 8) {
        fullScanPending = false;
        pendingFragments.clear();
        scan(document);
        return;
      }
      const list = Array.from(pendingFragments);
      pendingFragments.clear();
      for (const frag of list) {
        scanFragment(frag);
      }
    };
    const scheduleScan = (forceImmediate = false) => {
      if (forceImmediate) {
        shadowDirty = true;
        fullScanPending = true;
        pendingFragments.clear();
        clearTimeout(timer);
        timer = null;
        runScan();
        return;
      }
      if (timer) return;
      const elapsed = Date.now() - lastScanAt;
      const delay = elapsed < 800 ? Math.max(220, 800 - elapsed) : 220;
      timer = setTimeout(() => {
        timer = null;
        runScan();
      }, delay);
    };

    const onScroll = () => {
      scrolling = true;
      clearTimeout(scrollScanTimer);
      scrollScanTimer = setTimeout(() => {
        scrolling = false;
      }, 180);
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') {
        if (dirtyWhileHidden) scheduleScan();
        scheduleSeekLoop(true);
      }
    };
    const onPopState = () => scheduleScan(true);
    const RIPPLE = '${RIPPLE_ATTR}';
    const motionReduce =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    const RIPPLE_TARGET_SELECTOR =
      'button, [role="button"], [role="tab"], [' +
      SURFACE +
      '="sidenav"] a, [' +
      SURFACE +
      '="drawer"] a, [' +
      SURFACE +
      '="chip"], [' +
      SURFACE +
      '="chip-active"]';

    const onPointerDown = (event) => {
      if (event.button !== 0 || motionReduce?.matches) return;
      if (document.documentElement?.hasAttribute('${RAINBOW_ATTR}')) return;
      const raw = event.target;
      if (!(raw instanceof Element)) return;
      if (raw.closest('#octo-badge-modal, .octo-user-badge, video, input, textarea, select, [contenteditable]')) {
        return;
      }
      const target = raw.closest(RIPPLE_TARGET_SELECTOR);
      if (!target || target.id?.startsWith('octo-') || target.disabled) return;
      if (target.getAttribute('aria-disabled') === 'true') return;
      if (target.matches('[data-e2e="tiktok-logo"], [data-octo-md3-logo="1"]')) return;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.width > 480 || rect.height > 160) return;
      const pos = getComputedStyle(target).position;
      const attrVal = pos === 'static' ? 'rel' : '1';
      const rx = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const ry = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const diameter = Math.ceil(Math.hypot(rect.width, rect.height) * 2);
      target.style.setProperty('--octo-rx', rx.toFixed(1) + 'px');
      target.style.setProperty('--octo-ry', ry.toFixed(1) + 'px');
      target.style.setProperty('--octo-rd', diameter + 'px');
      target.removeAttribute(RIPPLE);
      void target.offsetWidth;
      target.setAttribute(RIPPLE, attrVal);
      clearTimeout(target._octoSiteRippleTimer);
      target._octoSiteRippleTimer = setTimeout(() => {
        target.removeAttribute(RIPPLE);
      }, 460);
    };

    const state = {
      mode: MODE,
      amoled: AMOLED,
      attrObserver: null,
      domObserver: null,
      stop() {
        if (timer) clearTimeout(timer);
        if (scrollScanTimer) clearTimeout(scrollScanTimer);
        window.removeEventListener('popstate', onPopState);
        window.removeEventListener('scroll', onScroll, { capture: true });
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('pointerover', onPointerMove, true);
        document.removeEventListener('pointermove', onPointerMove, true);
        document.removeEventListener('pointerout', onPointerMove, true);
        document.removeEventListener('pointerdown', onPointerDown, true);
        if (hoverFrame) cancelAnimationFrame(hoverFrame);
        if (hoverRetryTimer) clearTimeout(hoverRetryTimer);
        if (layoutFallbackTimer) clearTimeout(layoutFallbackTimer);
        stopSeekbars();
        if (railObserver) railObserver.disconnect();
        if (state.attrObserver) state.attrObserver.disconnect();
        if (state.domObserver) state.domObserver.disconnect();
        if (document.documentElement) {
          document.documentElement.removeAttribute(ATTR);
          document.documentElement.removeAttribute(AMOLED_ATTR);
        }
        for (const scopeRoot of [document, ...collectShadowRoots(document)]) {
          scopeRoot.querySelectorAll('[' + ACCENT + ']').forEach((el) => el.removeAttribute(ACCENT));
          scopeRoot.querySelectorAll('[' + NAV + ']').forEach((el) => el.removeAttribute(NAV));
          scopeRoot.querySelectorAll('[' + POS + ']').forEach((el) => el.removeAttribute(POS));
          scopeRoot.querySelectorAll('[' + BTN_GROUP + ']').forEach((el) => el.removeAttribute(BTN_GROUP));
          scopeRoot.querySelectorAll('[' + ICON + ']').forEach((el) => el.removeAttribute(ICON));
          scopeRoot.querySelectorAll('[' + ACTION + ']').forEach((el) => el.removeAttribute(ACTION));
          scopeRoot.querySelectorAll('[' + SURFACE + ']').forEach((el) => el.removeAttribute(SURFACE));
          scopeRoot.querySelectorAll('[' + PROBE + ']').forEach((el) => el.removeAttribute(PROBE));
          scopeRoot.querySelectorAll('[' + FG + ']').forEach((el) => el.removeAttribute(FG));
          scopeRoot.querySelectorAll('[' + RIPPLE + ']').forEach((el) => el.removeAttribute(RIPPLE));
        }
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
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerover', onPointerMove, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerout', onPointerMove, true);
    document.addEventListener('pointerdown', onPointerDown, true);

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

      const ACTION_TARGET_SELECTOR =
        '[class*="ButtonActionItem"], [class*="ButtonActionItem"] *, [class*="DivActionItemContainer"] *, [class*="ActionBar"] *, [data-e2e*="like"], [data-e2e*="like"] *, [data-e2e*="favorite"], [data-e2e*="favorite"] *, [data-e2e="undefined-icon"], [data-e2e="undefined-icon"] *, [data-e2e*="collect"], [data-e2e*="collect"] *, [data-e2e*="bookmark"], [data-e2e*="bookmark"] *, [data-e2e*="repost"], [data-e2e*="repost"] *, [class*="DivComment"] [class*="Like" i], [class*="DivComment"] [class*="Like" i] *';

      const PLAYER_MUTATION_SCOPE =
        '[' +
        SURFACE +
        '="player-controls"], [class*="DivVideoControlBottom"], [class*="DivPlayerControls"], [class*="DivBottomControls"], [class*="DivMediaControl"], [class*="DivControlBottom"]';
      const SEEKBAR_SCOPE =
        '[class*="SeekBar"], [class*="ProgressBar"], [role="slider"], [' + SURFACE + '="player-seekbar"]';

      const SCOPED_CONTENT_CONTAINER =
        '[' + SURFACE + '="live-chat"], [' + SURFACE + '="comments"], [class*="DivCommentList"]';
      const SCOPED_INPUT_GUARD =
        '[' + SURFACE + '="live-chat-input"], [' + SURFACE + '="comment-input"], [contenteditable], textarea, input';

      state.domObserver = new MutationObserver((mutations) => {
        let shouldSchedule = false;
        for (const mutation of mutations) {
          const t = mutation.target;
          if (t instanceof Element) {
            if (t.id?.startsWith('octo-') || t.closest('#octo-badge-modal, .octo-user-badge')) continue;
            if (mutation.type === 'attributes') {
              if (mutation.attributeName === 'fill' || mutation.attributeName === 'stroke') {
                if (
                  !t.matches(ACTION_TARGET_SELECTOR) &&
                  !t.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="sidenav"], ' + PLAYER_MUTATION_SCOPE)
                ) {
                  continue;
                }
                fullScanPending = true;
                shouldSchedule = true;
                continue;
              }
              if (mutation.attributeName === 'style') {
                if (t.closest(SEEKBAR_SCOPE)) continue;
                if (!t.matches(ACTION_TARGET_SELECTOR) && !t.closest(PLAYER_MUTATION_SCOPE)) continue;
              } else if (mutation.attributeName === 'class') {
                if (
                  !t.matches(CLASS_TARGET_SELECTOR) &&
                  !t.matches(ACTION_TARGET_SELECTOR) &&
                  !t.closest(PLAYER_MUTATION_SCOPE) &&
                  !t.closest('[class*="DivVideoInfo"], [class*="DivDescription"], [data-e2e="video-desc"]')
                ) {
                  continue;
                }
              }
              fullScanPending = true;
              shouldSchedule = true;
              continue;
            }
          }
          if (mutation.addedNodes.length > 0) {
            const hostEl = t instanceof Element ? t : null;
            const inTimerOrSeek = Boolean(hostEl && hostEl.closest(SEEKBAR_SCOPE + ', time'));
            const scopedHost =
              hostEl &&
              !hostEl.closest(SCOPED_INPUT_GUARD) &&
              hostEl.closest(SCOPED_CONTENT_CONTAINER);
            for (const n of mutation.addedNodes) {
              if (n.nodeType === 1 && !n.id?.startsWith('octo-') && !n.classList?.contains('octo-user-badge')) {
                if (n.shadowRoot || (n.tagName && n.tagName.includes('-')) || n.childElementCount > 0) {
                  shadowDirty = true;
                }
                if (scopedHost && !n.matches('[role="dialog"], [aria-modal="true"]')) {
                  pendingFragments.add(n);
                } else {
                  fullScanPending = true;
                }
                shouldSchedule = true;
                if (fullScanPending) break;
              } else if (
                n.nodeType === 3 &&
                !inTimerOrSeek &&
                n.textContent &&
                n.textContent.trim() &&
                !/^\\d{1,2}:\\d{2}/.test(n.textContent.trim())
              ) {
                if (scopedHost && hostEl) {
                  pendingFragments.add(hostEl);
                } else {
                  fullScanPending = true;
                }
                shouldSchedule = true;
                if (fullScanPending) break;
              }
            }
          }
          if (fullScanPending) break;
        }
        if (shouldSchedule) scheduleScan();
      });
      observerOpts = {
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
          'style',
          'fill',
          'stroke',
        ],
      };
      state.domObserver.observe(root, observerOpts);
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
    document.documentElement.removeAttribute('${AMOLED_ATTR}');
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
  document
    .querySelectorAll('[${PROBE_ATTR}]')
    .forEach((el) => el.removeAttribute('${PROBE_ATTR}'));
  document
    .querySelectorAll('[${RIPPLE_ATTR}]')
    .forEach((el) => el.removeAttribute('${RIPPLE_ATTR}'));
  document.querySelectorAll('canvas.octo-md3-seek-canvas').forEach((el) => el.remove());
  document
    .querySelectorAll('[data-octo-md3-seek-wave]')
    .forEach((el) => el.removeAttribute('data-octo-md3-seek-wave'));
  document
    .querySelectorAll('[data-octo-md3-seek-rel]')
    .forEach((el) => el.removeAttribute('data-octo-md3-seek-rel'));
})()`;

module.exports = {
  MD3_ATTR,
  AMOLED_ATTR,
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
