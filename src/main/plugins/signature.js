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

function canonicalPayload({ id, version, sha256 }) {
  return `octo-plugin-v1\n${id}\n${version}\n${String(sha256 || '').toLowerCase()}`;
}

/**
 * @returns {'verified'|'unsigned'|'invalid'}
 */
function verifySignature({ id, version, sha256, signature }) {
  if (!signature || typeof signature !== 'string') return 'unsigned';
  if (!PUBLIC_KEYS.length) return 'invalid';

  let signatureBuffer;
  try {
    signatureBuffer = Buffer.from(signature, 'base64');
  } catch {
    return 'invalid';
  }
  if (signatureBuffer.length < 32) return 'invalid';

  const payload = Buffer.from(canonicalPayload({ id, version, sha256 }), 'utf8');
  for (const key of PUBLIC_KEYS) {
    try {
      if (crypto.verify(null, payload, key, signatureBuffer)) return 'verified';
    } catch {
      /* ключ может быть в другом формате — пробуем следующий */
    }
  }
  return 'invalid';
}

/** Утилита для скрипта подписи; в приложении приватного ключа нет. */
function signPayload(privateKey, { id, version, sha256 }) {
  const payload = Buffer.from(canonicalPayload({ id, version, sha256 }), 'utf8');
  return crypto.sign(null, payload, privateKey).toString('base64');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { canonicalPayload, verifySignature, signPayload, sha256 };
