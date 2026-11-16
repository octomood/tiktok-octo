'use strict';

/**
 * Каталог разрешений плагинов.
 *
 * Базовые возможности (интерфейс, хранилище, уведомления) даны всем плагинам:
 * они не трогают страницу и не ходят в сеть. Всё остальное перечисляется в
 * манифесте и показывается пользователю перед установкой.
 */

const PERMISSIONS = {
  'page:css': {
    id: 'page:css',
    label: 'Стили страницы',
    risk: 'medium',
    description: 'Может добавлять CSS на страницу TikTok: менять внешний вид ленты и интерфейса.',
  },
  'page:script': {
    id: 'page:script',
    label: 'Скрипты на странице',
    risk: 'high',
    description:
      'Может выполнять JavaScript в изолированном мире страницы TikTok: читать и менять DOM, ' +
      'реагировать на события. Не получает доступ к Node, cookie и внутренним объектам сайта.',
  },
  network: {
    id: 'network',
    label: 'Сеть',
    risk: 'high',
    description:
      'Может отправлять запросы только на хосты, перечисленные в манифесте (networkHosts). ' +
      'Печенья приложения и сессия TikTok не передаются.',
  },
  navigation: {
    id: 'navigation',
    label: 'Навигация TikTok',
    risk: 'medium',
    description:
      'Может открывать страницы tiktok.com внутри приложения: ленту, профили, поиск. ' +
      'Внешние сайты и произвольные URL запрещены.',
  },
  shortcuts: {
    id: 'shortcuts',
    label: 'Горячие клавиши',
    risk: 'medium',
    description:
      'Может назначать сочетания клавиш внутри приложения. Системные и занятые ' +
      'приложением сочетания не перехватываются.',
  },
  links: {
    id: 'links',
    label: 'Внешние ссылки',
    risk: 'low',
    description: 'Может открывать https-ссылки в системном браузере.',
  },
};

const BASELINE = [
  {
    id: 'ui',
    label: 'Интерфейс',
    risk: 'low',
    description: 'Команды в палитре и строки в панели функций.',
  },
  {
    id: 'storage',
    label: 'Своё хранилище',
    risk: 'low',
    description: 'До 256 КБ данных плагина в профиле приложения.',
  },
  {
    id: 'notify',
    label: 'Уведомления',
    risk: 'low',
    description: 'Короткие всплывающие сообщения в интерфейсе.',
  },
];

const RISK_LABELS = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
};

const RISK_RANK = { low: 0, medium: 1, high: 2 };

function isKnownPermission(id) {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, id);
}

function normalizePermissions(list) {
  if (!Array.isArray(list)) return [];
  const result = [];
  for (const value of list) {
    if (typeof value !== 'string' || !isKnownPermission(value)) continue;
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

function describePermissions(list) {
  const normalized = normalizePermissions(list);
  return normalized.map((id) => ({ ...PERMISSIONS[id] }));
}

function baselinePermissions() {
  return BASELINE.map((item) => ({ ...item }));
}

function highestRisk(list) {
  let rank = 0;
  for (const id of normalizePermissions(list)) {
    rank = Math.max(rank, RISK_RANK[PERMISSIONS[id].risk] ?? 0);
  }
  return Object.keys(RISK_RANK).find((key) => RISK_RANK[key] === rank) || 'low';
}

function riskLabel(risk) {
  return RISK_LABELS[risk] || RISK_LABELS.low;
}

module.exports = {
  PERMISSIONS,
  BASELINE,
  RISK_LABELS,
  isKnownPermission,
  normalizePermissions,
  describePermissions,
  baselinePermissions,
  highestRisk,
  riskLabel,
};
