'use strict';

/**
 * Константы системы плагинов.
 *
 * Здесь же — значения по умолчанию для каталога и документации. Их можно
 * переопределить переменными окружения: так тесты и форки не зависят от
 * конкретного репозитория.
 */

const DEFAULT_REGISTRY_URL =
  process.env.OCTO_PLUGIN_REGISTRY ||
  'https://raw.githubusercontent.com/octomood/tiktok-octo/main/plugins/registry.json';

const DOCS_URL =
  process.env.OCTO_PLUGIN_DOCS_URL ||
  'https://github.com/octomood/tiktok-octo/tree/main/docs/plugins';

const PUBLISHING_URL =
  process.env.OCTO_PLUGIN_RULES_URL ||
  'https://github.com/octomood/tiktok-octo/blob/main/docs/plugins/PUBLISHING.md';

/** Плагин — это ZIP с JSON-манифестом и JavaScript, без нативных бинарников. */
const LIMITS = {
  packageBytes: 8 * 1024 * 1024,
  manifestBytes: 64 * 1024,
  entryBytes: 2 * 1024 * 1024,
  fileBytes: 6 * 1024 * 1024,
  totalBytes: 24 * 1024 * 1024,
  files: 200,
  registryBytes: 4 * 1024 * 1024,
  iconBytes: 512 * 1024,
  pageScriptBytes: 512 * 1024,
  cssBytes: 256 * 1024,
  storageBytes: 256 * 1024,
  networkResponseBytes: 2 * 1024 * 1024,
  maxPlugins: 24,
  maxCommands: 64,
  maxPanelRows: 64,
};

const API_VERSION = 1;

const PACKAGE_EXTENSIONS = ['.octoplugin', '.zip'];

const PROTOCOL = 'octo-plugin';

module.exports = {
  DEFAULT_REGISTRY_URL,
  DOCS_URL,
  PUBLISHING_URL,
  LIMITS,
  API_VERSION,
  PACKAGE_EXTENSIONS,
  PROTOCOL,
};
