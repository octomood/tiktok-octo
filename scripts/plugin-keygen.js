'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Генерация ключей Ed25519 для подписи плагинов.
 *
 *   node scripts/plugin-keygen.js [--out-dir .octo-keys] [--force]
 *
 * Публичный ключ вставляется в src/main/plugins/plugin-trust.js, приватный
 * хранится только в секрете CI (OCTO_PLUGIN_SIGNING_KEY) и никогда не
 * коммитится. Папка .octo-keys уже в .gitignore.
 */

const args = process.argv.slice(2);
let outDir = '.octo-keys';
let force = false;

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--out-dir') outDir = args[index + 1] || outDir;
  else if (args[index] === '--force') force = true;
  else if (args[index] === '--help' || args[index] === '-h') {
    console.log('node scripts/plugin-keygen.js [--out-dir .octo-keys] [--force]');
    process.exit(0);
  }
}

const target = path.resolve(outDir);
const privatePath = path.join(target, 'plugin-private.pem');
const publicPath = path.join(target, 'plugin-public.pem');

if (!force && (fs.existsSync(privatePath) || fs.existsSync(publicPath))) {
  console.error(`Ключи уже существуют в ${target}. Используйте --force, чтобы перезаписать.`);
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();

fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(privatePath, `${privatePem}\n`, { mode: 0o600 });
fs.writeFileSync(publicPath, `${publicPem}\n`, { mode: 0o644 });

console.log(`Приватный ключ: ${privatePath}`);
console.log(`Публичный ключ: ${publicPath}\n`);
console.log('Вставьте публичный ключ в src/main/plugins/plugin-trust.js:\n');
console.log(`const PUBLIC_KEYS = [\n  ${JSON.stringify(publicPem)},\n];\n`);
console.log('Приватный ключ передайте в CI как OCTO_PLUGIN_SIGNING_KEY (путь к файлу).');
