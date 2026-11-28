'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Сборка и подпись официальных плагинов из plugins/ одним шагом.
 *
 *   OCTO_PLUGIN_SIGNING_KEY=<PEM или путь> \
 *     node scripts/pack-official-plugins.js [--out plugins/packages] [--only <id>]
 *
 * Официальные — все папки с plugin.json в plugins/ и plugins/examples/ (кроме
 * шаблона SDK). Без ключа скрипт не собирает ничего: неподписанный
 * «официальный» пакет хуже, чем никакой. После сборки пакеты проверяются
 * против src/main/plugins/trusted-keys/ так же, как их проверит приложение:
 * ключ из секрета, которого нет в trusted-keys/, роняет сборку.
 */

const ROOT = path.resolve(__dirname, '..');
const PLUGINS = path.join(ROOT, 'plugins');
const SKIP = new Set(['sdk', 'packages', 'node_modules']);

function officialPluginDirs(root = PLUGINS) {
  const dirs = [];
  const visit = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (fs.existsSync(path.join(full, 'plugin.json'))) dirs.push(full);
      else if (depth < 1) visit(full, depth + 1);
    }
  };
  visit(root, 0);
  return dirs.sort();
}

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')) || {};
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const result = { out: 'plugins/packages', only: '' };
  const rest = [...argv];
  while (rest.length) {
    const item = rest.shift();
    if (item === '--out') result.out = rest.shift() || result.out;
    else if (item === '--only') result.only = (rest.shift() || '').trim();
    else {
      console.error(`Неизвестный аргумент: ${item}`);
      process.exit(1);
    }
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.OCTO_PLUGIN_SIGNING_KEY) {
    console.error(
      'OCTO_PLUGIN_SIGNING_KEY не задан. Локально: путь к .octo-keys/plugin-private.pem, ' +
        'в GitHub Actions: секрет репозитория (см. docs/plugins/README.md, «Ключи»).',
    );
    process.exit(1);
  }

  let dirs = officialPluginDirs();
  if (args.only) {
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(args.only)) {
      console.error(`Некорректный id: ${args.only}`);
      process.exit(1);
    }
    dirs = dirs.filter((dir) => readManifest(dir).id === args.only);
    if (!dirs.length) {
      console.error(`Плагин ${args.only} не найден в plugins/`);
      process.exit(1);
    }
  }

  const out = path.resolve(args.out);
  const built = [];
  for (const dir of dirs) {
    console.log(`\n=== ${path.relative(ROOT, dir)} ===`);
    execFileSync(
      process.execPath,
      [path.join(__dirname, 'pack-plugin.js'), dir, '--out', out, '--require-signature'],
      { stdio: 'inherit', env: process.env },
    );
    const manifest = readManifest(dir);
    built.push(path.join(out, `${manifest.id}-${manifest.version}.octoplugin`));
  }

  console.log('\n=== Проверка подписей ===');
  execFileSync(
    process.execPath,
    [path.join(__dirname, 'verify-plugin-packages.js'), ...built, '--require-signed'],
    { stdio: 'inherit' },
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    // Дочерний скрипт уже напечатал причину; стек execFileSync здесь только мешает.
    process.exit(typeof err?.status === 'number' && err.status ? err.status : 1);
  }
}

module.exports = { officialPluginDirs };
