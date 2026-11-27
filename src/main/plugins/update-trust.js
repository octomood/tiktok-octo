'use strict';

const crypto = require('node:crypto');
const { PUBLIC_KEYS } = require('./plugin-trust');
const { verifySignature, parseAndVerifySignatureFile, SIGNATURE_FILE } = require('./signature');
const { compareVersions } = require('./manifest');

/**
 * Доверие при обновлении плагина.
 *
 * Пакет с тем же `id` может прийти от кого угодно: «Установить из файла»
 * принимает любой `.octoplugin`. Поэтому при первой установке запоминаем
 * издателя — отпечаток ключа, которым подписан пакет, или (для неподписанных)
 * имя автора — и сравниваем его при каждом обновлении. Если издатель сменился,
 * новая версия ставится как новый плагин: хранилище, секреты и настройки
 * старой версии ей не достаются (они остаются в истории версий для отката).
 */

function keyFingerprint(key) {
  try {
    const der = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(der).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Отпечаток ключа, которым подписан пакет, или '' для неподписанного.
 * Вызывается только когда подпись уже проверена: перебирает доверенные
 * ключи по одному, чтобы узнать, какой из них подошёл.
 */
function signerFingerprint(
  { files, manifest, sha256, signature, registrySignature = '' },
  publicKeys = PUBLIC_KEYS,
) {
  if (signature !== 'verified' || !manifest) return '';
  const keys = Array.isArray(publicKeys) ? publicKeys : [];
  const embedded = files?.get?.(SIGNATURE_FILE);
  for (const key of keys) {
    const single = [key];
    const byFile =
      embedded &&
      parseAndVerifySignatureFile(
        embedded,
        { id: manifest.id, version: manifest.version, files },
        single,
      ).status === 'verified';
    const byRegistry =
      registrySignature &&
      verifySignature(
        { id: manifest.id, version: manifest.version, sha256, signature: registrySignature },
        single,
      ) === 'verified';
    if (byFile || byRegistry) return keyFingerprint(key);
  }
  return '';
}

function authorName(value) {
  return String(value?.name || '')
    .trim()
    .toLowerCase();
}

/** Издатель новой версии из результата inspectPackage. */
function publisherOf(inspection) {
  return {
    key: inspection?.signer || '',
    author: inspection?.manifest?.author?.name || '',
  };
}

/** Издатель установленной версии; у записей до этой проверки поля нет. */
function recordPublisher(record) {
  if (record?.publisher && typeof record.publisher === 'object') {
    return {
      key: typeof record.publisher.key === 'string' ? record.publisher.key : '',
      author: String(record.publisher.author || ''),
    };
  }
  return { key: '', author: record?.author?.name || record?.manifest?.author?.name || '' };
}

/**
 * Тот же ли издатель.
 * - Оба подписаны: ключи должны совпасть.
 * - Был подписан, стал нет: смена издателя (подпись нельзя «потерять» молча).
 * - Не был подписан, стал подписан доверенным ключом: тот же (переход на подпись).
 * - Оба без подписи: сравниваем имя автора — это не защита от подделки, но
 *   ловит чужой пакет, который даже не притворяется тем же автором.
 */
function comparePublishers(previous, next) {
  if (previous.key && next.key) {
    return previous.key === next.key ? { same: true } : { same: false, reason: 'key-changed' };
  }
  if (previous.key && !next.key) return { same: false, reason: 'signature-lost' };
  if (!previous.key && next.key) return { same: true, signedNow: true };
  if (authorName({ name: previous.author }) !== authorName({ name: next.author })) {
    return { same: false, reason: 'author-changed' };
  }
  return { same: true, unverified: true };
}

function listDiff(before, after) {
  const prev = new Set(Array.isArray(before) ? before : []);
  const next = new Set(Array.isArray(after) ? after : []);
  return {
    added: [...next].filter((item) => !prev.has(item)),
    removed: [...prev].filter((item) => !next.has(item)),
  };
}

/**
 * Что меняет установка пакета поверх уже установленного плагина.
 * @returns {null|{publisherChanged: boolean, reason: string, keepData: boolean,
 *   signedNow: boolean, unverified: boolean, previousPublisher: object,
 *   publisher: object, addedPermissions: string[], removedPermissions: string[],
 *   addedHosts: string[], removedHosts: string[], downgrade: boolean,
 *   sameVersion: boolean, previousVersion: string}}
 */
function compareUpdate(current, inspection) {
  if (!current || !inspection?.manifest) return null;
  const manifest = inspection.manifest;
  const previousPublisher = recordPublisher(current);
  const publisher = publisherOf(inspection);
  const verdict = comparePublishers(previousPublisher, publisher);
  const permissions = listDiff(current.permissions, manifest.permissions);
  const hosts = listDiff(current.networkHosts, manifest.networkHosts);
  const order = compareVersions(manifest.version, current.version || '0.0.0');

  return {
    publisherChanged: !verdict.same,
    reason: verdict.reason || '',
    keepData: verdict.same,
    signedNow: verdict.signedNow === true,
    unverified: verdict.unverified === true,
    previousPublisher,
    publisher,
    addedPermissions: permissions.added,
    removedPermissions: permissions.removed,
    addedHosts: hosts.added,
    removedHosts: hosts.removed,
    downgrade: order < 0,
    sameVersion: order === 0,
    previousVersion: current.version || '',
  };
}

module.exports = {
  keyFingerprint,
  signerFingerprint,
  publisherOf,
  recordPublisher,
  comparePublishers,
  compareUpdate,
};
