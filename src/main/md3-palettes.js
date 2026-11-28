'use strict';

/**
 * 20 гармоничных цветовых палитр Material Design 3 Expressive.
 *
 * Каждая палитра содержит полный набор ролей для тёмного и светлого режима
 * (primary, secondary, tertiary, surface containers, outline, inverse, elevation).
 * Палитра по умолчанию (`octo-lavender`) сохраняет точную фирменную гамму
 * приложения (#3e3854 / #8c84a9 / #ddd2e0).
 */

const DEFAULT_PALETTE = 'octo-lavender';
const CUSTOM_PALETTE_ID = 'custom';
const DEFAULT_CUSTOM_THEME = Object.freeze({
  primary: '#8c84a9',
  secondary: '',
  tertiary: '',
  surface: '',
  text: '',
});
const DEFAULT_RAINBOW_CONFIG = Object.freeze({
  hueFrom: 0,
  hueTo: 360,
  speed: 1,
});
const RAINBOW_PRESETS = Object.freeze([
  { id: 'full', label: 'Вся радуга', hueFrom: 0, hueTo: 360 },
  { id: 'sunset', label: 'Закат', hueFrom: 335, hueTo: 50 },
  { id: 'ocean', label: 'Океан', hueFrom: 155, hueTo: 250 },
  { id: 'neon', label: 'Неон', hueFrom: 190, hueTo: 325 },
  { id: 'sakura', label: 'Сакура', hueFrom: 265, hueTo: 350 },
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  let clean = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    clean = clean
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(clean)) return fallback;
  return `#${clean.toLowerCase()}`;
}

function hexToHsl(hex) {
  const [rRaw, gRaw, bRaw] = hexToRgb(normalizeHex(hex, '#8c84a9'));
  const r = rRaw / 255;
  const g = gRaw / 255;
  const b = bRaw / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function normalizeCustomTheme(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CUSTOM_THEME };
  }
  return {
    primary: normalizeHex(raw.primary, DEFAULT_CUSTOM_THEME.primary),
    secondary: normalizeHex(raw.secondary, ''),
    tertiary: normalizeHex(raw.tertiary, ''),
    surface: normalizeHex(raw.surface, ''),
    text: normalizeHex(raw.text, ''),
  };
}

function normalizeRainbowConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_RAINBOW_CONFIG };
  }
  const hueFromRaw = Number(raw.hueFrom);
  const hueToRaw = Number(raw.hueTo);
  const speedRaw = Number(raw.speed);
  const hueFrom = Number.isFinite(hueFromRaw)
    ? Math.round(clamp(hueFromRaw, 0, 360))
    : DEFAULT_RAINBOW_CONFIG.hueFrom;
  const hueTo = Number.isFinite(hueToRaw)
    ? Math.round(clamp(hueToRaw, 0, 360))
    : DEFAULT_RAINBOW_CONFIG.hueTo;
  const speed = Number.isFinite(speedRaw)
    ? Math.round(clamp(speedRaw, 0.2, 4) * 10) / 10
    : DEFAULT_RAINBOW_CONFIG.speed;
  return { hueFrom, hueTo, speed };
}

function hslToHex(hue, sat, light) {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(sat, 0, 100) / 100;
  const l = clamp(light, 0, 100) / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  const ch = (v) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * clamp(c, 0, 1) ** (1 / 2.4) - 0.055;
}

function linearRgbToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(normalizeHex(hex, '#8c84a9')).map((v) => srgbToLinear(v / 255));
  const lab = linearRgbToOklab(r, g, b);
  const c = Math.hypot(lab.a, lab.b);
  const h = c < 1e-4 ? 0 : ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return { l: lab.l, c, h };
}

function inGamut(r, g, b) {
  return r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;
}

