'use strict';

/**
 * Генератор стартового плагина: `npm run plugin:new -- my-plugin`.
 *
 * Копирует plugins/sdk/template, подставляет id и имя. Ничего не устанавливает
 * и не запускает: только создаёт папку, которую можно сразу открыть в
 * редакторе и запустить с OCTO_PLUGIN_DEV_DIR.
 */

const fs = require('node:fs');
const path = require('node:path');

const templateDir = path.join(__dirname, '..', 'plugins', 'sdk', 'template');

function fail(message) {
  console.error(`[octo] ${message}`);
  process.exit(1);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const args = process.argv.slice(2);
const target = args.find((item) => !item.startsWith('--'));
if (!target) fail('Укажите папку: npm run plugin:new -- my-plugin');

const options = {};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg.startsWith('--')) continue;
  const [key, inline] = arg.slice(2).split('=');
  options[key] = inline !== undefined ? inline : args[index + 1] || '';
}

const dir = path.resolve(process.cwd(), target);
if (fs.existsSync(dir) && fs.readdirSync(dir).length) {
  fail(`Папка ${dir} уже существует и не пуста`);
}

const name = options.name || path.basename(dir);
const id = options.id || `app.octo.${slug(path.basename(dir)) || 'plugin'}`;
if (!/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(id)) {
  fail('id должен быть вида app.octo.my-plugin');
}

fs.mkdirSync(dir, { recursive: true });
for (const entry of fs.readdirSync(templateDir)) {
  const source = path.join(templateDir, entry);
  if (!fs.statSync(source).isFile()) continue;
  let text = fs.readFileSync(source, 'utf8');
  text = text.replace(/__ID__/g, id).replace(/__NAME__/g, name);
  fs.writeFileSync(path.join(dir, entry), text);
}

console.log(`[octo] плагин создан: ${dir}`);
console.log(`      id: ${id}`);
console.log('');
console.log('Дальше:');
console.log(`  OCTO_PLUGIN_DEV_DIR="${path.dirname(dir)}" npm start`);
console.log(
  '  или соберите пакет: node scripts/pack-plugin.js "' + dir + '" --out plugins/packages',
);
