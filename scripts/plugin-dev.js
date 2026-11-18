'use strict';

/**
 * Наблюдатель за dev-плагинами: `npm run plugin:dev [папка]`.
 *
 * Сам ничего не запускает и окон не открывает. Проверяет манифесты при
 * изменении файлов и напоминает, что запущенное приложение с
 * OCTO_PLUGIN_DEV_DIR перезагружает плагины само.
 */

const fs = require('node:fs');
const path = require('node:path');
const { validateManifest } = require('../src/main/plugins/manifest');

const dir = path.resolve(process.argv[2] || process.env.OCTO_PLUGIN_DEV_DIR || 'plugins/examples');

function check() {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`[octo] не читается ${dir}: ${error.message}`);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name, 'plugin.json');
    if (!fs.existsSync(file)) continue;

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      console.error(`[octo] ${entry.name}: plugin.json не читается: ${error.message}`);
      continue;
    }

    const result = validateManifest(manifest);
    if (result.ok) {
      console.log(`[octo] ${entry.name}: манифест в порядке (id ${manifest.id})`);
    } else {
      console.error(`[octo] ${entry.name}: ${result.errors.join('; ')}`);
    }
  }
}

console.log(`[octo] наблюдаю ${dir}`);
console.log('       приложение с OCTO_PLUGIN_DEV_DIR перезагружает плагины само.');
check();

let timer = null;
try {
  const watcher = fs.watch(dir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(check, 300);
  });
  watcher.on('error', (error) => console.error(`[octo] наблюдатель: ${error.message}`));
  process.on('SIGINT', () => {
    watcher.close();
    process.exit(0);
  });
} catch (error) {
  console.error(`[octo] не удалось наблюдать: ${error.message}`);
}