function oklchToHex(l, c, h) {
  const L = clamp(l, 0, 1);
  const rad = (((h % 360) + 360) % 360) * (Math.PI / 180);
  const cosH = Math.cos(rad);
  const sinH = Math.sin(rad);
  const targetC = Math.max(0, c);
  let rgb = oklabToLinearRgb(L, targetC * cosH, targetC * sinH);
  if (!inGamut(rgb[0], rgb[1], rgb[2])) {
    let lo = 0;
    let hi = targetC;
    for (let i = 0; i < 16; i += 1) {
      const mid = (lo + hi) * 0.5;
      const cand = oklabToLinearRgb(L, mid * cosH, mid * sinH);
      if (inGamut(cand[0], cand[1], cand[2])) {
        lo = mid;
        rgb = cand;
      } else {
        hi = mid;
      }
    }
    rgb = oklabToLinearRgb(L, lo * cosH, lo * sinH);
  }
  return rgbToHex(linearToSrgb(rgb[0]), linearToSrgb(rgb[1]), linearToSrgb(rgb[2]));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => srgbToLinear(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function fitOklchLightness(startL, c, h, fgHex, step, minRatio = 4.8, minL = 0.14, maxL = 0.94) {
  let l = startL;
  for (let i = 0; i < 60; i += 1) {
    const candidate = oklchToHex(l, c, h);
    if (contrastRatio(candidate, fgHex) >= minRatio) return candidate;
    const next = clamp(l + step, minL, maxL);
    if (next === l) break;
    l = next;
  }
  return oklchToHex(l, c, h);
}

function specToOklch(h, s, mono) {
  if (mono || s <= 0) return { h: 260, c: 0 };
  const parsed = hexToOklch(hslToHex(h, s, 54));
  return { h: parsed.h, c: clamp(parsed.c, 0.04, 0.18) };
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildScheme(spec) {
  const { h, s, secH, secS, terH, terS, surfS, mono } = spec;
  const pOk = specToOklch(h, s, mono);
  const secOk = specToOklch(secH, secS, mono);
  const terOk = specToOklch(terH, terS, mono);

  const pChromaDark = mono ? 0 : clamp(pOk.c * 0.96, 0.055, 0.148);
  const pChromaLight = mono ? 0 : clamp(pOk.c * 1.06, 0.065, 0.165);
  const secChromaDark = mono ? 0 : clamp(secOk.c * 0.88, 0.045, 0.115);
  const secChromaLight = mono ? 0 : clamp(secOk.c * 0.96, 0.055, 0.13);
  const terChromaDark = mono ? 0 : clamp(terOk.c * 0.94, 0.05, 0.13);
  const terChromaLight = mono ? 0 : clamp(terOk.c * 1.02, 0.06, 0.145);

  const surfC = mono ? 0 : clamp((surfS / 100) * 0.16, 0.012, 0.042);
  const varC = mono ? 0 : clamp(pOk.c * 0.28, 0.014, 0.046);
  const hue = pOk.h;

  const darkOnPrimary = oklchToHex(0.18, mono ? 0 : clamp(pChromaDark * 0.42, 0.012, 0.045), hue);
  const darkPrimary = fitOklchLightness(0.76, pChromaDark, hue, darkOnPrimary, 0.015);
  const darkOnSecondary = oklchToHex(
    0.19,
    mono ? 0 : clamp(secChromaDark * 0.38, 0.01, 0.04),
    secOk.h,
  );
  const darkSecondary = fitOklchLightness(0.8, secChromaDark, secOk.h, darkOnSecondary, 0.015);
  const darkOnTertiary = oklchToHex(
    0.2,
    mono ? 0 : clamp(terChromaDark * 0.38, 0.01, 0.042),
    terOk.h,
  );
  const darkTertiary = fitOklchLightness(0.82, terChromaDark, terOk.h, darkOnTertiary, 0.015);

  const lightOnPrimary = oklchToHex(0.985, mono ? 0 : 0.012, hue);
  const lightPrimary = fitOklchLightness(0.47, pChromaLight, hue, lightOnPrimary, -0.015);
  const lightOnSecondary = oklchToHex(0.985, mono ? 0 : 0.012, secOk.h);
  const lightSecondary = fitOklchLightness(0.48, secChromaLight, secOk.h, lightOnSecondary, -0.015);
  const lightOnTertiary = oklchToHex(0.985, mono ? 0 : 0.012, terOk.h);
  const lightTertiary = fitOklchLightness(0.46, terChromaLight, terOk.h, lightOnTertiary, -0.015);
  const lightPrimaryBase = fitOklchLightness(0.39, pChromaLight, hue, lightOnPrimary, -0.015);

  const darkPrimaryContainer = oklchToHex(
    0.32,
    mono ? 0 : clamp(pChromaDark * 0.66, 0.032, 0.095),
    hue,
  );
  const darkOnPrimaryContainer = fitOklchLightness(
    0.9,
    mono ? 0 : clamp(pChromaDark * 0.38, 0.018, 0.055),
    hue,
    darkPrimaryContainer,
    0.015,
    4.8,
    0.12,
    0.96,
  );
  const darkSecondaryContainer = oklchToHex(
    0.37,
    mono ? 0 : clamp(secChromaDark * 0.68, 0.028, 0.082),
    secOk.h,
  );
  const darkOnSecondaryContainer = fitOklchLightness(
    0.91,
    mono ? 0 : clamp(secChromaDark * 0.36, 0.016, 0.048),
    secOk.h,
    darkSecondaryContainer,
    0.015,
    4.8,
    0.12,
    0.96,
  );
  const darkTertiaryContainer = oklchToHex(
    0.35,
    mono ? 0 : clamp(terChromaDark * 0.68, 0.03, 0.09),
    terOk.h,
  );
  const darkOnTertiaryContainer = fitOklchLightness(
    0.91,
    mono ? 0 : clamp(terChromaDark * 0.38, 0.016, 0.052),
    terOk.h,
    darkTertiaryContainer,
    0.015,
    4.8,
    0.12,
    0.96,
  );

  const darkSurfaceContainerHighest = oklchToHex(0.365, clamp(surfC * 1.35, 0, 0.054), hue);
  const darkOnSurfaceVariant = fitOklchLightness(
    0.77,
    varC,
    hue,
    darkSurfaceContainerHighest,
    0.015,
    4.6,
    0.12,
    0.95,
  );
  const darkInverseSurface = oklchToHex(0.9, mono ? 0 : 0.024, hue);
  const darkInverseOnSurface = fitOklchLightness(
    0.22,
    surfC,
    hue,
    darkInverseSurface,
    -0.015,
    4.8,
    0.1,
    0.94,
  );

  const lightPrimaryContainer = oklchToHex(
    0.885,
    mono ? 0 : clamp(pChromaLight * 0.56, 0.035, 0.088),
    hue,
  );
  const lightOnPrimaryContainer = fitOklchLightness(
    0.22,
    mono ? 0 : clamp(pChromaLight * 0.52, 0.025, 0.075),
    hue,
    lightPrimaryContainer,
    -0.015,
    4.8,
    0.1,
    0.92,
  );
  const lightSecondaryContainer = oklchToHex(
    0.895,
    mono ? 0 : clamp(secChromaLight * 0.54, 0.032, 0.076),
    secOk.h,
  );
  const lightOnSecondaryContainer = fitOklchLightness(
    0.23,
    mono ? 0 : clamp(secChromaLight * 0.48, 0.022, 0.068),
    secOk.h,
    lightSecondaryContainer,
    -0.015,
    4.8,
    0.1,
    0.92,
  );
  const lightTertiaryContainer = oklchToHex(
    0.885,
    mono ? 0 : clamp(terChromaLight * 0.56, 0.034, 0.084),
    terOk.h,
  );
  const lightOnTertiaryContainer = fitOklchLightness(
    0.22,
    mono ? 0 : clamp(terChromaLight * 0.5, 0.024, 0.072),
    terOk.h,
    lightTertiaryContainer,
    -0.015,
    4.8,
    0.1,
    0.92,
  );

  const lightSurfaceC = mono ? 0 : clamp(surfC * 0.72, 0.01, 0.028);
  const lightSurfaceContainerHighest = oklchToHex(0.855, clamp(lightSurfaceC * 1.3, 0, 0.038), hue);
  const lightOnSurfaceVariant = fitOklchLightness(
    0.41,
    varC,
    hue,
    lightSurfaceContainerHighest,
    -0.015,
    4.6,
    0.1,
    0.92,
  );
  const lightInverseOnSurface = fitOklchLightness(
    0.95,
    mono ? 0 : 0.016,
    hue,
    lightPrimaryBase,
    0.015,
    4.8,
    0.14,
    0.97,
  );

  return {
    dark: {
      scheme: 'dark',
      primary: darkPrimary,
      onPrimary: darkOnPrimary,
      primaryContainer: darkPrimaryContainer,
      onPrimaryContainer: darkOnPrimaryContainer,
      secondary: darkSecondary,
      onSecondary: darkOnSecondary,
      secondaryContainer: darkSecondaryContainer,
      onSecondaryContainer: darkOnSecondaryContainer,
      tertiary: darkTertiary,
      onTertiary: darkOnTertiary,
      tertiaryContainer: darkTertiaryContainer,
      onTertiaryContainer: darkOnTertiaryContainer,
      error: '#f2b8b5',
      onError: '#601410',
      errorContainer: '#8c1d18',
      onErrorContainer: '#f9dedc',
      surfaceDim: oklchToHex(0.155, clamp(surfC * 0.85, 0, 0.034), hue),
      surface: oklchToHex(0.185, clamp(surfC * 0.95, 0, 0.038), hue),
      surfaceContainerLowest: oklchToHex(0.135, clamp(surfC * 0.8, 0, 0.032), hue),
      surfaceContainerLow: oklchToHex(0.215, clamp(surfC * 1.02, 0, 0.042), hue),
      surfaceContainer: oklchToHex(0.255, clamp(surfC * 1.12, 0, 0.046), hue),
      surfaceContainerHigh: oklchToHex(0.305, clamp(surfC * 1.24, 0, 0.05), hue),
      surfaceContainerHighest: darkSurfaceContainerHighest,
      onSurface: oklchToHex(0.9, mono ? 0 : 0.024, hue),
      onSurfaceVariant: darkOnSurfaceVariant,
      outline: oklchToHex(0.62, mono ? 0 : clamp(varC * 1.4, 0.02, 0.068), hue),
      outlineVariant: oklchToHex(0.35, mono ? 0 : clamp(varC * 1.05, 0.014, 0.046), hue),
      inverseSurface: darkInverseSurface,
      inverseOnSurface: darkInverseOnSurface,
      stateHover: rgba(darkPrimary, 0.16),
      statePressed: rgba(darkPrimary, 0.24),
      scrim: rgba(oklchToHex(0.12, surfC, hue), 0.78),
      elevation1: '0 2px 8px rgba(8, 6, 16, 0.36)',
      elevation2: '0 8px 24px rgba(8, 6, 16, 0.46)',
      elevation3: '0 20px 44px rgba(8, 6, 16, 0.58)',
    },
    light: {
      scheme: 'light',
      primary: lightPrimary,
      onPrimary: lightOnPrimary,
      primaryContainer: lightPrimaryContainer,
      onPrimaryContainer: lightOnPrimaryContainer,
      secondary: lightSecondary,
      onSecondary: lightOnSecondary,
      secondaryContainer: lightSecondaryContainer,
      onSecondaryContainer: lightOnSecondaryContainer,
      tertiary: lightTertiary,
      onTertiary: lightOnTertiary,
      tertiaryContainer: lightTertiaryContainer,
      onTertiaryContainer: lightOnTertiaryContainer,
      error: '#b3261e',
      onError: '#ffffff',
      errorContainer: '#f9dedc',
      onErrorContainer: '#410e0b',
      surfaceDim: oklchToHex(0.895, clamp(lightSurfaceC * 1.1, 0, 0.032), hue),
      surface: oklchToHex(0.965, lightSurfaceC, hue),
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: oklchToHex(0.94, clamp(lightSurfaceC * 1.05, 0, 0.03), hue),
      surfaceContainer: oklchToHex(0.915, clamp(lightSurfaceC * 1.1, 0, 0.032), hue),
      surfaceContainerHigh: oklchToHex(0.885, clamp(lightSurfaceC * 1.2, 0, 0.035), hue),
      surfaceContainerHighest: lightSurfaceContainerHighest,
      onSurface: oklchToHex(0.22, mono ? 0 : 0.03, hue),
      onSurfaceVariant: lightOnSurfaceVariant,
      outline: oklchToHex(0.54, mono ? 0 : clamp(varC * 1.3, 0.018, 0.06), hue),
      outlineVariant: oklchToHex(0.78, mono ? 0 : clamp(varC * 0.95, 0.014, 0.04), hue),
      inverseSurface: lightPrimaryBase,
      inverseOnSurface: lightInverseOnSurface,
      stateHover: rgba(lightPrimaryBase, 0.08),
      statePressed: rgba(lightPrimaryBase, 0.14),
      scrim: rgba(oklchToHex(0.24, surfC, hue), 0.44),
      elevation1: '0 1px 4px rgba(24, 20, 36, 0.1)',
      elevation2: '0 6px 18px rgba(24, 20, 36, 0.14)',
      elevation3: '0 16px 36px rgba(24, 20, 36, 0.2)',
    },
  };
}

const OCTO_LAVENDER = {
  id: DEFAULT_PALETTE,
  label: 'Лаванда Octo',
  dark: {
    scheme: 'dark',
    primary: '#8c84a9',
    onPrimary: '#171422',
    primaryContainer: '#3e3854',
    onPrimaryContainer: '#ddd2e0',
    secondary: '#c5bddb',
    onSecondary: '#1f1b2e',
    secondaryContainer: '#564e70',
    onSecondaryContainer: '#ddd2e0',
    tertiary: '#ddd2e0',
    onTertiary: '#252035',
    tertiaryContainer: '#4c4566',
    onTertiaryContainer: '#ddd2e0',
    error: '#f2b8b5',
    onError: '#601410',
    errorContainer: '#8c1d18',
    onErrorContainer: '#f9dedc',
    surfaceDim: '#13101c',
    surface: '#191624',
    surfaceContainerLowest: '#120f1a',
    surfaceContainerLow: '#211d30',
    surfaceContainer: '#2b263d',
    surfaceContainerHigh: '#3e3854',
    surfaceContainerHighest: '#4c4566',
    onSurface: '#ddd2e0',
    onSurfaceVariant: '#b8aec8',
    outline: '#8c84a9',
    outlineVariant: '#47405e',
    inverseSurface: '#ddd2e0',
    inverseOnSurface: '#252035',
    stateHover: 'rgba(140, 132, 169, 0.16)',
    statePressed: 'rgba(140, 132, 169, 0.24)',
    scrim: 'rgba(14, 12, 22, 0.78)',
    elevation1: '0 2px 8px rgba(8, 6, 16, 0.36)',
    elevation2: '0 8px 24px rgba(8, 6, 16, 0.46)',
    elevation3: '0 20px 44px rgba(8, 6, 16, 0.58)',
  },
  light: {
    scheme: 'light',
    primary: '#564d74',
    onPrimary: '#f6f1f8',
    primaryContainer: '#ddd2e0',
    onPrimaryContainer: '#282338',
    secondary: '#564d74',
    onSecondary: '#f6f1f8',
    secondaryContainer: '#e4dbe9',
    onSecondaryContainer: '#2c263d',
    tertiary: '#3e3854',
    onTertiary: '#ddd2e0',
    tertiaryContainer: '#d4c9dc',
    onTertiaryContainer: '#282338',
    error: '#b3261e',
    onError: '#ffffff',
    errorContainer: '#f9dedc',
    onErrorContainer: '#410e0b',
    surfaceDim: '#ddd2e0',
    surface: '#f6f1f8',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#efe9f3',
    surfaceContainer: '#e9e1ee',
    surfaceContainerHigh: '#e2d8e8',
    surfaceContainerHighest: '#ddd2e0',
    onSurface: '#282338',
    onSurfaceVariant: '#524a6b',
    outline: '#7b7296',
    outlineVariant: '#c7bdd3',
    inverseSurface: '#3e3854',
    inverseOnSurface: '#ddd2e0',
    stateHover: 'rgba(62, 56, 84, 0.08)',
    statePressed: 'rgba(62, 56, 84, 0.14)',
    scrim: 'rgba(40, 35, 56, 0.44)',
    elevation1: '0 1px 4px rgba(40, 35, 56, 0.1)',
    elevation2: '0 6px 18px rgba(40, 35, 56, 0.14)',
    elevation3: '0 16px 36px rgba(40, 35, 56, 0.2)',
  },
};

const PALETTE_SPECS = [
  {
    id: 'violet-iris',
    label: 'Ирис и сирень',
    h: 266,
    s: 58,
    secH: 252,
    secS: 38,
    terH: 304,
    terS: 46,
    surfS: 22,
  },
  {
    id: 'plum-berry',
    label: 'Сливовый бархат',
    h: 294,
    s: 46,
    secH: 278,
    secS: 34,
    terH: 336,
    terS: 52,
    surfS: 20,
  },
  {
    id: 'sakura-rose',
    label: 'Сакура',
    h: 336,
    s: 56,
    secH: 348,
    secS: 40,
    terH: 18,
    terS: 56,
    surfS: 18,
  },
  {
    id: 'crimson-ruby',
    label: 'Рубин и терракота',
    h: 354,
    s: 60,
    secH: 8,
    secS: 44,
    terH: 30,
    terS: 54,
    surfS: 18,
  },
  {
    id: 'coral-sunset',
    label: 'Коралловый закат',
    h: 14,
    s: 64,
    secH: 26,
    secS: 46,
    terH: 44,
    terS: 58,
    surfS: 18,
  },
  {
    id: 'amber-honey',
    label: 'Янтарный мёд',
    h: 36,
    s: 62,
    secH: 24,
    secS: 42,
    terH: 10,
    terS: 52,
    surfS: 16,
  },
  {
    id: 'sunflower-ochre',
    label: 'Охра и шафран',
    h: 48,
    s: 58,
    secH: 60,
    secS: 38,
    terH: 92,
    terS: 44,
    surfS: 15,
  },
  {
    id: 'olive-matcha',
    label: 'Матча и шалфей',
    h: 96,
    s: 38,
    secH: 112,
    secS: 30,
    terH: 52,
    terS: 44,
    surfS: 15,
  },
  {
    id: 'emerald-forest',
    label: 'Изумрудный лес',
    h: 148,
    s: 46,
    secH: 162,
    secS: 36,
    terH: 182,
    terS: 48,
    surfS: 17,
  },
  {
    id: 'mint-jade',
    label: 'Мята и нефрит',
    h: 164,
    s: 50,
    secH: 178,
    secS: 38,
    terH: 198,
    terS: 50,
    surfS: 16,
  },
  {
    id: 'teal-lagoon',
    label: 'Бирюзовая лагуна',
    h: 180,
    s: 52,
    secH: 168,
    secS: 38,
    terH: 144,
    terS: 44,
    surfS: 18,
  },
  {
    id: 'cyan-glacier',
    label: 'Ледяной циан',
    h: 196,
    s: 56,
    secH: 208,
    secS: 40,
    terH: 226,
    terS: 48,
    surfS: 18,
  },
  {
    id: 'sky-cerulean',
    label: 'Небесный лазурит',
    h: 210,
    s: 62,
    secH: 222,
    secS: 42,
    terH: 254,
    terS: 48,
    surfS: 19,
  },
  {
    id: 'cobalt-ocean',
    label: 'Глубокий океан',
    h: 224,
    s: 60,
    secH: 210,
    secS: 42,
    terH: 186,
    terS: 50,
    surfS: 20,
  },
  {
    id: 'indigo-midnight',
    label: 'Полночный индиго',
    h: 240,
    s: 56,
    secH: 256,
    secS: 40,
    terH: 280,
    terS: 48,
    surfS: 22,
  },
  {
    id: 'slate-steel',
    label: 'Холодный сланец',
    h: 214,
    s: 26,
    secH: 202,
    secS: 22,
    terH: 184,
    terS: 28,
    surfS: 12,
  },
  {
    id: 'mocha-espresso',
    label: 'Мокко и какао',
    h: 26,
    s: 34,
    secH: 34,
    secS: 28,
    terH: 46,
    terS: 42,
    surfS: 14,
  },
  {
    id: 'sand-clay',
    label: 'Тёплая глина',
    h: 18,
    s: 40,
    secH: 28,
    secS: 32,
    terH: 96,
    terS: 32,
    surfS: 14,
  },
  {
    id: 'graphite-mono',
    label: 'Графит',
    h: 240,
    s: 0,
    secH: 240,
    secS: 0,
    terH: 240,
    terS: 0,
    surfS: 0,
    mono: true,
  },
];

const PALETTES = [
  OCTO_LAVENDER,
  ...PALETTE_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    ...buildScheme(spec),
  })),
];

