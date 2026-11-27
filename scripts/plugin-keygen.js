'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TRUSTED_KEYS_DIR, keyId } = require('../src/main/plugins/plugin-trust');

/**
 * Генерация ключей Ed25519 для подписи плагинов.
 *
 *   node scripts/plugin-keygen.js [--out-dir .octo-keys] [--force] [--trust]
 *
 * Публичный ключ кладётся в src/main/plugins/trusted-keys/ (--trust делает
 * это сам), приватный хранится только у издателя и в секрете CI
 * OCTO_PLUGIN_SIGNING_KEY и никогда не коммитится. Папка .octo-keys уже в
 * .gitignore.
 */

const args = process.argv.slice(2);
let outDir = '.octo-keys';
let force = false;
let trust = false;

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--out-dir') outDir = args[index + 1] || outDir;
  else if (args[index] === '--force') force = true;
  else if (args[index] === '--trust') trust = true;
  else if (args[index] === '--help' || args[index] === '-h') {
    console.log('node scripts/plugin-keygen.js [--out-dir .octo-keys] [--force] [--trust]');
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

const id = keyId(publicPem);
console.log(`Приватный ключ: ${privatePath}`);
console.log(`Публичный ключ: ${publicPath}`);
console.log(`keyId: ${id}\n`);

const trustedPath = path.join(TRUSTED_KEYS_DIR, `octo-${id}.pem`);
if (trust) {
  fs.mkdirSync(TRUSTED_KEYS_DIR, { recursive: true });
  fs.writeFileSync(trustedPath, `${publicPem}\n`, { mode: 0o644 });
  console.log(`Публичный ключ добавлен в доверенные: ${path.relative(process.cwd(), trustedPath)}`);
} else {
  console.log(`Скопируйте публичный ключ в доверенные (или запустите с --trust):`);
  console.log(`  cp ${publicPath} ${path.relative(process.cwd(), trustedPath)}`);
}
console.log('\nПриватный ключ положите в секрет GitHub Actions, в репозиторий его нельзя:');
console.log(`  gh secret set OCTO_PLUGIN_SIGNING_KEY < ${privatePath}`);
