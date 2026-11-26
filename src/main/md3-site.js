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
const FEED_LAYOUT_ATTR = 'data-octo-feed-layout';
const FEED_STAGE_ATTR = 'data-octo-feed-stage';
const FEED_CARD_ATTR = 'data-octo-feed-card';
const FEED_ACTIONS_ATTR = 'data-octo-feed-actions';
const FEED_ASPECT_ATTR = 'data-octo-feed-aspect';

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

const COMPONENT_CSS = `
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
    background-color: var(--octo-md-surface) !important;
    color: var(--octo-md-on-surface) !important;
  }

  body,
  #app,
  #root {
    background-image:
      ${EXPRESSIVE_BG},
      radial-gradient(640px 440px at 26% 14%, color-mix(in srgb, var(--octo-md-primary) 12%, transparent), transparent 70%),
      radial-gradient(580px 420px at 76% 84%, color-mix(in srgb, var(--octo-md-primary-container) 34%, transparent), transparent 72%) !important;
    background-repeat: no-repeat, no-repeat, no-repeat !important;
    background-size: cover, auto, auto !important;
    background-position: center, center, center !important;
    background-attachment: fixed, fixed, fixed !important;
  }

  [${MD3_ATTR}="light"] :is(body, #app, #root) {
    background-image:
      ${EXPRESSIVE_BG},
      radial-gradient(640px 440px at 26% 14%, color-mix(in srgb, var(--octo-md-primary) 14%, transparent), transparent 70%),
      radial-gradient(580px 420px at 76% 84%, color-mix(in srgb, var(--octo-md-primary-container) 55%, transparent), transparent 72%) !important;
  }

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
  [class*="DivSideNavContainer"] {
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
  [class*="DivSideNavContainer"] [class*="Container"]:not([class*="Login"]):not([data-e2e="search-box"]):not([${SURFACE_ATTR}="drawer"]):not([${SURFACE_ATTR}="drawer"] *) {
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

  [${SURFACE_ATTR}="drawer"] :is(div, section, header, ul, li, a, button, [role="button"], [role="menuitem"]):not([role="switch"]):not([${ACCENT_ATTR}="badge"]):not([class*="Badge"]):not([aria-pressed="true"]):not([aria-selected="true"]):not([data-active="true"]):not([class*="Active"]):not([id^="octo-"]) {
    background-color: transparent !important;
    background-image: none !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  [${SURFACE_ATTR}="drawer"] :has(> button + button):not(:has(a)):not(:has(h1, h2, h3, h4, p)) {
    display: inline-flex !important;
    flex: none !important;
    gap: 3px !important;
    padding: 3px !important;
    border-radius: 9999px !important;
    background-color: var(--octo-md-surface-container-high) !important;
    overflow: hidden !important;
  }

  [${SURFACE_ATTR}="drawer"] :has(> button + button):not(:has(a)):not(:has(h1, h2, h3, h4, p)) > button {
    border-radius: 6px !important;
    margin: 0 !important;
    min-width: 28px !important;
  }

  [${SURFACE_ATTR}="drawer"] :has(> button + button):not(:has(a)):not(:has(h1, h2, h3, h4, p)) > button:first-child {
    border-radius: 9999px 6px 6px 9999px !important;
  }

  [${SURFACE_ATTR}="drawer"] :has(> button + button):not(:has(a)):not(:has(h1, h2, h3, h4, p)) > button:last-child {
    border-radius: 6px 9999px 9999px 6px !important;
  }

  [${SURFACE_ATTR}="drawer"] :has(> button + button):not(:has(a)):not(:has(h1, h2, h3, h4, p)) > button:is([aria-pressed="true"], [aria-selected="true"], [data-active="true"], [class*="Active"]) {
    background-color: var(--octo-md-secondary-container) !important;
    color: var(--octo-md-on-secondary-container) !important;
    border-radius: 9999px !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not(:has(button)):not(:has(a)):not(:has(> button + button) *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]) {
    border-radius: 6px !important;
    margin-bottom: 4px !important;
    transition:
      background-color 0.16s var(--octo-md-ease),
      border-radius 0.2s var(--octo-md-ease) !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not(:has(button)):not(:has(a)):not(:has(> button + button) *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]):first-child {
    border-top-left-radius: 14px !important;
    border-top-right-radius: 14px !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not(:has(button)):not(:has(a)):not(:has(> button + button) *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]):last-child {
    border-bottom-left-radius: 14px !important;
    border-bottom-right-radius: 14px !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not(:has(button)):not(:has(a)):not(:has(> button + button) *):not([${SURFACE_ATTR}="chip"]):not([${SURFACE_ATTR}="chip-active"]):not([role="tab"]):not([id^="octo-"]):hover {
    background-color: var(--octo-md-state-hover) !important;
  }

  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not(:has(> button + button) *) :is(div, span, p, a, button):not([${ACCENT_ATTR}="badge"]):not([class*="Badge"]),
  [${SURFACE_ATTR}="drawer"] :is(a, button, [role="button"], [role="menuitem"]):not(:has(> button + button) *):hover :is(div, span, p, a, button):not([${ACCENT_ATTR}="badge"]):not([class*="Badge"]) {
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
  }

  [${SURFACE_ATTR}="drawer"] :is([${SURFACE_ATTR}="chip"], [${SURFACE_ATTR}="chip-active"]) {
    display: inline-flex !important;
    align-items: center !important;
    border-radius: 9999px !important;
    margin: 2px 4px 2px 0 !important;
    padding: 5px 12px !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"]):where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([data-e2e="search-button"]):not([class*="Search"]):not([class*="Account"]):not([class*="User"]):not([class*="Coin"]):not([class*="Recharge"]):not([class*="Promote"]):not([${SURFACE_ATTR}="drawer"] *):not([id^="octo-"])):not(:is(a, button, [role="button"]) *) {
    display: flex !important;
    align-items: center !important;
    min-height: 36px !important;
    padding-top: 5px !important;
    padding-bottom: 5px !important;
    margin-top: 0 !important;
    margin-bottom: 4px !important;
  }

  [class*="DivSideNavContainer"] li,
  [class*="DivSideNavContainer"] ul {
    border: 0 !important;
    box-shadow: none !important;
    background-color: transparent !important;
  }

  [class*="DivSideNavContainer"] a:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([class*="Search"]):not([id^="octo-"])),
  [class*="DivSideNavContainer"] button:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([data-e2e="search-button"]):not([class*="Search"]):not([id^="octo-"])),
  [class*="DivSideNavContainer"] [role="button"]:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([data-e2e="search-button"]):not([class*="Search"]):not([id^="octo-"])) {
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
      background-color 0.16s var(--octo-md-ease),
      border-radius 0.22s var(--octo-md-ease),
      color 0.16s var(--octo-md-ease) !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"])[${POS_ATTR}="first"] {
    border-radius: 14px 14px 6px 6px !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"])[${POS_ATTR}="mid"] {
    border-radius: 6px !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"])[${POS_ATTR}="last"] {
    border-radius: 6px 6px 14px 14px !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"])[${POS_ATTR}="single"] {
    border-radius: 14px !important;
  }

  [class*="DivSideNavContainer"] a:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([class*="Search"]):not([id^="octo-"])):hover,
  [class*="DivSideNavContainer"] button:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([data-e2e="search-button"]):not([class*="Search"]):not([id^="octo-"])):hover,
  [class*="DivSideNavContainer"] [role="button"]:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([data-e2e="search-button"]):not([class*="Search"]):not([id^="octo-"])):hover {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
  }

  [class*="DivSideNavContainer"][data-octo-md3-rail="collapsed"] a:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([class*="Search"]):not([id^="octo-"])),
  [class*="DivSideNavContainer"][data-octo-md3-rail="collapsed"] button:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([data-e2e="search-button"]):not([class*="Search"]):not([id^="octo-"])),
  [class*="DivSideNavContainer"][data-octo-md3-rail="collapsed"] [role="button"]:where(:not([data-e2e="tiktok-logo"]):not(:has([data-e2e="tiktok-logo"])):not([data-e2e="search-button"]):not([class*="Search"]):not([id^="octo-"])) {
    width: 44px !important;
    min-width: 44px !important;
    height: 44px !important;
    min-height: 44px !important;
    margin: 0 auto 4px !important;
    padding: 0 !important;
    justify-content: center !important;
    border-radius: 14px !important;
  }

  [class*="DivSideNavContainer"][data-octo-md3-rail="collapsed"] button[class*="Search"] {
    width: 44px !important;
    height: 44px !important;
    margin: 0 auto 8px !important;
    padding: 0 !important;
    justify-content: center !important;
    border-radius: 9999px !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"])[${NAV_ATTR}="active"]:not([data-e2e="tiktok-logo"]):not([class*="Account"]):not([id^="octo-"]),
  [class*="DivSideNavContainer"] [data-e2e^="nav-"][${NAV_ATTR}="active"] {
    border-radius: 9999px !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"]):is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ):not([data-e2e="tiktok-logo"]):not([class*="Account"]):not([id^="octo-"]),
  [class*="DivSideNavContainer"] [data-e2e^="nav-"]:is(
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

  [class*="DivSideNavContainer"] :is(a, button, [role="button"]):is(
    [${NAV_ATTR}="active"],
    [aria-current="page"],
    [aria-selected="true"],
    [data-active="true"],
    [class*="-Active"],
    [class*="--active"],
    [class*="IsActive"],
    [class*="is-active"]
  ):not([data-e2e="tiktok-logo"]):not([class*="Account"]):not([id^="octo-"]):hover,
  [class*="DivSideNavContainer"] [data-e2e^="nav-"]:is(
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
  [class*="DivSideNavContainer"] :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"]) :is(div, span, p, a, button, [role="button"], [role="menuitem"], [data-e2e^="nav-"]):not([class*="Badge"]):not([class*="Sup"]):not([${ACCENT_ATTR}="badge"]):not([class*="Avatar"]):not([role="img"]),
  [class*="DivSideNavContainer"] :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"]) :is(div, span, p, a, button, [role="button"], [role="menuitem"], [data-e2e^="nav-"]):not([class*="Badge"]):not([class*="Sup"]):not([${ACCENT_ATTR}="badge"]):not([class*="Avatar"]):not([role="img"]):hover,
  [class*="DivSideNavContainer"] :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"])::before,
  [class*="DivSideNavContainer"] :is(a, button, [role="button"], [data-e2e^="nav-"]):not([data-e2e="tiktok-logo"]):not([class*="Search"])::after {
    background-color: transparent !important;
    background-image: none !important;
    border: 0 !important;
    outline: none !important;
    box-shadow: none !important;
  }

  /* Нижние служебные кнопки сайдбара («Приобрести монеты») не обрезаются */
  [class*="DivSideNavContainer"] :is([class*="Coin" i], [class*="Recharge" i], [class*="Promote" i]),
  [class*="DivSideNavContainer"] [class*="Footer"] :is(a, button, [role="button"]) {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 40px !important;
    box-sizing: border-box !important;
    padding: 8px 12px !important;
    border-radius: 14px !important;
    justify-content: flex-start !important;
  }

  [class*="DivSideNavContainer"] :is([class*="Coin" i], [class*="Recharge" i], [class*="Promote" i]) :where(span, p, div),
  [class*="DivSideNavContainer"] [class*="Footer"] :is(a, button, [role="button"]) :where(span, p, div) {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    max-width: none !important;
    width: auto !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  [class*="DivSideNavContainer"] :is(a, button, [role="button"]):is(
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
  [class*="DivSideNavContainer"] [${ICON_ATTR}="active"],
  [class*="DivSideNavContainer"] :where(a, button):not([data-e2e="tiktok-logo"]) svg[${ICON_ATTR}="active"],
  [class*="DivSideNavContainer"] :where(a, button):not([data-e2e="tiktok-logo"]) svg path:is(
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

  [class*="DivSideNavContainer"] :is(
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

  [class*="DivSideNavContainer"] :is(
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

  [class*="DivSideNavContainer"] :is(
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
  [class*="DivSideNavContainer"] [class*="DivAccountItem"] {
    border-radius: 5px !important;
    margin-bottom: 2px !important;
    background-color: var(--octo-md-surface-container) !important;
    box-shadow: none !important;
    transition:
      background-color 0.16s var(--octo-md-ease),
      border-radius 0.2s var(--octo-md-ease) !important;
  }

  [class*="DivSideNavContainer"] :is([class*="DivUserContainer"], [class*="DivAccountItem"]):first-of-type {
    border-top-left-radius: 12px !important;
    border-top-right-radius: 12px !important;
  }

  [class*="DivSideNavContainer"] :is([class*="DivUserContainer"], [class*="DivAccountItem"]):last-of-type {
    border-bottom-left-radius: 12px !important;
    border-bottom-right-radius: 12px !important;
  }

  [class*="DivSideNavContainer"] [class*="DivUserContainer"]:hover,
  [class*="DivSideNavContainer"] [class*="DivAccountItem"]:hover {
    background-color: var(--octo-md-surface-container-high) !important;
    border-radius: 9px !important;
  }

  [class*="DivSideNavContainer"] [class*="DivLoginContainer"] {
    border-radius: 14px !important;
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
    [${SURFACE_ATTR}="header"]
  ) :where(a, span, p, div, h1, h2, h3, h4, label, button, svg):not([class*="Badge" i]):not([${ACCENT_ATTR}="badge"]):not([data-e2e="inbox-badge"]):not([class*="TUXButton--primary"]):not([class*="TUXButton--primary"] *):not([${ACCENT_ATTR}="primary"]):not([${ACCENT_ATTR}="primary"] *):not([${ACCENT_ATTR}="tonal"]):not([${ACCENT_ATTR}="tonal"] *):not([role="tooltip"]):not([role="tooltip"] *) {
    color: var(--octo-md-on-surface) !important;
  }

  [data-e2e="search-box"],
  form[action*="/search"],
  [class*="DivSearchBar"],
  [class*="DivSearchFormContainer"] form,
  [class*="DivSideNavContainer"] button[class*="Search"] {
    background-color: var(--octo-md-surface-container-high) !important;
    border: 0 !important;
    border-color: transparent !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 45%, transparent) !important;
    overflow: hidden !important;
    transition:
      background-color 0.16s var(--octo-md-ease),
      box-shadow 0.16s var(--octo-md-ease) !important;
  }

  :is([data-e2e="search-box"], form[action*="/search"], [class*="DivSearchBar"], [class*="DivSearchFormContainer"]) :where(div, span, label, input):not([data-e2e="search-button"]):not([data-e2e="search-button"] *) {
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
    border-radius: 9999px !important;
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
    background-color: color-mix(in srgb, var(--octo-md-surface-container-low) 88%, transparent) !important;
    background-image: none !important;
    backdrop-filter: blur(12px) !important;
    border-radius: 18px !important;
    border-bottom: 0 !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 42%, transparent) !important;
  }

  [${SURFACE_ATTR}="tab-bar"] > :where(div, section):not([class*="BottomLine"]):not([class*="Indicator"]):not([class*="TabLine"]):not(:has(> button + button)):not([role="tablist"] *) {
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
    border-radius: 5px !important;
    color: var(--octo-md-on-surface-variant) !important;
    transition:
      background-color 0.16s var(--octo-md-ease),
      border-radius 0.2s var(--octo-md-ease),
      color 0.16s var(--octo-md-ease) !important;
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
    border-radius: 9999px !important;
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
    border-radius: 9999px !important;
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
    border-radius: 9999px !important;
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
      background-color 0.16s var(--octo-md-ease),
      border-radius 0.22s var(--octo-md-ease),
      color 0.16s var(--octo-md-ease),
      box-shadow 0.16s var(--octo-md-ease),
      filter 0.16s var(--octo-md-ease) !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-first"] {
    border-radius: 14px 5px 5px 14px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-mid"] {
    border-radius: 5px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-last"] {
    border-radius: 5px 14px 14px 5px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-first"] {
    border-radius: 14px 14px 5px 5px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-mid"] {
    border-radius: 5px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-last"] {
    border-radius: 5px 5px 14px 14px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-first"]:hover {
    border-radius: 14px 9px 9px 14px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-mid"]:hover,
  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-mid"]:hover {
    border-radius: 9px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="h-last"]:hover {
    border-radius: 9px 14px 14px 9px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-first"]:hover {
    border-radius: 14px 14px 9px 9px !important;
  }

  :is(button, a[role="button"], [class*="TUXButton"])[${BTN_GROUP_ATTR}="v-last"]:hover {
    border-radius: 9px 9px 14px 14px !important;
  }

  [class*="TUXButton--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="Button--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="PrimaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="StyledPrimary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [data-e2e="top-login-button"],
  [data-e2e="post-btn"],
  [data-e2e="publish-btn"],
  button[data-e2e*="follow"]:not([data-e2e^="nav-"]):not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="Secondary"]):not([class*="Outline"]):not([class*="DivSideNavContainer"] *),
  [class*="FollowButton"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *),
  [class*="StyledFollow"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *),
  [${ACCENT_ATTR}="primary"]:not([class*="DivSideNavContainer"] *),
  button[type="submit"]:not([data-e2e="search-button"]):not([data-e2e="comment-post"]):not([class*="TUXButton--secondary"]):not([class*="TUXButton--outline"]):not([class*="Secondary"]):not([class*="Outline"]):not(:disabled):not([aria-disabled="true"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *) {
    background-color: var(--octo-md-primary) !important;
    color: var(--octo-md-on-primary) !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }

  :is(
    [class*="TUXButton--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="Button--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="PrimaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="StyledPrimary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [data-e2e="top-login-button"],
    [data-e2e="post-btn"],
    [data-e2e="publish-btn"],
    button[data-e2e*="follow"]:not([data-e2e^="nav-"]):not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="Secondary"]):not([class*="Outline"]):not([class*="DivSideNavContainer"] *),
    [class*="FollowButton"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *),
    [class*="StyledFollow"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *),
    [${ACCENT_ATTR}="primary"]:not([class*="DivSideNavContainer"] *),
    button[type="submit"]:not([data-e2e="search-button"]):not([data-e2e="comment-post"]):not([class*="TUXButton--secondary"]):not([class*="TUXButton--outline"]):not([class*="Secondary"]):not([class*="Outline"]):not(:disabled):not([aria-disabled="true"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *)
  ) :where(span, div, p, strong, svg) {
    color: var(--octo-md-on-primary) !important;
  }

  [class*="TUXButton--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="Button--primary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="PrimaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [data-e2e="top-login-button"]:hover,
  button[data-e2e*="follow"]:not([data-e2e^="nav-"]):not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="Secondary"]):not([class*="Outline"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="FollowButton"]:not([aria-pressed="true"]):not([class*="Following"]):not([class*="Followed"]):not([class*="DivSideNavContainer"] *):hover,
  [${ACCENT_ATTR}="primary"]:not([class*="DivSideNavContainer"] *):hover,
  button[type="submit"]:not([data-e2e="search-button"]):not([data-e2e="comment-post"]):not([class*="TUXButton--secondary"]):not([class*="TUXButton--outline"]):not([class*="Secondary"]):not([class*="Outline"]):not(:disabled):not([aria-disabled="true"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover {
    filter: brightness(1.06) !important;
    box-shadow: var(--octo-md-elevation-1) !important;
  }

  [class*="TUXButton--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="TUXButton--outline"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="Button--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="SecondaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="OutlinedButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="semi-button"]:not([class*="semi-button-primary"]):not([class*="semi-button-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [class*="arco-btn"]:not([class*="arco-btn-primary"]):not([class*="arco-btn-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
  [${ACCENT_ATTR}="tonal"]:not([class*="DivSideNavContainer"] *),
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
    [class*="TUXButton--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="TUXButton--outline"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="Button--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="SecondaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="OutlinedButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="semi-button"]:not([class*="semi-button-primary"]):not([class*="semi-button-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [class*="arco-btn"]:not([class*="arco-btn-primary"]):not([class*="arco-btn-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *),
    [${ACCENT_ATTR}="tonal"]:not([class*="DivSideNavContainer"] *),
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

  [class*="TUXButton--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="TUXButton--outline"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="Button--secondary"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="SecondaryButton"]:not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="semi-button"]:not([class*="semi-button-primary"]):not([class*="semi-button-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [class*="arco-btn"]:not([class*="arco-btn-primary"]):not([class*="arco-btn-danger"]):not([id^="octo-"]):not([class*="DivSideNavContainer"] *):hover,
  [${ACCENT_ATTR}="tonal"]:not([class*="DivSideNavContainer"] *):hover,
  [data-e2e="edit-profile-button"]:hover,
  [data-e2e="message-button"]:hover,
  [data-e2e*="follow"][aria-pressed="true"]:hover,
  [data-e2e*="follow"][class*="Following"]:hover {
    background-color: color-mix(in srgb, var(--octo-md-secondary-container) 86%, var(--octo-md-on-surface)) !important;
  }

  /* Правая панель действий у видео: без лишних кружков, счётчик чёткий */
  [class*="ButtonActionItem"],
  [class*="DivActionItemContainer"] button,
  [class*="ActionBar"] button:has([data-e2e]) {
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

  /* Стрелки навигации вверх/вниз в ленте (MD3 tonal FABs) */
  [data-e2e="feed-navigation-next"],
  [data-e2e="feed-navigation-prev"],
  [data-e2e="arrow-down"],
  [data-e2e="arrow-up"],
  [class*="DivFeedNavigation"] button {
    background-color: var(--octo-md-surface-container-high) !important;
    color: var(--octo-md-on-surface) !important;
    border-color: transparent !important;
    box-shadow:
      var(--octo-md-elevation-1),
      inset 0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 48%, transparent) !important;
  }

  [data-e2e="feed-navigation-next"]:hover,
  [data-e2e="feed-navigation-prev"]:hover,
  [data-e2e="arrow-down"]:hover,
  [data-e2e="arrow-up"]:hover,
  [class*="DivFeedNavigation"] button:hover {
    background-color: var(--octo-md-surface-container-highest) !important;
  }

  /* --- Плеер, прогресс-бар и нижняя панель управления ---------------------- */
  [class*="DivSeekBar"] [class*="Progress"],
  [class*="DivProgressBar"] [class*="Progress"],
  [class*="SeekBar"] [class*="Played"],
  [class*="SeekBar"] [class*="Fill"],
  [${ACCENT_ATTR}="progress"] {
    background-color: var(--octo-md-primary) !important;
  }

  [class*="DivSeekBar"] [class*="Circle"],
  [class*="DivSeekBar"] [class*="Dot"],
  [class*="SeekBar"] [class*="Thumb"] {
    background-color: var(--octo-md-primary) !important;
  }

  [class*="DivVideoControlBottom"],
  [class*="DivPlayerControls"],
  [class*="DivBottomControls"] {
    background-color: color-mix(in srgb, var(--octo-md-surface-container-low) 76%, transparent) !important;
    backdrop-filter: blur(12px) !important;
    border-top: 1px solid color-mix(in srgb, var(--octo-md-outline-variant) 32%, transparent) !important;
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
    box-shadow:
      0 20px 52px rgba(8, 6, 16, 0.62),
      0 0 0 1px color-mix(in srgb, var(--octo-md-outline-variant) 50%, transparent) !important;
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
    border-radius: 5px !important;
    transition:
      background-color 0.14s var(--octo-md-ease),
      border-radius 0.2s var(--octo-md-ease) !important;
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
    border-radius: 5px !important;
    margin-bottom: 2px !important;
    transition:
      background-color 0.15s var(--octo-md-ease),
      border-radius 0.2s var(--octo-md-ease) !important;
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

  [role="menuitem"],
  [role="option"],
  [class*="DivMenuItem"],
  [class*="TUXMenu-item"] {
    border-radius: 5px !important;
    transition:
      background-color 0.14s var(--octo-md-ease),
      border-radius 0.18s var(--octo-md-ease) !important;
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
      background-color 0.16s var(--octo-md-ease),
      box-shadow 0.16s var(--octo-md-ease) !important;
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
      background-color 0.16s var(--octo-md-ease),
      color 0.16s var(--octo-md-ease) !important;
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
  }

  [role="switch"][aria-checked="true"],
  [class*="TUXSwitch"][aria-checked="true"],
  [class*="TUXSwitch"][data-checked="true"],
  [${ACCENT_ATTR}="switch"] {
    background-color: var(--octo-md-primary) !important;
    box-shadow: none !important;
  }

  [role="switch"][aria-checked="true"] > *,
  [${ACCENT_ATTR}="switch"] > * {
    background-color: var(--octo-md-on-primary) !important;
  }

  [${ACCENT_ATTR}="switch-off"] {
    background-color: var(--octo-md-surface-container-highest) !important;
    box-shadow: inset 0 0 0 1.5px var(--octo-md-outline) !important;
  }

  [${ACCENT_ATTR}="switch-off"] > * {
    background-color: var(--octo-md-outline) !important;
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

function feedLayoutCss() {
  return `
    /* Режим 1: По центру (как Shorts) — родная компактная раскладка (карта + колонка справа) */
    html[${FEED_LAYOUT_ATTR}="centered"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="centered"] {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 14px !important;
      width: 100% !important;
      max-width: 100% !important;
      margin-inline: auto !important;
    }

    html[${FEED_LAYOUT_ATTR}="centered"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="centered"] [${FEED_CARD_ATTR}="1"]:not(:fullscreen) {
      flex: 0 1 auto !important;
      width: min(var(--octo-feed-card-w, 520px), calc(100% - 92px)) !important;
      max-width: min(var(--octo-feed-card-w, 520px), calc(100% - 92px)) !important;
      margin: 0 !important;
      position: relative !important;
    }

    html[${FEED_LAYOUT_ATTR}="centered"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="centered"] [${FEED_ACTIONS_ATTR}="1"] {
      position: static !important;
      inset: auto !important;
      top: auto !important;
      right: auto !important;
      bottom: auto !important;
      left: auto !important;
      transform: none !important;
      align-self: flex-end !important;
      margin: 0 0 12px 0 !important;
      flex: 0 0 auto !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      z-index: 6 !important;
    }

    /* Режим 1: По центру — когда TikTok открылся в широком/театральном плеере */
    html[${FEED_LAYOUT_ATTR}="centered"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="wide"] {
      width: 100% !important;
      max-width: var(--octo-feed-stage-w, 600px) !important;
      align-self: center !important;
      margin-inline: auto !important;
      padding-inline-end: 78px !important;
      box-sizing: border-box !important;
      position: relative !important;
    }

    html[${FEED_LAYOUT_ATTR}="centered"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="wide"] [${FEED_CARD_ATTR}="1"]:not(:fullscreen) {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      border-radius: 16px !important;
      overflow: hidden !important;
    }

    html[${FEED_LAYOUT_ATTR}="centered"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="wide"] [${FEED_ACTIONS_ATTR}="1"] {
      position: absolute !important;
      right: 6px !important;
      bottom: 74px !important;
      left: auto !important;
      top: auto !important;
      transform: none !important;
      margin: 0 !important;
      z-index: 12 !important;
    }

    html[${FEED_LAYOUT_ATTR}="centered"] [${FEED_CARD_ATTR}="1"] video {
      max-width: 100% !important;
      max-height: 100% !important;
      object-fit: contain !important;
    }

    /* Режим 2: Широкий плеер — родная театральная раскладка остаётся нетронутой,
       а компактная карта расширяется на всю сцену с действиями справа снизу */
    html[${FEED_LAYOUT_ATTR}="wide"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="centered"] {
      position: relative !important;
      width: 100% !important;
      max-width: none !important;
      justify-content: center !important;
    }

    html[${FEED_LAYOUT_ATTR}="wide"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="centered"] [${FEED_CARD_ATTR}="1"]:not(:fullscreen) {
      flex: 1 1 auto !important;
      width: 100% !important;
      max-width: none !important;
      height: calc(100vh - 54px) !important;
      max-height: none !important;
      margin: 0 !important;
    }

    html[${FEED_LAYOUT_ATTR}="wide"] [${FEED_STAGE_ATTR}="1"][data-octo-feed-native="centered"] [${FEED_ACTIONS_ATTR}="1"] {
      position: absolute !important;
      right: 22px !important;
      bottom: 84px !important;
      left: auto !important;
      top: auto !important;
      transform: none !important;
      margin: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      z-index: 12 !important;
    }
  `;
}

function feedLayoutScript(mode = 'centered') {
  const layoutMode = mode === 'wide' ? 'wide' : 'centered';
  return `(() => {
    const ATTR = '${FEED_LAYOUT_ATTR}';
    const STAGE = '${FEED_STAGE_ATTR}';
    const CARD = '${FEED_CARD_ATTR}';
    const ACTIONS = '${FEED_ACTIONS_ATTR}';
    const ASPECT = '${FEED_ASPECT_ATTR}';
    const NATIVE_ATTR = 'data-octo-feed-native';
    const MODE = '${layoutMode}';

    const clearMarkers = () => {
      document.querySelectorAll('[' + STAGE + ']').forEach((el) => {
        el.removeAttribute(STAGE);
        el.removeAttribute(NATIVE_ATTR);
        el.style.removeProperty('--octo-feed-stage-w');
        el.style.removeProperty('--octo-feed-card-w');
      });
      document.querySelectorAll('[' + CARD + ']').forEach((el) => {
        el.removeAttribute(CARD);
        el.removeAttribute(ASPECT);
      });
      document.querySelectorAll('[' + ACTIONS + ']').forEach((el) => el.removeAttribute(ACTIONS));
    };

    const findFeedStage = () => {
      const path = location.pathname || '/';
      if (/^\\/(messages|upload|studio|settings|login|signup)/.test(path)) return null;
      const scope =
        document.querySelector('[id^="main-content-"], main, [role="main"]') || document.body;
      if (!scope) return null;

      const videos = Array.from(scope.querySelectorAll('video')).filter((v) => {
        if (v.closest('[role="dialog"], [aria-modal="true"]')) return false;
        const r = v.getBoundingClientRect();
        return r.width >= 180 && r.height >= 240;
      });

      const results = [];
      for (const video of videos) {
        let slide = video.parentElement;
        let likeBtn = null;
        while (slide && slide !== scope && slide !== document.body) {
          const candidate = slide.querySelector('[data-e2e="like-icon"], [data-e2e*="like-icon"]');
          if (
            candidate &&
            slide.contains(candidate) &&
            slide.querySelectorAll('video').length <= 2
          ) {
            likeBtn = candidate;
            break;
          }
          slide = slide.parentElement;
        }
        if (!slide || !likeBtn) continue;

        // Строго узкая вертикальная колонка кнопок (лайк + комментарии/поделиться),
        // не захватывающая подпись автора, описание и нижний плеер-бар.
        let actionsEl = likeBtn.closest('button, [role="button"]') || likeBtn;
        while (actionsEl.parentElement && actionsEl.parentElement !== slide) {
          const parent = actionsEl.parentElement;
          if (parent.contains(video)) break;
          if (
            parent.querySelector(
              '[class*="SeekBar"], [class*="ProgressBar"], [class*="BottomControls"], [class*="VideoControl"], [data-e2e*="author"], [data-e2e*="desc"], [class*="Author"], [class*="Desc"], [data-e2e*="follow"]',
            )
          ) {
            break;
          }
          const parentRect = parent.getBoundingClientRect();
          if (parentRect.width > 130) break;
          actionsEl = parent;
        }
        if (!actionsEl || actionsEl === slide || actionsEl.contains(video)) continue;
        if (actionsEl.getBoundingClientRect().width > 130) continue;
        const actionIcons = actionsEl.querySelectorAll('button, [role="button"], [data-e2e*="icon"]').length;
        if (actionIcons < 2) continue;

        // Общий родитель карточки видео и колонки действий
        let stage = actionsEl.parentElement;
        while (stage && stage !== scope && !stage.contains(video)) {
          stage = stage.parentElement;
        }
        if (!stage) stage = slide;

        // Высший потомок stage вокруг video, не содержащий actionsEl
        let cardEl = video;
        while (
          cardEl.parentElement &&
          cardEl.parentElement !== stage &&
          !cardEl.parentElement.contains(actionsEl)
        ) {
          cardEl = cardEl.parentElement;
        }
        if (!cardEl || cardEl === stage || cardEl.contains(actionsEl)) continue;

        const stageRect = stage.getBoundingClientRect();
        const cardRect = cardEl.getBoundingClientRect();
        const actionsRect = actionsEl.getBoundingClientRect();
        const isNativeWide =
          cardRect.width >= stageRect.width * 0.78 ||
          actionsRect.left < cardRect.right - 16;

        const vRatio =
          video.videoWidth > 0 && video.videoHeight > 0
            ? video.videoWidth / video.videoHeight
            : 9 / 16;
        const isWideAspect = vRatio > 1.08;
        const availH = Math.max(360, window.innerHeight - 96);
        const cardW = isWideAspect
          ? Math.round(Math.min(820, Math.max(480, window.innerWidth - 220), availH * Math.min(vRatio, 1.8)))
          : Math.round(Math.max(460, Math.min(580, availH * Math.max(vRatio, 0.5625))));

        results.push({ stage, cardEl, actionsEl, isWideAspect, isNativeWide, cardW });
      }
      return results;
    };

    const scan = () => {
      const currentMode = window.__octoFeedLayout?.mode || MODE;
      const root = document.documentElement;
      if (root && root.getAttribute(ATTR) !== currentMode) {
        root.setAttribute(ATTR, currentMode);
      }
      clearMarkers();
      const matches = findFeedStage();
      if (!matches) return;
      for (const { stage, cardEl, actionsEl, isWideAspect, isNativeWide, cardW } of matches) {
        stage.setAttribute(STAGE, '1');
        stage.setAttribute(NATIVE_ATTR, isNativeWide ? 'wide' : 'centered');
        stage.style.setProperty('--octo-feed-card-w', cardW + 'px');
        stage.style.setProperty('--octo-feed-stage-w', cardW + 84 + 'px');
        cardEl.setAttribute(CARD, '1');
        if (isWideAspect) cardEl.setAttribute(ASPECT, 'wide');
        actionsEl.setAttribute(ACTIONS, '1');
      }
    };

    if (window.__octoFeedLayout) {
      window.__octoFeedLayout.mode = MODE;
      scan();
      return 0;
    }

    let timer = null;
    const scheduleScan = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        scan();
      }, 150);
    };

    const state = {
      mode: MODE,
      observer: null,
      stop() {
        if (timer) clearTimeout(timer);
        document.removeEventListener('loadedmetadata', scheduleScan, true);
        if (state.observer) state.observer.disconnect();
        if (document.documentElement) document.documentElement.removeAttribute(ATTR);
        clearMarkers();
        delete window.__octoFeedLayout;
      },
    };

    document.addEventListener('loadedmetadata', scheduleScan, true);
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      state.observer = new MutationObserver(() => scheduleScan());
      state.observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.__octoFeedLayout = state;
    scan();
    return 1;
  })()`;
}

function siteCss(dark = true, paletteId = DEFAULT_PALETTE) {
  return `
    :root,
    html,
    body,
    [data-theme],
    [data-tux-theme],
    [class*="ThemeProvider"],
    [${MD3_ATTR}] {
      ${tokenDeclarations(dark, paletteId)}
    }
    ${COMPONENT_CSS}
  `;
}

function shadowCss(dark = true, paletteId = DEFAULT_PALETTE) {
  return `
    :host {
      ${tokenDeclarations(dark, paletteId)}
    }
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

    const effectiveBgLum = (el) => {
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const c = parseRgb(getComputedStyle(cur).backgroundColor);
        if (c && c.a >= 0.5) return luminanceOf(c);
        cur = cur.parentElement;
      }
      return MODE === 'dark' ? 25 : 246;
    };

    const isMessagesRoute = () =>
      /^\\/(?:messages|business-suite)(?:\\/|$)/i.test(location.pathname || '') ||
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

    const NAV_ROUTES = {
      'nav-foryou': (p) => p === '/' || p.startsWith('/foryou'),
      'nav-explore': (p) => p.startsWith('/explore'),
      'nav-following': (p) => p.startsWith('/following'),
      'nav-friends': (p) => p.startsWith('/friends'),
      'nav-live': (p) => p.startsWith('/live'),
      'nav-messages': (p) => p.startsWith('/messages'),
      'nav-upload': (p) => p.startsWith('/upload'),
      'nav-profile': (p) => p.startsWith('/@'),
    };

    const matchesRoute = (item) => {
      const current = location.pathname.replace(/\\/+$/, '') || '/';
      const e2e = item.getAttribute('data-e2e');
      if (e2e && NAV_ROUTES[e2e] && NAV_ROUTES[e2e](current)) return true;
      if (!(item instanceof HTMLAnchorElement)) return false;
      try {
        const href = new URL(item.href, location.href).pathname.replace(/\\/+$/, '') || '/';
        if (href === current) return true;
        if (current === '/' && (href === '/foryou' || e2e === 'nav-foryou')) {
          return true;
        }
      } catch {
        /* некорректный URL */
      }
      return false;
    };

    const syncSidebarNav = () => {
      const sidebars = document.querySelectorAll('[class*="DivSideNavContainer"]');
      for (const sidebar of sidebars) {
        const sRect = sidebar.getBoundingClientRect();
        if (sRect.width > 0 && sRect.width < 120) {
          sidebar.setAttribute('data-octo-md3-rail', 'collapsed');
        } else {
          sidebar.removeAttribute('data-octo-md3-rail');
        }
        const items = sidebar.querySelectorAll('a, button, [role="button"]');
        const groupItems = [];
        for (const item of items) {
          if (item.getAttribute('data-e2e') === 'tiktok-logo') continue;
          if (item.closest('[data-e2e="search-box"]') || /Search/i.test(item.className || '')) {
            continue;
          }
          const outerItem = item.parentElement?.closest('a, button, [role="button"]');
          if (outerItem && sidebar.contains(outerItem) && outerItem.getAttribute('data-e2e') !== 'tiktok-logo') {
            item.removeAttribute(NAV);
            item.removeAttribute(POS);
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

          const visuals = item.querySelectorAll('svg, svg path, span');
          for (const node of visuals) {
            node.removeAttribute(ICON);
            const style = getComputedStyle(node);
            if (isTikTokRed(style.color) || isTikTokRed(style.fill)) {
              node.setAttribute(ICON, 'active');
              active = true;
            }
          }

          if (active) item.setAttribute(NAV, 'active');
          else item.removeAttribute(NAV);

          if (
            !item.closest('[' + SURFACE + '="drawer"]') &&
            !/Account|User|Coin|Login/i.test(item.className || '')
          ) {
            const rect = item.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              groupItems.push({ el: item, rect });
            } else {
              item.removeAttribute(POS);
            }
          } else {
            item.removeAttribute(POS);
          }
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
        for (const cluster of clusters) {
          if (cluster.length === 1) {
            cluster[0].el.setAttribute(POS, 'single');
          } else {
            cluster.forEach((entry, idx) => {
              const role = idx === 0 ? 'first' : idx === cluster.length - 1 ? 'last' : 'mid';
              entry.el.setAttribute(POS, role);
            });
          }
        }
      }
    };

    const syncButtonGroups = (root) => {
      const btnSelector = ':scope > button:not([id^="octo-"]):not([class*="PlayOverlay"]):not([class*="VideoMask"]):not([class*="ClickArea"]):not([class*="ButtonActionItem"]):not([role="tab"]):not([role="menuitem"]):not([role="switch"]), :scope > a[role="button"]:not([id^="octo-"]):not([data-e2e="tiktok-logo"]):not([role="tab"]):not([role="menuitem"]), :scope > [class*="TUXButton"]:not([id^="octo-"])';
      const containers = new Set();
      root.querySelectorAll('button, a[role="button"], [class*="TUXButton"]').forEach((btn) => {
        if (
          btn.id?.startsWith('octo-') ||
          btn.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="drawer"], [class*="Player"], [class*="DivVideoWrapper"], [class*="SeekBar"], [class*="Control"]')
        ) {
          return;
        }
        if (btn.parentElement) containers.add(btn.parentElement);
      });

      for (const parent of containers) {
        if (parent.id?.startsWith('octo-')) continue;
        const buttons = Array.from(parent.querySelectorAll(btnSelector)).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height <= 64;
        });
        for (const el of buttons) el.removeAttribute(BTN_GROUP);
        if (buttons.length < 2 || buttons.length > 6) continue;

        const rects = buttons.map((el) => el.getBoundingClientRect());
        const horizontal = rects.every((r, i) => {
          if (i === 0) return true;
          const prev = rects[i - 1];
          const gap = r.left - prev.right;
          return Math.abs(r.top - prev.top) <= 8 && gap >= -2 && gap <= 18;
        });
        if (horizontal) {
          buttons.forEach((el, idx) => {
            el.setAttribute(BTN_GROUP, idx === 0 ? 'h-first' : idx === buttons.length - 1 ? 'h-last' : 'h-mid');
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
            el.setAttribute(BTN_GROUP, idx === 0 ? 'v-first' : idx === buttons.length - 1 ? 'v-last' : 'v-mid');
          });
        }
      }
    };

    const syncMessagesLayout = () => {
      document.querySelectorAll('[' + CHAT_LAYOUT + ']').forEach((el) => el.removeAttribute(CHAT_LAYOUT));
      if (!isMessagesRoute()) return;

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
        if (r.width >= 300 && r.height >= 260) {
          workspace = frame;
          isBusinessFrame = /(?:business-suite|business\\.tiktok)/i.test(src);
          break;
        }
      }

      const isEmptyPane = (el) => {
        if (!el || el.id?.startsWith('octo-')) return false;
        if (hasRealNav(el) || el.querySelector('[class*="DivSideNavContainer"] [data-e2e^="nav-"]')) {
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
          if (r.left >= 180 && r.width >= 240 && r.height >= 260 && (candidate.innerText || '').trim()) {
            workspace = candidate;
            break;
          }
        }
      }

      if (!workspace) return;
      const wsRect = workspace.getBoundingClientRect();
      if (wsRect.left < 180) return;

      let cur = workspace;
      while (cur && cur.parentElement && cur.parentElement !== document.documentElement) {
        const parent = cur.parentElement;
        for (const sibling of parent.children) {
          if (sibling === cur || sibling.id?.startsWith('octo-')) continue;
          const sr = sibling.getBoundingClientRect();
          if (sr.width < 40 || sr.height < 200 || sr.right > wsRect.left + 20) continue;
          if (isEmptyPane(sibling)) {
            sibling.setAttribute(CHAT_LAYOUT, 'hidden');
          }
        }
        if (cur !== workspace && parent !== document.body) {
          cur.setAttribute(CHAT_LAYOUT, 'host');
        }
        cur = parent;
      }

      if (workspace.tagName === 'IFRAME') {
        workspace.setAttribute(CHAT_LAYOUT, 'frame');
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
          const st = getComputedStyle(node);
          if (parseFloat(st.marginLeft) >= 120 || parseFloat(st.paddingLeft) >= 120) {
            node.setAttribute(CHAT_LAYOUT, 'flush');
          }
          node = node.parentElement;
        }
      }
    };

    const syncSurfaces = (root) => {
      const msgCtx = isMessagesContext();
      const pageContainers = root.querySelectorAll(
        '#app > div, #root > div, #root > div > div, main > div, [role="main"] > div, [id^="main-content-"] > div, [id^="main-content-"] > div > div',
      );
      for (const el of pageContainers) {
        if (
          el.id?.startsWith('octo-') ||
          el.matches('[role="dialog"], [role="menu"], [role="tooltip"], [class*="DivSideNavContainer"], [class*="DivHeaderContainer"], [class*="DivMainContainer"], [class*="DivBodyContainer"], [class*="DivLayoutContainer"], video, iframe') ||
          el.closest('[role="dialog"], [role="menu"]')
        ) {
          if (el.getAttribute(SURFACE) === 'page') el.removeAttribute(SURFACE);
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
            if (el.getAttribute(SURFACE) === 'page') el.removeAttribute(SURFACE);
            continue;
          }
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            el.setAttribute(SURFACE, 'page');
          }
        }
      }

      // Нормализуем текстовые поля (логин, 2FA, формы): только одна внешняя рамка без «скобок» по краям.
      root.querySelectorAll('[' + SURFACE + '="field"]').forEach((el) => el.removeAttribute(SURFACE));
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
        if (chosen) chosen.setAttribute(SURFACE, 'field');
      }

      // Полосы вкладок («Видео | Репосты | Избранное»): убираем чёрную подложку, ставим MD3-панель.
      root.querySelectorAll('[' + SURFACE + '="tab-bar"], [' + SURFACE + '="profile-head"]').forEach((el) => el.removeAttribute(SURFACE));
      for (const tablist of root.querySelectorAll('[role="tablist"], [class*="DivVideoFeedTab"]')) {
        if (
          tablist.id?.startsWith('octo-') ||
          tablist.closest('[' + SURFACE + '="drawer"], [role="dialog"], [class*="DivSideNavContainer"]')
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
          bar.setAttribute(SURFACE, 'tab-bar');
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
            tablist.setAttribute(SURFACE, 'tab-bar');
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
        if (head) head.setAttribute(SURFACE, 'profile-head');
      }

      // Горизонтальные ряды чипов фильтров («Смотреть», «Мини-сериалы», «Уведомления»).
      root.querySelectorAll('[' + SURFACE + '="chip"], [' + SURFACE + '="chip-active"], [' + SURFACE + '="chip-bar"]').forEach((el) => el.removeAttribute(SURFACE));
      const rowParents = new Set();
      for (const btn of root.querySelectorAll('button, a, [role="tab"], [role="button"]')) {
        if (
          btn.id?.startsWith('octo-') ||
          !btn.parentElement ||
          btn.closest('[class*="DivSideNavContainer"], [class*="Player"], [class*="DivVideoWrapper"], [class*="DivBottomControls"]')
        ) {
          continue;
        }
        if (btn.closest('header, [role="banner"], [class*="DivHeaderContainer"]') && !btn.closest('[' + SURFACE + '="drawer"]')) {
          continue;
        }
        rowParents.add(btn.parentElement);
      }
      for (const parent of rowParents) {
        const inDrawer = Boolean(parent.closest('[' + SURFACE + '="drawer"]'));
        if (
          parent.matches('[class*="Action"], [class*="Controls"], [class*="Sort" i], [role="radiogroup"]') ||
          (!inDrawer && parent.matches('[role="tablist"], [class*="DivVideoFeedTab"], [class*="DivTabList"], [class*="TUXTabBar"]'))
        ) {
          continue;
        }
        const btns = Array.from(parent.children).filter((el) => {
          if (!el.matches('button, a, [role="tab"], [role="button"]')) return false;
          const r = el.getBoundingClientRect();
          return r.width >= 24 && r.width <= 260 && r.height >= 20 && r.height <= 44;
        });
        if (btns.length < 3) continue;
        const rects = btns.map((el) => el.getBoundingClientRect());
        const sameRowCount = rects.filter((r) => Math.abs(r.top - rects[0].top) <= 6).length;
        if (!inDrawer && sameRowCount < 3) continue;
        const hasSingleLineWrap = inDrawer && btns.every((b) => (b.textContent || '').trim().length <= 34);
        if (inDrawer && sameRowCount < 2 && !hasSingleLineWrap) continue;
        parent.setAttribute(SURFACE, 'chip-bar');
        for (const el of btns) {
          const st = getComputedStyle(el);
          const active =
            el.getAttribute('aria-selected') === 'true' ||
            el.getAttribute('aria-pressed') === 'true' ||
            el.getAttribute('data-active') === 'true' ||
            /(Active|Selected|is-active)/i.test(el.className || '') ||
            (MODE === 'dark' && isLightColor(st.backgroundColor));
          el.setAttribute(SURFACE, active ? 'chip-active' : 'chip');
        }
      }

      // Страница /setting: левая панель разделов и правая карточка настроек.
      root.querySelectorAll('[' + SURFACE + '="setting-nav"], [' + SURFACE + '="setting-nav-item"], [' + SURFACE + '="setting-nav-active"], [' + SURFACE + '="setting-pane"]').forEach((el) => el.removeAttribute(SURFACE));
      if (/^\\/setting/i.test(location.pathname || '')) {
        const settingCandidates = Array.from(root.querySelectorAll('div, aside, nav, section')).filter((el) => {
          if (el.id?.startsWith('octo-') || el.closest('[class*="DivSideNavContainer"], header, [role="banner"], [' + SURFACE + '="drawer"]')) return false;
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
          navCol.setAttribute(SURFACE, 'setting-nav');
          const rows = Array.from(navCol.querySelectorAll(':scope > a, :scope > button, :scope > [role="tab"], :scope > [role="button"], :scope > ul > li, :scope > div')).filter((row) => row.getBoundingClientRect().height >= 28 && row.getBoundingClientRect().height <= 72);
          for (const row of rows) {
            const rs = getComputedStyle(row);
            const active =
              row.getAttribute('aria-selected') === 'true' ||
              row.getAttribute('aria-current') === 'page' ||
              row.getAttribute('data-active') === 'true' ||
              /(Active|Selected)/i.test(row.className || '') ||
              isTikTokRed(rs.color) ||
              Array.from(row.querySelectorAll('span, div, p')).some((n) => isTikTokRed(getComputedStyle(n).color));
            row.setAttribute(SURFACE, active ? 'setting-nav-active' : 'setting-nav-item');
          }
        }
        if (paneCol) paneCol.setAttribute(SURFACE, 'setting-pane');
      }

      const commentCandidates = root.querySelectorAll('aside, section, [id^="main-content-"] div, #app div');
      for (const el of commentCandidates) {
        if (
          el.id?.startsWith('octo-') ||
          el.matches('[class*="DivSideNavContainer"], [role="dialog"], [role="menu"]') ||
          el.closest('[' + SURFACE + '="comments"]')
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
          el.setAttribute(SURFACE, 'comments');
          const editable = el.querySelector('[contenteditable="true"], textarea');
          const inputWrap = editable?.closest('[data-e2e="comment-input"], [class*="DivCommentInput"], [class*="InputContainer"], [class*="InputWrapper"], form');
          if (inputWrap && inputWrap !== el && inputWrap.getBoundingClientRect().height <= 120) {
            inputWrap.setAttribute(SURFACE, 'comment-input');
          }
        }
      }

      if (MODE === 'dark') {
        const topBars = root.querySelectorAll(
          'body > div, #app > div, #app > div > div, #root > div, #root > div > div, #root header, header, nav, [class*="Header" i], [class*="TopBar" i], [class*="NavBar" i]',
        );
        const topLimit = msgCtx ? 140 : 20;
        for (const el of topBars) {
          if (el.id?.startsWith('octo-')) continue;
          if (el.closest('[' + SURFACE + '="header"]')) continue;
          const rect = el.getBoundingClientRect();
          if (
            rect.top >= -4 &&
            rect.top <= topLimit &&
            rect.height >= 36 &&
            rect.height <= 120 &&
            rect.width >= window.innerWidth * 0.45
          ) {
            const c = parseRgb(getComputedStyle(el).backgroundColor);
            if (c && c.a >= 0.7 && c.r >= 200 && c.g >= 200 && c.b >= 200) {
              el.setAttribute(SURFACE, 'header');
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
            row.setAttribute(SURFACE, 'chat-active');
          } else if (row.getAttribute(SURFACE) === 'chat-active') {
            row.removeAttribute(SURFACE);
          }
        }

        const msgPanels = root.querySelectorAll(
          '#root div, #app div, section, aside, [class*="Panel" i], [class*="Card" i], [class*="List" i], [class*="Header" i], [class*="Container" i]',
        );
        for (const panel of msgPanels) {
          if (
            panel.id?.startsWith('octo-') ||
            panel.matches('button, [role="button"], input, textarea, [contenteditable], img, video, svg, [' + SURFACE + ']') ||
            panel.closest('[' + SURFACE + '="chat-active"], [' + SURFACE + '="header"], [role="dialog"], [role="menu"], [role="tooltip"]')
          ) {
            continue;
          }
          const r = panel.getBoundingClientRect();
          if (r.width < 160 || r.height < 36) {
            continue;
          }
          if (isLightColor(getComputedStyle(panel).backgroundColor)) {
            panel.setAttribute(
              SURFACE,
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
            if (!wrap.hasAttribute(SURFACE)) wrap.setAttribute(SURFACE, 'chat-input');
          }
        }

        for (const node of root.querySelectorAll(
          'span, p, div, a, strong, label, h1, h2, h3, h4, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]',
        )) {
          if (
            node.id?.startsWith('octo-') ||
            node.closest('[' + SURFACE + '="chat-active"], [' + ACCENT + '="primary"], [' + ACCENT + '="tonal"], [' + ACCENT + '="badge"], [role="tooltip"], [class*="DivSideNavContainer"]')
          ) {
            if (node.hasAttribute(FG)) node.removeAttribute(FG);
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
          if (isDarkColor(style.color) && effectiveBgLum(node) < 105) {
            node.setAttribute(FG, 'on-surface');
          } else if (node.getAttribute(FG) === 'on-surface') {
            node.removeAttribute(FG);
          }
        }
      } else {
        root.querySelectorAll('[' + FG + ']').forEach((el) => el.removeAttribute(FG));
        root.querySelectorAll('[' + SURFACE + '="chat-active"], [' + SURFACE + '="card"], [' + SURFACE + '="chat-input"]').forEach((el) => el.removeAttribute(SURFACE));
      }

      const drawerCandidates = root.querySelectorAll(
        '[class*="DivSideNavContainer"] div, [class*="DivSideNavContainer"] section, body > div',
      );
      for (const el of drawerCandidates) {
        if (
          el.id?.startsWith('octo-') ||
          el.matches('[class*="DivSideNavContainer"], [data-e2e="search-transfer-list"], [role="tooltip"]') ||
          el.querySelector('[data-e2e="tiktok-logo"], [data-e2e="search-box"], [data-e2e="nav-foryou"], [data-e2e="nav-explore"]')
        ) {
          if (el.getAttribute(SURFACE) === 'drawer') el.removeAttribute(SURFACE);
          continue;
        }
        const parentDrawer = el.parentElement?.closest('[' + SURFACE + '="drawer"]');
        if (parentDrawer) continue;
        const style = getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') continue;
        const rect = el.getBoundingClientRect();
        if (
          rect.left <= 340 &&
          rect.width >= 200 &&
          rect.width <= 480 &&
          rect.height >= 260 &&
          rect.height <= window.innerHeight &&
          el.querySelector('a, button, [role="button"], [role="menuitem"]')
        ) {
          el.setAttribute(SURFACE, 'drawer');
        }
      }
    };

    const classify = (el) => {
      if (!(el instanceof Element) || el.id?.startsWith('octo-')) return;
      const existing = el.getAttribute(ACCENT);

      const isSwitchControl =
        el.matches('[role="switch"], [class*="Switch"], [class*="Toggle"]') ||
        Boolean(el.closest('[class*="AutoScroll"]'));

      const rectForSwitch =
        !isSwitchControl && el.closest('[class*="Control"], [class*="Bottom"], [class*="Player"]')
          ? el.getBoundingClientRect()
          : null;
      const isPillInPlayer = Boolean(
        rectForSwitch &&
          rectForSwitch.width >= 24 &&
          rectForSwitch.width <= 64 &&
          rectForSwitch.height >= 12 &&
          rectForSwitch.height <= 32,
      );

      if (isSwitchControl || isPillInPlayer) {
        const checkedAttr = el.getAttribute('aria-checked') ?? el.getAttribute('data-checked');
        if (existing === 'switch' || existing === 'switch-off') {
          const prev = el.dataset.octoMd3Checked ?? null;
          if (checkedAttr !== null && checkedAttr !== prev) {
            el.dataset.octoMd3Checked = checkedAttr;
            el.setAttribute(ACCENT, checkedAttr === 'true' ? 'switch' : 'switch-off');
          }
          return;
        }
        const bg = getComputedStyle(el).backgroundColor;
        const red = isTikTokRed(bg);
        const cyan = isTikTokCyan(bg);
        if (!red && !cyan && checkedAttr === null) return;
        const parsed = parseRgb(bg);
        const on =
          checkedAttr === 'true' ||
          Boolean(parsed && ((cyan && parsed.g >= 175 && parsed.a >= 0.7) || (red && parsed.a >= 0.5)));
        if (checkedAttr !== null) el.dataset.octoMd3Checked = checkedAttr;
        el.setAttribute(ACCENT, on ? 'switch' : 'switch-off');
        return;
      }

      if (existing === 'primary') {
        if (
          el.getAttribute('aria-pressed') === 'true' ||
          /(Following|Followed|Secondary|Outline)/i.test(el.className || '') ||
          el.closest('[class*="DivSideNavContainer"]')
        ) {
          el.removeAttribute(ACCENT);
        }
        return;
      }

      if (existing === 'tonal') {
        if (MODE !== 'dark') el.removeAttribute(ACCENT);
        return;
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
          !el.closest('[class*="DivSideNavContainer"], [' + SURFACE + '="drawer"], [class*="Player"], [class*="DivVideoWrapper"]') &&
          !el.matches('[class*="PlayOverlay"], [class*="VideoMask"], [class*="ClickArea"], [class*="ButtonActionItem"], [data-e2e="search-button"], [data-e2e="comment-post"], [data-e2e="feed-navigation-next"], [data-e2e="feed-navigation-prev"], [data-e2e="arrow-down"], [data-e2e="arrow-up"]') &&
          isLightColor(bg)
        ) {
          el.setAttribute(ACCENT, 'tonal');
        }
        return;
      }

      if (el.closest('[class*="DivSideNavContainer"]') && el.matches('a, button, [role="button"]')) {
        return;
      }
      if (el.matches('button, [role="button"], a') && !el.matches(':disabled, [aria-disabled="true"]')) {
        el.setAttribute(ACCENT, 'primary');
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.height >= 2 && rect.height <= 10 && rect.width >= 2) {
        el.setAttribute(ACCENT, 'progress');
        return;
      }
      if (rect.width > 0 && rect.width <= 36 && rect.height > 0 && rect.height <= 28) {
        el.setAttribute(ACCENT, 'badge');
      }
    };

    const syncActionIcons = (root) => {
      const icons = root.querySelectorAll(
        '[data-e2e*="like-icon"], [data-e2e*="like-icon"] svg, [data-e2e*="like-icon"] path, [data-e2e*="favorite-icon"], [data-e2e*="favorite-icon"] svg, [data-e2e*="favorite-icon"] path, [' +
          SURFACE +
          '="comments"] svg, [' +
          SURFACE +
          '="comments"] svg path, [class*="DivComment"] svg, [class*="DivComment"] svg path',
      );
      for (const node of icons) {
        if (node.id?.startsWith('octo-') || node.closest('[class*="DivSideNavContainer"]')) continue;
        node.removeAttribute(ICON);
        const style = getComputedStyle(node);
        if (isTikTokRed(style.color) || isTikTokRed(style.fill)) {
          node.setAttribute(ICON, 'active');
        }
      }

      if (MODE === 'dark' && isMessagesContext()) {
        const uiSvgs = root.querySelectorAll(
          '[' + SURFACE + '="header"] svg, [' + SURFACE + '="card"] svg, [' + SURFACE + '="chat-input"] svg, [class*="Header" i] svg, [class*="Toolbar" i] svg, [class*="MessageEditor" i] svg, [class*="ChatEditor" i] svg',
        );
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
          if (hasDark && effectiveBgLum(svg) < 105) {
            svg.setAttribute(ICON, 'on-surface');
          } else if (svg.getAttribute(ICON) === 'on-surface') {
            svg.removeAttribute(ICON);
          }
        }
      }
    };

    const scan = (root = document) => {
      if (!root || !root.querySelectorAll) return;
      syncMessagesLayout();
      syncSidebarNav();
      syncSurfaces(root);
      syncActionIcons(root);
      syncButtonGroups(root);
      const candidates = root.querySelectorAll(
        'button, [role="button"], [role="switch"], [class*="Switch"], [class*="Toggle"], [class*="AutoScroll"] div, [class*="AutoScroll"] span, [class*="Control"] div, [class*="Control"] span, [class*="Bottom"] div, [class*="Bottom"] span, [class*="Player"] label, [class*="Player"] span, [class*="Progress"], [class*="SeekBar"] div, [class*="Badge" i], [class*="Count" i], [class*="Unread" i], [class*="Dot" i], sup, [' +
          SURFACE +
          '="comments"] a, [class*="DivComment"] a',
      );
      for (const el of candidates) classify(el);

      // Красные текстовые ссылки в модалках (например «Отправить код заново») перекрашиваем в primary
      for (const node of root.querySelectorAll('[role="dialog"] :is(button, a, span, p, div), [aria-modal="true"] :is(button, a, span, p, div)')) {
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
          node.setAttribute(ACCENT, 'primary-text');
        }
      }
    };

    const apply = () => {
      const root = document.documentElement;
      if (root && root.getAttribute(ATTR) !== MODE) {
        root.setAttribute(ATTR, MODE);
      }
      scan(document);
    };

    if (window.__octoMd3) {
      window.__octoMd3.mode = MODE;
      apply();
      return 0;
    }

    let timer = null;
    const scheduleScan = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        scan(document);
      }, 150);
    };

    const onPopState = () => scheduleScan();

    const state = {
      mode: MODE,
      attrObserver: null,
      domObserver: null,
      stop() {
        if (timer) clearTimeout(timer);
        window.removeEventListener('popstate', onPopState);
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
        document.querySelectorAll('[' + CHAT_LAYOUT + ']').forEach((el) => el.removeAttribute(CHAT_LAYOUT));
        delete window.__octoMd3;
      },
    };

    window.addEventListener('popstate', onPopState);

    const root = document.documentElement;
    if (root && typeof MutationObserver !== 'undefined') {
      state.attrObserver = new MutationObserver(() => {
        const current = document.documentElement;
        if (current && current.getAttribute(ATTR) !== state.mode) {
          current.setAttribute(ATTR, state.mode);
        }
      });
      state.attrObserver.observe(root, { attributes: true, attributeFilter: [ATTR] });

      state.domObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.target instanceof Element && mutation.target.id?.startsWith('octo-')) continue;
          if (mutation.type === 'attributes' || mutation.addedNodes.length > 0) {
            scheduleScan();
            return;
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
  FEED_LAYOUT_ATTR,
  FEED_STAGE_ATTR,
  FEED_CARD_ATTR,
  FEED_ACTIONS_ATTR,
  DARK_TOKENS,
  LIGHT_TOKENS,
  siteCss,
  shadowCss,
  syncScript,
  feedLayoutCss,
  feedLayoutScript,
  CLEANUP_JS,
};
