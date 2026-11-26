'use strict';

const crypto = require('node:crypto');
const { PUBLIC_KEYS } = require('./plugin-trust');

/**
 * Подпись пакета.
 *
 * Подписывается не ZIP (он меняется от перепаковки), а каноническая строка
 * с id, версией и SHA-256. Так каталог может проверить подпись ещё до
 * скачивания, а установщик — после.
 */

const SIGNATURE_FILE = 'SIGNATURE.json';

function canonicalPayload({ id, version, sha256 }) {
  return `octo-plugin-v1\n${id}\n${version}\n${String(sha256 || '').toLowerCase()}`;
}

function normalizeFileHashes(files) {
  const result = {};
  const entries = files instanceof Map ? files.entries() : Object.entries(files || {});
  for (const [name, value] of entries) {
    if (name === SIGNATURE_FILE) continue;
    const hex = Buffer.isBuffer(value) ? sha256(value) : String(value || '').toLowerCase();
    result[name] = hex;
  }
  return result;
}

function canonicalFilesPayload({ id, version, files }) {
  const hashes = normalizeFileHashes(files);
  const lines = Object.keys(hashes)
    .sort()
    .map((name) => `${name}:${hashes[name]}`);
  return `octo-plugin-files-v1\n${id}\n${version}\n${lines.join('\n')}`;
}

/**
 * @returns {'verified'|'unsigned'|'invalid'}
 */
function verifySignaturePayload(payloadText, signature, publicKeys = PUBLIC_KEYS) {
  if (!signature || typeof signature !== 'string') return 'unsigned';
  const keys = Array.isArray(publicKeys) ? publicKeys : [];
  if (!keys.length) return 'invalid';

  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(signature, 'base64');
  } catch {
    return 'invalid';
  }
  if (signatureBuffer.length < 32) return 'invalid';

  const payload = Buffer.from(payloadText, 'utf8');
  for (const key of keys) {
    try {
      if (crypto.verify(null, payload, key, signatureBuffer)) return 'verified';
    } catch {
      /* ключ может быть в другом формате — пробуем следующий */
    }
  }
  return 'invalid';
}

/**
 * @returns {'verified'|'unsigned'|'invalid'}
 */
function verifySignature({ id, version, sha256, signature }, publicKeys = PUBLIC_KEYS) {
  return verifySignaturePayload(canonicalPayload({ id, version, sha256 }), signature, publicKeys);
}

/**
 * @returns {'verified'|'unsigned'|'invalid'}
 */
function verifyFilesSignature({ id, version, files, signature }, publicKeys = PUBLIC_KEYS) {
  return verifySignaturePayload(
    canonicalFilesPayload({ id, version, files }),
    signature,
    publicKeys,
  );
}

function parseAndVerifySignatureFile(buffer, { id, version, files }, publicKeys = PUBLIC_KEYS) {
  let doc;
  try {
    doc = JSON.parse(buffer.toString('utf8'));
  } catch {
    return { status: 'invalid', error: 'SIGNATURE.json — некорректный JSON' };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { status: 'invalid', error: 'SIGNATURE.json — ожидается JSON-объект' };
  }
  if (doc.schema !== 1 || doc.algorithm !== 'ed25519') {
    return { status: 'invalid', error: 'Неподдерживаемый формат встроенной подписи' };
  }
  if (doc.id !== id || doc.version !== version) {
    return { status: 'invalid', error: 'Встроенная подпись не совпадает с манифестом' };
  }
  if (typeof doc.signature !== 'string' || !doc.signature.trim()) {
    return { status: 'invalid', error: 'Встроенная подпись пуста' };
  }
  if (!doc.files || typeof doc.files !== 'object' || Array.isArray(doc.files)) {
    return { status: 'invalid', error: 'Встроенная подпись не содержит список файлов' };
  }

  const actual = normalizeFileHashes(files);
  const actualKeys = Object.keys(actual).sort();
  const signedKeys = Object.keys(doc.files).sort();
  if (
    actualKeys.length !== signedKeys.length ||
    !actualKeys.every((key, index) => key === signedKeys[index])
  ) {
    return { status: 'invalid', error: 'Состав файлов не совпадает со встроенной подписью' };
  }
  for (const key of actualKeys) {
    if (String(doc.files[key] || '').toLowerCase() !== actual[key]) {
      return { status: 'invalid', error: `Хэш файла «${key}» не совпадает со встроенной подписью` };
    }
  }

  const status = verifyFilesSignature(
    { id, version, files: actual, signature: doc.signature.trim() },
    publicKeys,
  );
  if (status !== 'verified') {
    return { status: 'invalid', error: 'Встроенная подпись пакета недействительна' };
  }
  return { status: 'verified', error: '' };
}

/** Утилита для скрипта подписи; в приложении приватного ключа нет. */
function signPayload(privateKey, { id, version, sha256 }) {
  const payload = Buffer.from(canonicalPayload({ id, version, sha256 }), 'utf8');
  return crypto.sign(null, payload, privateKey).toString('base64');
}

function signFilesPayload(privateKey, { id, version, files }) {
  const payload = Buffer.from(canonicalFilesPayload({ id, version, files }), 'utf8');
  return crypto.sign(null, payload, privateKey).toString('base64');
}

function createSignatureManifest(privateKey, { id, version, files }) {
  const hashes = normalizeFileHashes(files);
  const sorted = {};
  for (const key of Object.keys(hashes).sort()) sorted[key] = hashes[key];
  return `${JSON.stringify(
    {
      schema: 1,
      id,
      version,
      algorithm: 'ed25519',
      files: sorted,
      signature: signFilesPayload(privateKey, { id, version, files: sorted }),
    },
    null,
    2,
  )}\n`;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = {
  SIGNATURE_FILE,
  canonicalPayload,
  canonicalFilesPayload,
  verifySignature,
  verifyFilesSignature,
  parseAndVerifySignatureFile,
  signPayload,
  signFilesPayload,
  createSignatureManifest,
  sha256,
};
