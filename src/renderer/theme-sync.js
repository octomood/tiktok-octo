'use strict';

/**
 * Синхронизация палитры и темы (тёмной / светлой) во всех окнах приложения.
 * Применяет CSS-переменные --md-* из палитры, выбранной в настройках.
 */
(() => {
  const TOKEN_CSS_MAP = {
    primary: '--md-primary',
    onPrimary: '--md-on-primary',
    primaryContainer: '--md-primary-container',
    onPrimaryContainer: '--md-on-primary-container',
    secondary: '--md-secondary',
    onSecondary: '--md-on-secondary',
    secondaryContainer: '--md-secondary-container',
    onSecondaryContainer: '--md-on-secondary-container',
    tertiary: '--md-tertiary',
    onTertiary: '--md-on-tertiary',
    tertiaryContainer: '--md-tertiary-container',
    onTertiaryContainer: '--md-on-tertiary-container',
    error: '--md-error',
    onError: '--md-on-error',
    errorContainer: '--md-error-container',
    onErrorContainer: '--md-on-error-container',
    surfaceDim: '--md-surface-dim',
    surface: '--md-surface',
    surfaceContainerLowest: '--md-surface-container-lowest',
    surfaceContainerLow: '--md-surface-container-low',
    surfaceContainer: '--md-surface-container',
    surfaceContainerHigh: '--md-surface-container-high',
    surfaceContainerHighest: '--md-surface-container-highest',
    onSurface: '--md-on-surface',
    onSurfaceVariant: '--md-on-surface-variant',
    outline: '--md-outline',
    outlineVariant: '--md-outline-variant',
    inverseSurface: '--md-inverse-surface',
    inverseOnSurface: '--md-inverse-on-surface',
    stateHover: '--md-state-hover',
    statePressed: '--md-state-pressed',
    scrim: '--md-scrim',
    elevation1: '--md-elev-1',
    elevation2: '--md-elev-2',
    elevation3: '--md-elev-3',
  };

  function apply(payload) {
    if (!payload || typeof payload !== 'object') return;
    const root = document.documentElement;
    const dark = payload.dark !== false;
    const amoled = dark && payload.amoled === true;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.amoled = amoled ? 'true' : 'false';
    if (payload.palette) root.dataset.palette = String(payload.palette);
    root.style.setProperty('--md-scheme', dark ? 'dark' : 'light');

    const tokens = payload.tokens;
    if (tokens && typeof tokens === 'object') {
      for (const [key, cssVar] of Object.entries(TOKEN_CSS_MAP)) {
        if (typeof tokens[key] === 'string') {
          root.style.setProperty(cssVar, tokens[key]);
        }
      }
    }
  }

  window.octoTheme = { apply };
  const octo = window.octo;
  if (octo && octo.theme) apply(octo.theme);
  if (octo && typeof octo.onTheme === 'function') octo.onTheme(apply);
})();
