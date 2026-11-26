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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function fitLightness(hue, sat, startLight, fgHex, step, minRatio = 4.8) {
  let l = startLight;
  for (let i = 0; i < 40; i += 1) {
    const candidate = hslToHex(hue, sat, l);
    if (contrastRatio(candidate, fgHex) >= minRatio) return candidate;
    l = clamp(l + step, 14, 88);
  }
  return hslToHex(hue, sat, l);
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildScheme(spec) {
  const { h, s, secH, secS, terH, terS, surfS, mono } = spec;
  const neutralS = mono ? 0 : Math.max(6, Math.min(26, surfS));
  const variantS = mono ? 0 : Math.max(8, Math.min(34, Math.round(s * 0.42)));

  const darkOnPrimary = hslToHex(h, clamp(s * 0.65, 0, 48), 11);
  const darkPrimary = fitLightness(h, s, 68, darkOnPrimary, 1.5);
  const darkOnSecondary = hslToHex(secH, clamp(secS * 0.55, 0, 42), 14);
  const darkSecondary = fitLightness(secH, secS, 80, darkOnSecondary, 1.5);
  const darkOnTertiary = hslToHex(terH, clamp(terS * 0.55, 0, 42), 16);
  const darkTertiary = fitLightness(terH, terS, 83, darkOnTertiary, 1.5);
  const darkSurface = hslToHex(h, neutralS, 11);

  const lightOnPrimary = hslToHex(h, mono ? 0 : 28, 97);
  const lightPrimary = fitLightness(h, clamp(s + 8, 0, 74), 39, lightOnPrimary, -1.5);
  const lightOnSecondary = hslToHex(secH, mono ? 0 : 28, 97);
  const lightSecondary = fitLightness(secH, clamp(secS + 4, 0, 62), 40, lightOnSecondary, -1.5);
  const lightOnTertiary = hslToHex(terH, mono ? 0 : 28, 97);
  const lightTertiary = fitLightness(terH, clamp(terS + 4, 0, 64), 38, lightOnTertiary, -1.5);
  const lightPrimaryBase = hslToHex(h, clamp(s + 6, 0, 70), 31);

  return {
    dark: {
      scheme: 'dark',
      primary: darkPrimary,
      onPrimary: darkOnPrimary,
      primaryContainer: hslToHex(h, clamp(s * 0.62, 0, 42), 27),
      onPrimaryContainer: hslToHex(h, clamp(s * 0.55, 0, 48), 89),
      secondary: darkSecondary,
      onSecondary: darkOnSecondary,
      secondaryContainer: hslToHex(secH, clamp(secS * 0.55, 0, 38), 37),
      onSecondaryContainer: hslToHex(secH, clamp(secS * 0.55, 0, 48), 90),
      tertiary: darkTertiary,
      onTertiary: darkOnTertiary,
      tertiaryContainer: hslToHex(terH, clamp(terS * 0.58, 0, 40), 33),
      onTertiaryContainer: hslToHex(terH, clamp(terS * 0.55, 0, 48), 90),
      error: '#f2b8b5',
      onError: '#601410',
      errorContainer: '#8c1d18',
      onErrorContainer: '#f9dedc',
      surfaceDim: hslToHex(h, neutralS, 8.5),
      surface: darkSurface,
      surfaceContainerLowest: hslToHex(h, neutralS, 7.5),
      surfaceContainerLow: hslToHex(h, neutralS, 15),
      surfaceContainer: hslToHex(h, neutralS, 19),
      surfaceContainerHigh: hslToHex(h, neutralS, 27),
      surfaceContainerHighest: hslToHex(h, neutralS, 34),
      onSurface: hslToHex(h, mono ? 0 : 22, 88),
      onSurfaceVariant: hslToHex(h, variantS, 73),
      outline: hslToHex(h, variantS, 58),
      outlineVariant: hslToHex(h, variantS, 31),
      inverseSurface: hslToHex(h, mono ? 0 : 22, 88),
      inverseOnSurface: hslToHex(h, neutralS, 16),
      stateHover: rgba(darkPrimary, 0.16),
      statePressed: rgba(darkPrimary, 0.24),
      scrim: rgba(hslToHex(h, neutralS, 6), 0.78),
      elevation1: '0 2px 8px rgba(8, 6, 16, 0.36)',
      elevation2: '0 8px 24px rgba(8, 6, 16, 0.46)',
      elevation3: '0 20px 44px rgba(8, 6, 16, 0.58)',
    },
    light: {
      scheme: 'light',
      primary: lightPrimary,
      onPrimary: lightOnPrimary,
      primaryContainer: hslToHex(h, clamp(s * 0.72, 0, 56), 86),
      onPrimaryContainer: hslToHex(h, clamp(s * 0.72, 0, 52), 18),
      secondary: lightSecondary,
      onSecondary: lightOnSecondary,
      secondaryContainer: hslToHex(secH, clamp(secS * 0.72, 0, 54), 88),
      onSecondaryContainer: hslToHex(secH, clamp(secS * 0.72, 0, 50), 20),
      tertiary: lightTertiary,
      onTertiary: lightOnTertiary,
      tertiaryContainer: hslToHex(terH, clamp(terS * 0.76, 0, 56), 86),
      onTertiaryContainer: hslToHex(terH, clamp(terS * 0.74, 0, 50), 19),
      error: '#b3261e',
      onError: '#ffffff',
      errorContainer: '#f9dedc',
      onErrorContainer: '#410e0b',
      surfaceDim: hslToHex(h, mono ? 0 : 20, 86),
      surface: hslToHex(h, mono ? 0 : 32, 96),
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: hslToHex(h, mono ? 0 : 28, 93.5),
      surfaceContainer: hslToHex(h, mono ? 0 : 26, 91),
      surfaceContainerHigh: hslToHex(h, mono ? 0 : 24, 88),
      surfaceContainerHighest: hslToHex(h, mono ? 0 : 22, 85),
      onSurface: hslToHex(h, mono ? 0 : 24, 18),
      onSurfaceVariant: hslToHex(h, variantS, 36),
      outline: hslToHex(h, variantS, 51),
      outlineVariant: hslToHex(h, variantS, 78),
      inverseSurface: lightPrimaryBase,
      inverseOnSurface: hslToHex(h, mono ? 0 : 24, 92),
      stateHover: rgba(lightPrimaryBase, 0.08),
      statePressed: rgba(lightPrimaryBase, 0.14),
      scrim: rgba(hslToHex(h, neutralS, 18), 0.44),
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

const PALETTE_MAP = new Map(PALETTES.map((item) => [item.id, item]));

function normalizePaletteId(id) {
  return PALETTE_MAP.has(id) ? id : DEFAULT_PALETTE;
}

function getPalette(id) {
  return PALETTE_MAP.get(normalizePaletteId(id));
}

function getPaletteTokens(id, dark = true) {
  const palette = getPalette(id);
  return dark ? palette.dark : palette.light;
}

function listPalettes() {
  return PALETTES.map((item) => ({
    id: item.id,
    label: item.label,
    dark: item.dark,
    light: item.light,
  }));
}

module.exports = {
  DEFAULT_PALETTE,
  PALETTES,
  normalizePaletteId,
  getPalette,
  getPaletteTokens,
  listPalettes,
};
