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

  const BASE_DEG_PER_MS = 0.024;
  const motionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  let rainbowActive = false;
  let rainbowCfg = { hueFrom: 0, hueTo: 360, speed: 1 };
  let hueTimer = null;
  let lastHue = '';
  let lastRainbowKey = '';
  let lastThemeAttrs = '';
  const lastTokensByVar = new Map();

  function stepMsForSpeed() {
    const speed = Math.min(4, Math.max(0.2, Number(rainbowCfg.speed) || 1));
    return Math.round(Math.min(180, Math.max(70, 100 / Math.sqrt(speed))));
  }

  function computeHue(reduced) {
    const from = Number(rainbowCfg.hueFrom) || 0;
    const to = rainbowCfg.hueTo === undefined ? 360 : Number(rainbowCfg.hueTo);
    const speed = Math.min(4, Math.max(0.2, Number(rainbowCfg.speed) || 1));
    const isFull = Math.abs(to - from) >= 360;
    const span = isFull ? 360 : (((to - from) % 360) + 360) % 360;
    if (reduced) {
      return ((from + (isFull ? 260 : span / 2)) % 360).toFixed(1);
    }
    if (!isFull && span === 0) {
      return (((from % 360) + 360) % 360).toFixed(1);
    }
    const degPerMs = BASE_DEG_PER_MS * speed;
    if (isFull) {
      return ((Date.now() * degPerMs) % 360).toFixed(1);
    }
    const periodMs = (2 * Math.max(span, 30)) / degPerMs;
    const phase = (Date.now() % periodMs) / periodMs;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    return ((from + span * wave) % 360).toFixed(1);
  }

  function paintHue() {
    const root = document.documentElement;
    if (!root) return;
    const hue = computeHue(Boolean(motionQuery && motionQuery.matches));
    if (hue === lastHue) return;
    lastHue = hue;
    root.style.setProperty('--octo-hue', hue);
  }

  function syncHueLoop() {
    if (hueTimer) {
      clearInterval(hueTimer);
      hueTimer = null;
    }
    const root = document.documentElement;
    if (!rainbowActive) {
      lastHue = '';
      if (root) root.style.removeProperty('--octo-hue');
      return;
    }
    paintHue();
    if (document.visibilityState === 'hidden') return;
    if (motionQuery && motionQuery.matches) return;
    hueTimer = setInterval(paintHue, stepMsForSpeed());
  }

  document.addEventListener('visibilitychange', syncHueLoop);
  if (motionQuery && typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', syncHueLoop);
  }

  function apply(payload) {
    if (!payload || typeof payload !== 'object') return;
    const root = document.documentElement;
    const dark = payload.dark !== false;
    const amoled = dark && payload.amoled === true;
    const rainbow = payload.rainbow === true;
    const palette = payload.palette ? String(payload.palette) : '';
    const themeAttrs = `${dark ? 'dark' : 'light'}|${amoled ? '1' : '0'}|${rainbow ? '1' : '0'}|${palette}`;
    if (themeAttrs !== lastThemeAttrs) {
      lastThemeAttrs = themeAttrs;
      root.dataset.theme = dark ? 'dark' : 'light';
      root.dataset.amoled = amoled ? 'true' : 'false';
      root.dataset.rainbow = rainbow ? 'true' : 'false';
      if (palette) root.dataset.palette = palette;
      root.style.setProperty('--md-scheme', dark ? 'dark' : 'light');
    }

    rainbowActive = rainbow;
    if (payload.rainbowConfig && typeof payload.rainbowConfig === 'object') {
      rainbowCfg = payload.rainbowConfig;
    }
    const rainbowKey = rainbow
      ? `1:${Number(rainbowCfg.hueFrom) || 0}:${rainbowCfg.hueTo === undefined ? 360 : Number(rainbowCfg.hueTo)}:${Number(rainbowCfg.speed) || 1}`
      : '0';
    if (rainbowKey !== lastRainbowKey) {
      lastRainbowKey = rainbowKey;
      syncHueLoop();
    }

    const tokens = rainbow && payload.rainbowTokens ? payload.rainbowTokens : payload.tokens;
    if (tokens && typeof tokens === 'object') {
      for (const [key, cssVar] of Object.entries(TOKEN_CSS_MAP)) {
        const val = tokens[key];
        if (typeof val === 'string' && lastTokensByVar.get(cssVar) !== val) {
          lastTokensByVar.set(cssVar, val);
          root.style.setProperty(cssVar, val);
        }
      }
    }
  }

  window.octoTheme = { apply };
  const octo = window.octo;
  if (octo && octo.theme) apply(octo.theme);
  if (octo && typeof octo.onTheme === 'function') octo.onTheme(apply);
})();