function mixHex(aHex, bHex, weightA = 0.5) {
  const [ar, ag, ab] = hexToRgb(aHex);
  const [br, bg, bb] = hexToRgb(bHex);
  const w = clamp(weightA, 0, 1);
  const ch = (a, b) =>
    Math.round(a * w + b * (1 - w))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

function bestOnColor(bgHex, h, c, mono) {
  const darkCandidate = oklchToHex(0.16, mono ? 0 : clamp(c * 0.35, 0.01, 0.036), h);
  const lightCandidate = '#ffffff';
  const darkRatio = contrastRatio(bgHex, darkCandidate);
  const lightRatio = contrastRatio(bgHex, lightCandidate);
  if (Math.max(darkRatio, lightRatio) >= 4.5) {
    return darkRatio >= lightRatio ? darkCandidate : lightCandidate;
  }
  return contrastRatio(bgHex, '#000000') >= lightRatio ? '#000000' : lightCandidate;
}

function resolveAccentPair(customHex, okH, okC, defaultL, mono, isDark) {
  if (customHex) {
    const ch = hexToOklch(customHex);
    const cMono = ch.c < 0.02;
    const color = customHex;
    const onColor = bestOnColor(color, ch.h, ch.c, cMono);
    const containerL = isDark ? 0.32 : 0.885;
    const containerC = cMono ? 0 : clamp(ch.c * 0.56, 0.028, 0.09);
    const container = oklchToHex(containerL, containerC, ch.h);
    const onContainer = fitOklchLightness(
      isDark ? 0.91 : 0.22,
      cMono ? 0 : clamp(ch.c * 0.42, 0.018, 0.068),
      ch.h,
      container,
      isDark ? 0.015 : -0.015,
      4.8,
      0.1,
      0.96,
    );
    return {
      color,
      onColor,
      container,
      onContainer,
    };
  }
  const on = isDark
    ? oklchToHex(0.19, mono ? 0 : clamp(okC * 0.38, 0.01, 0.042), okH)
    : oklchToHex(0.985, mono ? 0 : 0.012, okH);
  const color = fitOklchLightness(
    defaultL,
    mono ? 0 : clamp(okC, 0.045, 0.145),
    okH,
    on,
    isDark ? 0.015 : -0.015,
  );
  const container = oklchToHex(
    isDark ? 0.34 : 0.89,
    mono ? 0 : clamp(okC * 0.58, 0.028, 0.085),
    okH,
  );
  return {
    color,
    onColor: on,
    container,
    onContainer: fitOklchLightness(
      isDark ? 0.91 : 0.22,
      mono ? 0 : clamp(okC * 0.42, 0.018, 0.065),
      okH,
      container,
      isDark ? 0.015 : -0.015,
      4.8,
      0.1,
      0.96,
    ),
  };
}

function buildCustomScheme(customRaw) {
  const custom = normalizeCustomTheme(customRaw);
  const p = hexToOklch(custom.primary);
  const mono = p.c < 0.02;
  const secOk = custom.secondary
    ? hexToOklch(custom.secondary)
    : { h: (p.h + 34) % 360, c: mono ? 0 : clamp(p.c * 0.72, 0.04, 0.115), l: 0.65 };
  const terOk = custom.tertiary
    ? hexToOklch(custom.tertiary)
    : { h: (p.h + 78) % 360, c: mono ? 0 : clamp(p.c * 0.84, 0.045, 0.13), l: 0.65 };
  const surfOk = custom.surface ? hexToOklch(custom.surface) : p;
  const surfHsl = custom.surface ? hexToHsl(custom.surface) : hexToHsl(custom.primary);
  const surfMono = custom.surface ? surfOk.c < 0.016 : mono;
  const neutralC = surfMono ? 0 : clamp(custom.surface ? surfOk.c : p.c * 0.26, 0.012, 0.044);
  const varC = surfMono ? 0 : clamp(p.c * 0.3, 0.014, 0.048);

  const darkPrimaryPair = resolveAccentPair(custom.primary, p.h, p.c, 0.76, mono, true);
  const darkSecondaryPair = resolveAccentPair(
    custom.secondary,
    secOk.h,
    secOk.c,
    0.8,
    secOk.c < 0.02,
    true,
  );
  const darkTertiaryPair = resolveAccentPair(
    custom.tertiary,
    terOk.h,
    terOk.c,
    0.82,
    terOk.c < 0.02,
    true,
  );

  const lightPrimaryPair = resolveAccentPair(custom.primary, p.h, p.c, 0.47, mono, false);
  const lightSecondaryPair = resolveAccentPair(
    custom.secondary,
    secOk.h,
    secOk.c,
    0.48,
    secOk.c < 0.02,
    false,
  );
  const lightTertiaryPair = resolveAccentPair(
    custom.tertiary,
    terOk.h,
    terOk.c,
    0.46,
    terOk.c < 0.02,
    false,
  );

  const useExactDarkSurface = Boolean(custom.surface) && surfHsl.l <= 24;
  const darkBaseL = useExactDarkSurface ? clamp(surfOk.l, 0.06, 0.34) : 0.185;
  const darkSurface = useExactDarkSurface
    ? custom.surface
    : oklchToHex(darkBaseL, neutralC, surfOk.h);

  const useExactLightSurface = Boolean(custom.surface) && surfHsl.l >= 80;
  const lightBaseL = useExactLightSurface ? clamp(surfOk.l, 0.86, 0.99) : 0.965;
  const lightSurfaceC = surfMono ? 0 : clamp(neutralC * 0.75, 0.01, 0.03);
  const lightSurface = useExactLightSurface
    ? custom.surface
    : oklchToHex(lightBaseL, lightSurfaceC, surfOk.h);

  const darkSurfaceContainerHighest = oklchToHex(
    clamp(darkBaseL + 0.18, 0.28, 0.44),
    clamp(neutralC * 1.3, 0, 0.052),
    surfOk.h,
  );
  const lightSurfaceContainerHighest = oklchToHex(
    clamp(lightBaseL - 0.11, 0.78, 0.9),
    clamp(lightSurfaceC * 1.3, 0, 0.038),
    surfOk.h,
  );

  const defaultDarkText = fitOklchLightness(
    0.9,
    surfMono ? 0 : 0.024,
    surfOk.h,
    darkSurfaceContainerHighest,
    0.015,
    5.5,
    0.12,
    0.96,
  );
  const defaultLightText = fitOklchLightness(
    0.22,
    surfMono ? 0 : 0.03,
    surfOk.h,
    lightSurfaceContainerHighest,
    -0.015,
    5.5,
    0.1,
    0.94,
  );
  const darkOnSurface =
    custom.text && contrastRatio(custom.text, darkSurfaceContainerHighest) >= 4.5
      ? custom.text
      : defaultDarkText;
  const lightOnSurface =
    custom.text && contrastRatio(custom.text, lightSurfaceContainerHighest) >= 4.5
      ? custom.text
      : defaultLightText;
  const darkVarCandidate = custom.text ? mixHex(darkOnSurface, darkSurface, 0.78) : '';
  const darkOnSurfaceVariant =
    darkVarCandidate && contrastRatio(darkVarCandidate, darkSurfaceContainerHighest) >= 4.5
      ? darkVarCandidate
      : fitOklchLightness(
          0.77,
          varC,
          surfOk.h,
          darkSurfaceContainerHighest,
          0.015,
          4.6,
          0.12,
          0.95,
        );
  const lightVarCandidate = custom.text ? mixHex(lightOnSurface, lightSurface, 0.78) : '';
  const lightOnSurfaceVariant =
    lightVarCandidate && contrastRatio(lightVarCandidate, lightSurfaceContainerHighest) >= 4.5
      ? lightVarCandidate
      : fitOklchLightness(
          0.41,
          varC,
          surfOk.h,
          lightSurfaceContainerHighest,
          -0.015,
          4.6,
          0.1,
          0.92,
        );
  const lightPrimaryBase = oklchToHex(0.39, mono ? 0 : clamp(p.c * 1.05, 0.045, 0.15), p.h);
  const darkInverseOnSurface = fitOklchLightness(
    0.22,
    neutralC,
    surfOk.h,
    darkOnSurface,
    -0.015,
    4.8,
    0.1,
    0.94,
  );
  const lightInverseOnSurface = fitOklchLightness(
    0.95,
    surfMono ? 0 : 0.018,
    surfOk.h,
    lightPrimaryBase,
    0.015,
    4.8,
    0.14,
    0.97,
  );

  return {
    dark: {
      scheme: 'dark',
      primary: darkPrimaryPair.color,
      onPrimary: darkPrimaryPair.onColor,
      primaryContainer: darkPrimaryPair.container,
      onPrimaryContainer: darkPrimaryPair.onContainer,
      secondary: darkSecondaryPair.color,
      onSecondary: darkSecondaryPair.onColor,
      secondaryContainer: darkSecondaryPair.container,
      onSecondaryContainer: darkSecondaryPair.onContainer,
      tertiary: darkTertiaryPair.color,
      onTertiary: darkTertiaryPair.onColor,
      tertiaryContainer: darkTertiaryPair.container,
      onTertiaryContainer: darkTertiaryPair.onContainer,
      error: '#f2b8b5',
      onError: '#601410',
      errorContainer: '#8c1d18',
      onErrorContainer: '#f9dedc',
      surfaceDim: oklchToHex(clamp(darkBaseL - 0.03, 0.05, 0.24), neutralC, surfOk.h),
      surface: darkSurface,
      surfaceContainerLowest: oklchToHex(clamp(darkBaseL - 0.05, 0.04, 0.22), neutralC, surfOk.h),
      surfaceContainerLow: oklchToHex(clamp(darkBaseL + 0.035, 0.1, 0.34), neutralC, surfOk.h),
      surfaceContainer: oklchToHex(clamp(darkBaseL + 0.07, 0.14, 0.37), neutralC, surfOk.h),
      surfaceContainerHigh: oklchToHex(clamp(darkBaseL + 0.12, 0.19, 0.41), neutralC, surfOk.h),
      surfaceContainerHighest: darkSurfaceContainerHighest,
      onSurface: darkOnSurface,
      onSurfaceVariant: darkOnSurfaceVariant,
      outline: oklchToHex(0.62, surfMono ? 0 : clamp(varC * 1.35, 0.02, 0.068), surfOk.h),
      outlineVariant: oklchToHex(0.35, varC, surfOk.h),
      inverseSurface: darkOnSurface,
      inverseOnSurface: darkInverseOnSurface,
      stateHover: rgba(darkPrimaryPair.color, 0.16),
      statePressed: rgba(darkPrimaryPair.color, 0.24),
      scrim: rgba(oklchToHex(0.12, neutralC, surfOk.h), 0.78),
      elevation1: '0 2px 8px rgba(8, 6, 16, 0.36)',
      elevation2: '0 8px 24px rgba(8, 6, 16, 0.46)',
      elevation3: '0 20px 44px rgba(8, 6, 16, 0.58)',
    },
    light: {
      scheme: 'light',
      primary: lightPrimaryPair.color,
      onPrimary: lightPrimaryPair.onColor,
      primaryContainer: lightPrimaryPair.container,
      onPrimaryContainer: lightPrimaryPair.onContainer,
      secondary: lightSecondaryPair.color,
      onSecondary: lightSecondaryPair.onColor,
      secondaryContainer: lightSecondaryPair.container,
      onSecondaryContainer: lightSecondaryPair.onContainer,
      tertiary: lightTertiaryPair.color,
      onTertiary: lightTertiaryPair.onColor,
      tertiaryContainer: lightTertiaryPair.container,
      onTertiaryContainer: lightTertiaryPair.onContainer,
      error: '#b3261e',
      onError: '#ffffff',
      errorContainer: '#f9dedc',
      onErrorContainer: '#410e0b',
      surfaceDim: oklchToHex(clamp(lightBaseL - 0.07, 0.8, 0.92), lightSurfaceC, surfOk.h),
      surface: lightSurface,
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: oklchToHex(
        clamp(lightBaseL - 0.025, 0.85, 0.97),
        lightSurfaceC,
        surfOk.h,
      ),
      surfaceContainer: oklchToHex(
        clamp(lightBaseL - 0.05, 0.82, 0.95),
        clamp(lightSurfaceC * 1.1, 0, 0.032),
        surfOk.h,
      ),
      surfaceContainerHigh: oklchToHex(
        clamp(lightBaseL - 0.08, 0.79, 0.92),
        clamp(lightSurfaceC * 1.2, 0, 0.035),
        surfOk.h,
      ),
      surfaceContainerHighest: lightSurfaceContainerHighest,
      onSurface: lightOnSurface,
      onSurfaceVariant: lightOnSurfaceVariant,
      outline: oklchToHex(0.54, surfMono ? 0 : clamp(varC * 1.25, 0.018, 0.06), surfOk.h),
      outlineVariant: oklchToHex(0.78, varC, surfOk.h),
      inverseSurface: lightPrimaryBase,
      inverseOnSurface: lightInverseOnSurface,
      stateHover: rgba(lightPrimaryBase, 0.08),
      statePressed: rgba(lightPrimaryBase, 0.14),
      scrim: rgba(oklchToHex(0.24, neutralC, surfOk.h), 0.44),
      elevation1: '0 1px 4px rgba(24, 20, 36, 0.1)',
      elevation2: '0 6px 18px rgba(24, 20, 36, 0.14)',
      elevation3: '0 16px 36px rgba(24, 20, 36, 0.2)',
    },
  };
}

const PALETTE_MAP = new Map(PALETTES.map((item) => [item.id, item]));

function normalizePaletteId(id) {
  if (id === CUSTOM_PALETTE_ID) return CUSTOM_PALETTE_ID;
  return PALETTE_MAP.has(id) ? id : DEFAULT_PALETTE;
}

function getPalette(id, customRaw = null) {
  const normalized = normalizePaletteId(id);
  if (normalized === CUSTOM_PALETTE_ID) {
    return {
      id: CUSTOM_PALETTE_ID,
      label: 'Свой цвет',
      ...buildCustomScheme(customRaw),
    };
  }
  return PALETTE_MAP.get(normalized);
}

function applyAmoledTokens(tokens) {
  if (!tokens || tokens.scheme !== 'dark') return tokens;
  return {
    ...tokens,
    surfaceDim: '#000000',
    surface: '#000000',
    surfaceContainerLowest: '#000000',
    surfaceContainerLow: '#08080a',
    surfaceContainer: '#111115',
    surfaceContainerHigh: '#1a1a20',
    surfaceContainerHighest: '#23232b',
    scrim: 'rgba(0, 0, 0, 0.88)',
    elevation1: '0 2px 8px rgba(0, 0, 0, 0.72)',
    elevation2: '0 8px 24px rgba(0, 0, 0, 0.82)',
    elevation3: '0 20px 44px rgba(0, 0, 0, 0.9)',
  };
}

function getPaletteTokens(id, dark = true, customRaw = null, options = {}) {
  let custom = customRaw;
  let opts = options;
  if (
    customRaw &&
    typeof customRaw === 'object' &&
    'amoled' in customRaw &&
    !('primary' in customRaw)
  ) {
    opts = customRaw;
    custom = null;
  }
  const palette = getPalette(id, custom);
  if (!dark) return palette.light;
  return opts && opts.amoled ? applyAmoledTokens(palette.dark) : palette.dark;
}

/**
 * Динамические MD3-токены для режима переливания цветов.
 *
 * Используют перцептивно равномерный OKLCH с общим углом `--octo-hue`,
 * поэтому яркость и контраст текста остаются стабильными на всём спектре.
 */
function getIridescentCssTokens(dark = true, options = {}) {
  const hue = 'var(--octo-hue, 260)';
  const secHue = `calc(${hue} + 38)`;
  const terHue = `calc(${hue} + 86)`;

  const tokens = dark
    ? {
        scheme: 'dark',
        primary: `oklch(0.76 0.13 ${hue})`,
        onPrimary: `oklch(0.18 0.04 ${hue})`,
        primaryContainer: `oklch(0.32 0.08 ${hue})`,
        onPrimaryContainer: `oklch(0.90 0.045 ${hue})`,
        secondary: `oklch(0.80 0.095 ${secHue})`,
        onSecondary: `oklch(0.19 0.035 ${secHue})`,
        secondaryContainer: `oklch(0.38 0.07 ${secHue})`,
        onSecondaryContainer: `oklch(0.91 0.04 ${secHue})`,
        tertiary: `oklch(0.82 0.115 ${terHue})`,
        onTertiary: `oklch(0.21 0.04 ${terHue})`,
        tertiaryContainer: `oklch(0.36 0.08 ${terHue})`,
        onTertiaryContainer: `oklch(0.91 0.045 ${terHue})`,
        error: '#f2b8b5',
        onError: '#601410',
        errorContainer: '#8c1d18',
        onErrorContainer: '#f9dedc',
        surfaceDim: `oklch(0.16 0.024 ${hue})`,
        surface: `oklch(0.19 0.028 ${hue})`,
        surfaceContainerLowest: `oklch(0.14 0.022 ${hue})`,
        surfaceContainerLow: `oklch(0.22 0.030 ${hue})`,
        surfaceContainer: `oklch(0.26 0.034 ${hue})`,
        surfaceContainerHigh: `oklch(0.32 0.042 ${hue})`,
        surfaceContainerHighest: `oklch(0.38 0.048 ${hue})`,
        onSurface: `oklch(0.90 0.024 ${hue})`,
        onSurfaceVariant: `oklch(0.77 0.036 ${hue})`,
        outline: `oklch(0.64 0.065 ${hue})`,
        outlineVariant: `oklch(0.36 0.038 ${hue})`,
        inverseSurface: `oklch(0.90 0.024 ${hue})`,
        inverseOnSurface: `oklch(0.22 0.030 ${hue})`,
        stateHover: `oklch(0.76 0.13 ${hue} / 0.16)`,
        statePressed: `oklch(0.76 0.13 ${hue} / 0.24)`,
        scrim: 'rgba(14, 12, 22, 0.78)',
        elevation1: '0 2px 8px rgba(8, 6, 16, 0.36)',
        elevation2: '0 8px 24px rgba(8, 6, 16, 0.46)',
        elevation3: '0 20px 44px rgba(8, 6, 16, 0.58)',
      }
    : {
        scheme: 'light',
        primary: `oklch(0.47 0.15 ${hue})`,
        onPrimary: `oklch(0.98 0.01 ${hue})`,
        primaryContainer: `oklch(0.89 0.06 ${hue})`,
        onPrimaryContainer: `oklch(0.22 0.06 ${hue})`,
        secondary: `oklch(0.48 0.11 ${secHue})`,
        onSecondary: `oklch(0.98 0.01 ${secHue})`,
        secondaryContainer: `oklch(0.90 0.05 ${secHue})`,
        onSecondaryContainer: `oklch(0.23 0.055 ${secHue})`,
        tertiary: `oklch(0.46 0.12 ${terHue})`,
        onTertiary: `oklch(0.98 0.01 ${terHue})`,
        tertiaryContainer: `oklch(0.89 0.065 ${terHue})`,
        onTertiaryContainer: `oklch(0.22 0.06 ${terHue})`,
        error: '#b3261e',
        onError: '#ffffff',
        errorContainer: '#f9dedc',
        onErrorContainer: '#410e0b',
        surfaceDim: `oklch(0.89 0.022 ${hue})`,
        surface: `oklch(0.96 0.014 ${hue})`,
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: `oklch(0.935 0.018 ${hue})`,
        surfaceContainer: `oklch(0.91 0.022 ${hue})`,
        surfaceContainerHigh: `oklch(0.88 0.028 ${hue})`,
        surfaceContainerHighest: `oklch(0.85 0.034 ${hue})`,
        onSurface: `oklch(0.22 0.030 ${hue})`,
        onSurfaceVariant: `oklch(0.41 0.045 ${hue})`,
        outline: `oklch(0.54 0.055 ${hue})`,
        outlineVariant: `oklch(0.78 0.035 ${hue})`,
        inverseSurface: `oklch(0.28 0.045 ${hue})`,
        inverseOnSurface: `oklch(0.95 0.015 ${hue})`,
        stateHover: `oklch(0.47 0.15 ${hue} / 0.08)`,
        statePressed: `oklch(0.47 0.15 ${hue} / 0.14)`,
        scrim: 'rgba(40, 35, 56, 0.44)',
        elevation1: '0 1px 4px rgba(24, 20, 36, 0.1)',
        elevation2: '0 6px 18px rgba(24, 20, 36, 0.14)',
        elevation3: '0 16px 36px rgba(24, 20, 36, 0.2)',
      };

  return dark && options && options.amoled ? applyAmoledTokens(tokens) : tokens;
}

function listPalettes() {
  return PALETTES.map((item) => ({
    id: item.id,
    label: item.label,
    dark: item.dark,
    light: item.light,
    amoled: applyAmoledTokens(item.dark),
  }));
}

module.exports = {
  DEFAULT_PALETTE,
  CUSTOM_PALETTE_ID,
  DEFAULT_CUSTOM_THEME,
  DEFAULT_RAINBOW_CONFIG,
  RAINBOW_PRESETS,
  PALETTES,
  normalizeHex,
  normalizeCustomTheme,
  normalizeRainbowConfig,
  normalizePaletteId,
  buildCustomScheme,
  applyAmoledTokens,
  getPalette,
  getPaletteTokens,
  getIridescentCssTokens,
  listPalettes,
};
