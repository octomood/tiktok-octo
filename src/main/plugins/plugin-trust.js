'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Публичные ключи, которым доверяет приложение.
 *
 * Ключи лежат файлами в src/main/plugins/trusted-keys/*.pem (PEM
 * SubjectPublicKeyInfo, Ed25519) и попадают в сборку вместе с src/. Создать
 * пару и положить публичную часть на место:
 *
 *   node scripts/plugin-keygen.js --trust
 *
 * Приватный ключ хранится только у издателя и в секрете CI
 * OCTO_PLUGIN_SIGNING_KEY и никогда не попадает в репозиторий. Пустая папка
 * означает «подписей нет»: все плагины считаются неподписанными.
 */

const TRUSTED_KEYS_DIR = path.join(__dirname, 'trusted-keys');

/** Короткий отпечаток ключа: первые 16 hex SHA-256 от DER SubjectPublicKeyInfo. */
function keyId(publicKey) {
  try {
    const key = crypto.createPublicKey(publicKey);
    if (key.asymmetricKeyType !== 'ed25519') return '';
    const der = key.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}

function loadTrustedKeys(dir = TRUSTED_KEYS_DIR) {
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((name) => name.endsWith('.pem'));
  } catch {
    return [];
  }
  const keys = [];
  for (const name of names.sort()) {
    let pem = '';
    try {
      pem = fs.readFileSync(path.join(dir, name), 'utf8').trim();
    } catch {
      continue;
    }
    if (pem.includes('PRIVATE KEY')) {
      // Приватный ключ в сборке — утечка, а не доверенный ключ.
      console.warn(`[octo] plugin-trust: ${name} — приватный ключ, пропущен`);
      continue;
    }
    const id = keyId(pem);
    if (!id) {
      // Битый или чужой формат ключа не должен ронять приложение: просто не доверяем ему.
      console.warn(`[octo] plugin-trust: ${name} — не публичный ключ Ed25519, пропущен`);
      continue;
    }
    if (keys.some((item) => item.id === id)) continue;
    keys.push({ id, pem, file: name });
  }
  return keys;
}

const TRUSTED_KEYS = loadTrustedKeys();
const PUBLIC_KEYS = TRUSTED_KEYS.map((item) => item.pem);

/**
 * Строки о подписи для диалога установки. Неподписанный плагин с правами
 * высокого риска получает отдельное, заметное предупреждение.
 *
 * @param {{signature?: string, signatureNote?: string, permissions?: Array<{label?: string, id?: string, risk?: string}>}} preview
 */
function trustNotice(preview) {
  const signature = preview?.signature || 'unsigned';
  if (signature === 'verified') {
    return ['Официальный плагин: подпись TikTok Octo проверена.'];
  }
  if (signature === 'invalid') {
    return ['Подпись недействительна — установка запрещена.'];
  }

  const lines = [];
  if (preview?.signatureNote === 'unknown-key') {
    lines.push(
      'Пакет подписан ключом, которому приложение не доверяет. Он считается неподписанным.',
    );
  }
  const risky = (preview?.permissions || [])
    .filter((item) => item && item.risk === 'high')
    .map((item) => item.label || item.id);
  if (risky.length) {
    lines.push(
      'Плагин не подписан: нельзя проверить, кто его выпустил и не подменён ли он.',
      `Он получит доступ с высоким риском: ${risky.join(', ')}.`,
      'Устанавливайте, только если скачали его из канала автора и доверяете исходникам.',
    );
  } else {
    lines.push('Плагин не подписан. Устанавливайте, только если доверяете автору и исходникам.');
  }
  return lines;
}

/** Неподписанный плагин с правами высокого риска — диалог показывается как предупреждение. */
function needsTrustWarning(preview) {
  if (!preview || preview.signature === 'verified') return false;
  return (preview.permissions || []).some((item) => item && item.risk === 'high');
}

module.exports = {
  TRUSTED_KEYS_DIR,
  TRUSTED_KEYS,
  PUBLIC_KEYS,
  keyId,
  loadTrustedKeys,
  trustNotice,
  needsTrustWarning,
};
