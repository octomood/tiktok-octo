'use strict';

/**
 * Метаданные косметических правил.
 *
 * Отдельный модуль, чтобы состояние для интерфейса (панель функций) могло
 * собрать список правил, не подтягивая сами CSS/JS-реализации.
 */

const COSMETIC_RULES = [
  { id: 'octo-brand', label: 'Логотип tt-octo вместо TikTok', default: true },
  { id: 'modern-font', label: 'Современный шрифт на сайте', default: true },
  { id: 'hide-app-promo', label: 'Убрать промо приложения', default: true },
  { id: 'dark-scrollbars', label: 'Тёмные скроллбары', default: true },
  { id: 'hide-live-nav', label: 'Скрыть «Трансляция»', default: false },
  { id: 'hide-drama-nav', label: 'Скрыть «Мини-сериалы»', default: false },
];

module.exports = { COSMETIC_RULES };
