'use strict';

const fs = require('node:fs');
const path = require('node:path');
// Без installer.js: он тянет electron, а шагу подписи в CI бинарник Electron не нужен.
const { readZip } = require('../src/main/plugins/zip');
const { verifyEmbeddedSignature } = require('../src/main/plugins/signature');
const { TRUSTED_KEYS, TRUSTED_KEYS_DIR } = require('../src/main/plugins/plugin-trust');

/**
 * Проверка подписей пакетов и доверенных ключей.
 *
 *   node scripts/verify-plugin-packages.js [папка или .octoplugin ...] [--require-signed]
 *
 * Падает, если в trusted-keys/ лежит приватный или битый ключ, если подпись
 * пакета недействительна или сделана ключом, которого нет в trusted-keys/.
 * Неподписанные пакеты только перечисляются; с --require-signed — ошибка.
 */

function checkTrustedKeys() {
  const errors = [];
  let names = [];
  try {
    names = fs.readdirSync(TRUSTED_KEYS_DIR).filter((name) => name.endsWith('.pem'));
  } catch {
    return errors;
  }
  for (const name of names) {
    const text = fs.readFileSync(path.join(TRUSTED_KEYS_DIR, name), 'utf8');
    if (text.includes('PRIVATE KEY')) {
      errors.push(`${name}: это приватный ключ — удалите его из репозитория и замените ключ`);
    } else if (!TRUSTED_KEYS.some((item) => item.file === name)) {
      errors.push(`${name}: не публичный ключ Ed25519 (или дубль другого ключа)`);
    }
  }
  return errors;
}

function packageFiles(targets) {
  const files = [];
  const errors = [];
  for (const target of targets) {
    if (target.endsWith('.octoplugin')) {
      files.push(target);
      continue;
    }
    try {
      const names = fs.readdirSync(target).filter((name) => name.endsWith('.octoplugin'));
      files.push(...names.sort().map((name) => path.join(target, name)));
    } catch {
      errors.push(`Нет папки ${target}`);
    }
  }
  return { files, errors };
}

function verifyPackages(targets, { requireSigned = false } = {}) {
  const results = [];
  const { files, errors } = packageFiles(targets);
  for (const file of files) {
    const name = path.basename(file);
    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch {
      errors.push(`${name}: файл не найден`);
      continue;
    }
    let embedded;
    try {
      const files = readZip(buffer);
      const manifest = JSON.parse(files.get('plugin.json')?.toString('utf8') || 'null');
      if (!manifest || typeof manifest !== 'object') throw new Error('нет plugin.json');
      embedded = verifyEmbeddedSignature(files, { id: manifest.id, version: manifest.version });
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      continue;
    }
    const item = { name, signature: embedded.status, note: embedded.note || '' };
    results.push(item);
    if (embedded.status === 'invalid') {
      errors.push(`${name}: ${embedded.error || 'подпись недействительна'}`);
    } else if (item.note === 'unknown-key') {
      errors.push(`${name}: подписан ключом, которого нет в src/main/plugins/trusted-keys/`);
    } else if (requireSigned && embedded.status !== 'verified') {
      errors.push(`${name}: пакет не подписан`);
    }
  }
  return { results, errors };
}

function main() {
  const args = process.argv.slice(2);
  const requireSigned = args.includes('--require-signed');
  const targets = args.filter((item) => !item.startsWith('-')).map((item) => path.resolve(item));
  if (!targets.length) targets.push(path.resolve('plugins/packages'));

  const errors = checkTrustedKeys();
  console.log(
    `Доверенные ключи: ${TRUSTED_KEYS.length ? TRUSTED_KEYS.map((item) => item.id).join(', ') : 'нет'}`,
  );

  const report = verifyPackages(targets, { requireSigned });
  for (const item of report.results) {
    const label = item.signature === 'verified' ? 'подписан' : 'без подписи';
    console.log(`  ${item.name}: ${item.note === 'unknown-key' ? 'чужой ключ' : label}`);
  }
  errors.push(...report.errors);
  if (errors.length) {
    console.error('\nОшибки:');
    for (const error of errors) console.error(`  • ${error}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { checkTrustedKeys, verifyPackages };
