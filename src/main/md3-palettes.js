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

function fitLightness(hue, sat, startLight, fgHex, step, minRatio = 4.8, minL = 14, maxL = 88) {
  let l = startLight;
  for (let i = 0; i < 60; i += 1) {
    const candidate = hslToHex(hue, sat, l);
    if (contrastRatio(candidate, fgHex) >= minRatio) return candidate;
    const next = clamp(l + step, minL, maxL);
    if (next === l) break;
    l = next;
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

  const darkPrimaryContainer = hslToHex(h, clamp(s * 0.62, 0, 42), 27);
  const darkOnPrimaryContainer = fitLightness(
    h,
    clamp(s * 0.55, 0, 48),
    89,
    darkPrimaryContainer,
    1.5,
    4.8,
    8,
    95,
  );
  const darkSecondaryContainer = hslToHex(secH, clamp(secS * 0.55, 0, 38), 37);
  const darkOnSecondaryContainer = fitLightness(
    secH,
    clamp(secS * 0.55, 0, 48),
    90,
    darkSecondaryContainer,
    1.5,
    4.8,
    8,
    95,
  );
  const darkTertiaryContainer = hslToHex(terH, clamp(terS * 0.58, 0, 40), 33);
  const darkOnTertiaryContainer = fitLightness(
    terH,
    clamp(terS * 0.55, 0, 48),
    90,
    darkTertiaryContainer,
    1.5,
    4.8,
    8,
    95,
  );
  const darkSurfaceContainerHighest = hslToHex(h, neutralS, 34);
  const darkOnSurfaceVariant = fitLightness(
    h,
    variantS,
    73,
    darkSurfaceContainerHighest,
    1.5,
    4.6,
    8,
    94,
  );
  const darkInverseSurface = hslToHex(h, mono ? 0 : 22, 88);
  const darkInverseOnSurface = fitLightness(h, neutralS, 16, darkInverseSurface, -1.5, 4.8, 6, 94);

  const lightPrimaryContainer = hslToHex(h, clamp(s * 0.72, 0, 56), 86);
  const lightOnPrimaryContainer = fitLightness(
    h,
    clamp(s * 0.72, 0, 52),
    18,
    lightPrimaryContainer,
    -1.5,
    4.8,
    6,
    92,
  );
  const lightSecondaryContainer = hslToHex(secH, clamp(secS * 0.72, 0, 54), 88);
  const lightOnSecondaryContainer = fitLightness(
    secH,
    clamp(secS * 0.72, 0, 50),
    20,
    lightSecondaryContainer,
    -1.5,
    4.8,
    6,
    92,
  );
  const lightTertiaryContainer = hslToHex(terH, clamp(terS * 0.76, 0, 56), 86);
  const lightOnTertiaryContainer = fitLightness(
    terH,
    clamp(terS * 0.74, 0, 50),
    19,
    lightTertiaryContainer,
    -1.5,
    4.8,
    6,
    92,
  );
  const lightSurfaceContainerHighest = hslToHex(h, mono ? 0 : 22, 85);
  const lightOnSurfaceVariant = fitLightness(
    h,
    variantS,
    36,
    lightSurfaceContainerHighest,
    -1.5,
    4.6,
    6,
    92,
  );
  const lightInverseOnSurface = fitLightness(
    h,
    mono ? 0 : 24,
    92,
    lightPrimaryBase,
    1.5,
    4.8,
    10,
    97,
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
      surfaceDim: hslToHex(h, neutralS, 8.5),
      surface: darkSurface,
      surfaceContainerLowest: hslToHex(h, neutralS, 7.5),
      surfaceContainerLow: hslToHex(h, neutralS, 15),
      surfaceContainer: hslToHex(h, neutralS, 19),
      surfaceContainerHigh: hslToHex(h, neutralS, 27),
      surfaceContainerHighest: darkSurfaceContainerHighest,
      onSurface: hslToHex(h, mono ? 0 : 22, 88),
      onSurfaceVariant: darkOnSurfaceVariant,
      outline: hslToHex(h, variantS, 58),
      outlineVariant: hslToHex(h, variantS, 31),
      inverseSurface: darkInverseSurface,
      inverseOnSurface: darkInverseOnSurface,
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
      surfaceDim: hslToHex(h, mono ? 0 : 20, 86),
      surface: hslToHex(h, mono ? 0 : 32, 96),
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: hslToHex(h, mono ? 0 : 28, 93.5),
      surfaceContainer: hslToHex(h, mono ? 0 : 26, 91),
      surfaceContainerHigh: hslToHex(h, mono ? 0 : 24, 88),
      surfaceContainerHighest: lightSurfaceContainerHighest,
      onSurface: hslToHex(h, mono ? 0 : 24, 18),
      onSurfaceVariant: lightOnSurfaceVariant,
      outline: hslToHex(h, variantS, 51),
      outlineVariant: hslToHex(h, variantS, 78),
      inverseSurface: lightPrimaryBase,
      inverseOnSurface: lightInverseOnSurface,
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

function bestOnColor(bgHex, h, s, mono) {
  const darkCandidate = hslToHex(h, mono ? 0 : clamp(s * 0.45, 0, 36), 7);
  const lightCandidate = '#ffffff';
  const darkRatio = contrastRatio(bgHex, darkCandidate);
  const lightRatio = contrastRatio(bgHex, lightCandidate);
  if (Math.max(darkRatio, lightRatio) >= 4.5) {
    return darkRatio >= lightRatio ? darkCandidate : lightCandidate;
  }
  return contrastRatio(bgHex, '#000000') >= lightRatio ? '#000000' : lightCandidate;
}

function resolveAccentPair(customHex, h, s, defaultLight, mono, isDark) {
  if (customHex) {
    const ch = hexToHsl(customHex);
    const cMono = ch.s < 4;
    const color = customHex;
    const onColor = bestOnColor(color, ch.h, ch.s, cMono);
    const containerL = isDark ? 28 : 87;
    const container = hslToHex(ch.h, cMono ? 0 : clamp(ch.s * 0.65, 10, 46), containerL);
    const onContainer = fitLightness(
      ch.h,
      cMono ? 0 : clamp(ch.s * 0.65, 8, 52),
      isDark ? 90 : 18,
      container,
      isDark ? 1.5 : -1.5,
      4.8,
      6,
      96,
    );
    return {
      color,
      onColor,
      container,
      onContainer,
    };
  }
  const on = isDark
    ? hslToHex(h, mono ? 0 : clamp(s * 0.58, 0, 44), 13)
    : hslToHex(h, mono ? 0 : 28, 97);
  const color = fitLightness(
    h,
    isDark ? s : clamp(s + 6, 0, 72),
    defaultLight,
    on,
    isDark ? 1.5 : -1.5,
  );
  const container = hslToHex(h, mono ? 0 : clamp(s * 0.6, 0, 46), isDark ? 29 : 87);
  return {
    color,
    onColor: on,
    container,
    onContainer: fitLightness(
      h,
      mono ? 0 : clamp(s * 0.6, 0, 50),
      isDark ? 90 : 19,
      container,
      isDark ? 1.5 : -1.5,
      4.8,
      6,
      96,
    ),
  };
}

function buildCustomScheme(customRaw) {
  const custom = normalizeCustomTheme(customRaw);
  const p = hexToHsl(custom.primary);
  const mono = p.s < 4;
  const secHsl = custom.secondary
    ? hexToHsl(custom.secondary)
    : { h: (p.h + 24) % 360, s: mono ? 0 : clamp(p.s * 0.72, 16, 48), l: 55 };
  const terHsl = custom.tertiary
    ? hexToHsl(custom.tertiary)
    : { h: (p.h + 58) % 360, s: mono ? 0 : clamp(p.s * 0.84, 18, 56), l: 58 };
  const surfHsl = custom.surface ? hexToHsl(custom.surface) : p;
  const surfMono = custom.surface ? surfHsl.s < 4 : mono;
  const neutralS = surfMono ? 0 : clamp(custom.surface ? surfHsl.s : p.s * 0.34, 6, 30);
  const variantS = surfMono ? 0 : clamp(Math.round(p.s * 0.42), 8, 34);

  const darkPrimaryPair = resolveAccentPair(custom.primary, p.h, p.s, 68, mono, true);
  const darkSecondaryPair = resolveAccentPair(
    custom.secondary,
    secHsl.h,
    secHsl.s,
    80,
    secHsl.s < 4,
    true,
  );
  const darkTertiaryPair = resolveAccentPair(
    custom.tertiary,
    terHsl.h,
    terHsl.s,
    83,
    terHsl.s < 4,
    true,
  );

  const lightPrimaryPair = resolveAccentPair(custom.primary, p.h, p.s, 39, mono, false);
  const lightSecondaryPair = resolveAccentPair(
    custom.secondary,
    secHsl.h,
    secHsl.s,
    40,
    secHsl.s < 4,
    false,
  );
  const lightTertiaryPair = resolveAccentPair(
    custom.tertiary,
    terHsl.h,
    terHsl.s,
    38,
    terHsl.s < 4,
    false,
  );

  const useExactDarkSurface = Boolean(custom.surface) && surfHsl.l <= 24;
  const darkBaseL = useExactDarkSurface ? surfHsl.l : 11;
  const darkSurface = useExactDarkSurface
    ? custom.surface
    : hslToHex(surfHsl.h, neutralS, darkBaseL);

  const useExactLightSurface = Boolean(custom.surface) && surfHsl.l >= 80;
  const lightBaseL = useExactLightSurface ? surfHsl.l : 96;
  const lightSurface = useExactLightSurface
    ? custom.surface
    : hslToHex(surfHsl.h, surfMono ? 0 : clamp(neutralS + 4, 8, 32), lightBaseL);

  const darkSurfaceContainerHighest = hslToHex(surfHsl.h, neutralS, clamp(darkBaseL + 21, 23, 44));
  const lightSurfaceContainerHighest = hslToHex(
    surfHsl.h,
    surfMono ? 0 : 18,
    clamp(lightBaseL - 11, 73, 89),
  );

  const defaultDarkText = fitLightness(
    surfHsl.h,
    surfMono ? 0 : 22,
    89,
    darkSurfaceContainerHighest,
    1.5,
    5.5,
    8,
    96,
  );
  const defaultLightText = fitLightness(
    surfHsl.h,
    surfMono ? 0 : 24,
    18,
    lightSurfaceContainerHighest,
    -1.5,
    5.5,
    6,
    94,
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
      : fitLightness(surfHsl.h, variantS, 73, darkSurfaceContainerHighest, 1.5, 4.6, 8, 94);
  const lightVarCandidate = custom.text ? mixHex(lightOnSurface, lightSurface, 0.78) : '';
  const lightOnSurfaceVariant =
    lightVarCandidate && contrastRatio(lightVarCandidate, lightSurfaceContainerHighest) >= 4.5
      ? lightVarCandidate
      : fitLightness(surfHsl.h, variantS, 36, lightSurfaceContainerHighest, -1.5, 4.6, 6, 92);
  const lightPrimaryBase = hslToHex(p.h, mono ? 0 : clamp(p.s + 6, 0, 70), 31);
  const darkInverseOnSurface = fitLightness(
    surfHsl.h,
    neutralS,
    16,
    darkOnSurface,
    -1.5,
    4.8,
    6,
    94,
  );
  const lightInverseOnSurface = fitLightness(
    surfHsl.h,
    surfMono ? 0 : 24,
    92,
    lightPrimaryBase,
    1.5,
    4.8,
    10,
    97,
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
      surfaceDim: hslToHex(surfHsl.h, neutralS, clamp(darkBaseL - 2.5, 4, 18)),
      surface: darkSurface,
      surfaceContainerLowest: hslToHex(surfHsl.h, neutralS, clamp(darkBaseL - 3.5, 3, 16)),
      surfaceContainerLow: hslToHex(surfHsl.h, neutralS, clamp(darkBaseL + 4, 8, 28)),
      surfaceContainer: hslToHex(surfHsl.h, neutralS, clamp(darkBaseL + 8, 12, 32)),
      surfaceContainerHigh: hslToHex(surfHsl.h, neutralS, clamp(darkBaseL + 14, 17, 38)),
      surfaceContainerHighest: darkSurfaceContainerHighest,
      onSurface: darkOnSurface,
      onSurfaceVariant: darkOnSurfaceVariant,
      outline: hslToHex(surfHsl.h, variantS, 58),
      outlineVariant: hslToHex(surfHsl.h, variantS, 31),
      inverseSurface: darkOnSurface,
      inverseOnSurface: darkInverseOnSurface,
      stateHover: rgba(darkPrimaryPair.color, 0.16),
      statePressed: rgba(darkPrimaryPair.color, 0.24),
      scrim: rgba(hslToHex(surfHsl.h, neutralS, 6), 0.78),
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
      surfaceDim: hslToHex(surfHsl.h, surfMono ? 0 : 20, clamp(lightBaseL - 10, 74, 90)),
      surface: lightSurface,
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: hslToHex(surfHsl.h, surfMono ? 0 : 24, clamp(lightBaseL - 2.5, 82, 97)),
      surfaceContainer: hslToHex(surfHsl.h, surfMono ? 0 : 22, clamp(lightBaseL - 5, 79, 95)),
      surfaceContainerHigh: hslToHex(surfHsl.h, surfMono ? 0 : 20, clamp(lightBaseL - 8, 76, 92)),
      surfaceContainerHighest: lightSurfaceContainerHighest,
      onSurface: lightOnSurface,
      onSurfaceVariant: lightOnSurfaceVariant,
      outline: hslToHex(surfHsl.h, variantS, 51),
      outlineVariant: hslToHex(surfHsl.h, variantS, 78),
      inverseSurface: lightPrimaryBase,
      inverseOnSurface: lightInverseOnSurface,
      stateHover: rgba(lightPrimaryBase, 0.08),
      statePressed: rgba(lightPrimaryBase, 0.14),
      scrim: rgba(hslToHex(surfHsl.h, neutralS, 18), 0.44),
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
  PALETTES,
  normalizeHex,
  normalizeCustomTheme,
  normalizePaletteId,
  buildCustomScheme,
  applyAmoledTokens,
  getPalette,
  getPaletteTokens,
  listPalettes,
};
