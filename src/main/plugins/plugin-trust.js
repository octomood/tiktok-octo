'use strict';

/**
 * Публичные ключи, которым доверяет приложение.
 *
 * Приватный ключ хранится только в CI/у автора каталога и никогда не попадает
 * в репозиторий. Формат — PEM SubjectPublicKeyInfo для Ed25519:
 *
 *   node scripts/plugin-keygen.js
 *
 * Полученный public.pem вставьте сюда, private.pem — в секрет
 * OCTO_PLUGIN_SIGNING_KEY. Пустой массив означает «подписей нет»: любые
 * заявленные подписи будут отклонены, неподписанные плагины — по настройкам.
 */
const PUBLIC_KEYS = [];

module.exports = { PUBLIC_KEYS };
