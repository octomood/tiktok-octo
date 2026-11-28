'use strict';

const crypto = require('node:crypto');
const { PUBLIC_KEYS, keyId } = require('./plugin-trust');

/**
 * Подпись пакета.
 *
 * Подписывается не ZIP (он меняется от перепаковки), а каноническая строка
 * с id, версией и SHA-256. Так каталог может проверить подпись ещё до
 * скачивания, а установщик — после.
 *
 * Встроенная подпись живёт в OCTO-SIGNATURE.json (схема 2, с keyId). Старый
 * SIGNATURE.json (схема 1) по-прежнему проверяется, но новые пакеты его не
 * получают: приложения до появления ключей считают любой SIGNATURE.json
 * недействительным и не дали бы поставить подписанный официальный плагин.
 * OCTO-SIGNATURE.json для них — обычный файл, пакет ставится как неподписанный.
 */

const SIGNATURE_FILE = 'OCTO-SIGNATURE.json';
const LEGACY_SIGNATURE_FILE = 'SIGNATURE.json';
const SIGNATURE_FILES = [SIGNATURE_FILE, LEGACY_SIGNATURE_FILE];

function canonicalPayload({ id, version, sha256 }) {
  return `octo-plugin-v1\n${id}\n${version}\n${String(sha256 || '').toLowerCase()}`;
}

function normalizeFileHashes(files, exclude = LEGACY_SIGNATURE_FILE) {
  const result = {};
  const entries = files instanceof Map ? files.entries() : Object.entries(files || {});
  for (const [name, value] of entries) {
    if (name === exclude) continue;
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

function canonicalFilesPayloadV2({ keyId: signer, id, version, files }) {
  const hashes = normalizeFileHashes(files, SIGNATURE_FILE);
  const lines = Object.keys(hashes)
    .sort()
    .map((name) => `${name}:${hashes[name]}`);
  return `octo-plugin-files-v2\n${signer}\n${id}\n${version}\n${lines.join('\n')}`;
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

function sameFileHashes(expected, actual) {
  const actualKeys = Object.keys(actual).sort();
  const signedKeys = Object.keys(expected).sort();
  if (
    actualKeys.length !== signedKeys.length ||
    !actualKeys.every((key, index) => key === signedKeys[index])
  ) {
    return { ok: false, error: 'Состав файлов не совпадает со встроенной подписью' };
  }
  for (const key of actualKeys) {
    if (String(expected[key] || '').toLowerCase() !== actual[key]) {
      return { ok: false, error: `Хэш файла «${key}» не совпадает со встроенной подписью` };
    }
  }
  return { ok: true, error: '' };
}

/**
 * OCTO-SIGNATURE.json (схема 2). Подпись ключом, которого нет среди доверенных,
 * не делает пакет «недействительным»: пакет просто считается неподписанным
 * (note: 'unknown-key'). Иначе ротация ключа или пакет, подписанный раньше,
 * чем ключ попал в приложение, блокировали бы установку.
 *
 * @returns {{status: 'verified'|'unsigned'|'invalid', error: string, note: string, keyId: string}}
 */
function parseAndVerifySignatureFileV2(buffer, { id, version, files }, publicKeys = PUBLIC_KEYS) {
  const fail = (error) => ({ status: 'invalid', error, note: '', keyId: '' });
  let doc;
  try {
    doc = JSON.parse(buffer.toString('utf8'));
  } catch {
    return fail('OCTO-SIGNATURE.json — некорректный JSON');
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return fail('OCTO-SIGNATURE.json — ожидается JSON-объект');
  }
  if (doc.schema !== 2 || doc.algorithm !== 'ed25519') {
    return fail('Неподдерживаемый формат встроенной подписи');
  }
  if (doc.id !== id || doc.version !== version) {
    return fail('Встроенная подпись не совпадает с манифестом');
  }
  const signer = typeof doc.keyId === 'string' ? doc.keyId.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{16}$/.test(signer)) return fail('Во встроенной подписи нет keyId');
  if (typeof doc.signature !== 'string' || !doc.signature.trim()) {
    return fail('Встроенная подпись пуста');
  }
  if (!doc.files || typeof doc.files !== 'object' || Array.isArray(doc.files)) {
    return fail('Встроенная подпись не содержит список файлов');
  }

  const key = (Array.isArray(publicKeys) ? publicKeys : []).find((item) => keyId(item) === signer);
  if (!key) {
    return {
      status: 'unsigned',
      error: '',
      note: 'unknown-key',
      keyId: signer,
    };
  }

  const actual = normalizeFileHashes(files, SIGNATURE_FILE);
  const same = sameFileHashes(doc.files, actual);
  if (!same.ok) return { ...fail(same.error), keyId: signer };

  const status = verifySignaturePayload(
    canonicalFilesPayloadV2({ keyId: signer, id, version, files: actual }),
    doc.signature.trim(),
    [key],
  );
  if (status !== 'verified') {
    return { ...fail('Встроенная подпись пакета недействительна'), keyId: signer };
  }
  return { status: 'verified', error: '', note: '', keyId: signer };
}

/**
 * Встроенная подпись пакета: OCTO-SIGNATURE.json, иначе старый SIGNATURE.json.
 *
 * @param {Map<string, Buffer>} files
 * @returns {{status: 'verified'|'unsigned'|'invalid', error: string, note: string, keyId: string}}
 */
function verifyEmbeddedSignature(files, { id, version }, publicKeys = PUBLIC_KEYS) {
  const current = files.get(SIGNATURE_FILE);
  if (current) return parseAndVerifySignatureFileV2(current, { id, version, files }, publicKeys);
  const legacy = files.get(LEGACY_SIGNATURE_FILE);
  if (legacy) {
    const result = parseAndVerifySignatureFile(legacy, { id, version, files }, publicKeys);
    return { ...result, note: '', keyId: '' };
  }
  return { status: 'unsigned', error: '', note: '', keyId: '' };
}

/** Содержимое OCTO-SIGNATURE.json для пакета; файлы — без самого OCTO-SIGNATURE.json. */
function createSignatureManifest(privateKey, { id, version, files }) {
  const signer = keyId(privateKey);
  if (!signer) throw new Error('Нужен приватный ключ Ed25519');
  const hashes = normalizeFileHashes(files, SIGNATURE_FILE);
  const sorted = {};
  for (const key of Object.keys(hashes).sort()) sorted[key] = hashes[key];
  const payload = canonicalFilesPayloadV2({ keyId: signer, id, version, files: sorted });
  return `${JSON.stringify(
    {
      schema: 2,
      id,
      version,
      algorithm: 'ed25519',
      keyId: signer,
      files: sorted,
      signature: crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
    },
    null,
    2,
  )}\n`;
}

/** Старый формат SIGNATURE.json (схема 1) — только для тестов совместимости. */
function createLegacySignatureManifest(privateKey, { id, version, files }) {
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
  LEGACY_SIGNATURE_FILE,
  SIGNATURE_FILES,
  canonicalPayload,
  canonicalFilesPayload,
  canonicalFilesPayloadV2,
  verifySignature,
  verifyFilesSignature,
  parseAndVerifySignatureFile,
  parseAndVerifySignatureFileV2,
  verifyEmbeddedSignature,
  signPayload,
  signFilesPayload,
  createSignatureManifest,
  createLegacySignatureManifest,
  sha256,
};
