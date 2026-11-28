'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

/**
 * Модульный тест журнала событий: очистка секретов/URL/прокси, ограничение
 * частоты и запись/очистка файлов логов без запуска Electron.
 */

test('санитайзер скрывает токены, пароли, пути и query-значения', () => {
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-logger-'));
  const prevDir = process.env.OCTO_LOGS_DIR;
  process.env.OCTO_LOGS_DIR = logsDir;

  try {
    const logger = require('../src/main/logger');

    const cleanUrl = logger.sanitizeUrl(
      'https://accounts.google.com/signin/oauth/legacy/consent?authuser=0&part=SECRET_PART_VALUE&code=4/abc#access_token=xyz',
    );
    expect(cleanUrl).toContain('https://accounts.google.com/signin/oauth/legacy/consent');
    expect(cleanUrl).toContain('authuser=<1>');
    expect(cleanUrl).toContain('part=<скрыто>');
    expect(cleanUrl).toContain('code=<скрыто>');
    expect(cleanUrl).not.toContain('SECRET_PART_VALUE');
    expect(cleanUrl).not.toContain('4/abc');
    expect(cleanUrl).not.toContain('xyz');

    const cleanText = logger.sanitizeText(
      `home=${os.homedir()}/secret token=abc123456 Bearer my.jwt.token socks5://user:pass@127.0.0.1:1080`,
    );
    expect(cleanText).not.toContain(os.homedir());
    expect(cleanText).not.toContain('abc123456');
    expect(cleanText).not.toContain('user:pass');
    expect(cleanText).not.toContain('my.jwt.token');
    expect(cleanText).toContain('~');

    const proxyMeta = logger.sanitizeCommandPayload(
      'regionProxyApply',
      'socks5://alice:s3cr3t@127.0.0.1:1080',
    );
    expect(proxyMeta).toEqual({ enabled: true, scheme: 'socks5', hasAuth: true, port: 1080 });
    expect(JSON.stringify(proxyMeta)).not.toContain('alice');
    expect(JSON.stringify(proxyMeta)).not.toContain('s3cr3t');

    logger.clear();
    logger.info('auth', 'login attempt', { url: 'https://www.tiktok.com/login?token=secret123' });
    logger.throttled('k1', 60_000, 'WARN', 'chat', 'first warning');
    logger.throttled('k1', 60_000, 'WARN', 'chat', 'suppressed warning');
    logger.flush();

    const dump = logger.readAllLogs();
    expect(dump).toContain('[INFO] [auth] login attempt');
    expect(dump).toContain('https://www.tiktok.com/login?token=<скрыто>');
    expect(dump).not.toContain('secret123');
    expect(dump).toContain('first warning');
    expect(dump).not.toContain('suppressed warning');

    logger.clear();
    const afterClear = logger.readAllLogs();
    expect(afterClear).not.toContain('login attempt');
    expect(afterClear).toContain('logs cleared');
  } finally {
    if (prevDir === undefined) delete process.env.OCTO_LOGS_DIR;
    else process.env.OCTO_LOGS_DIR = prevDir;
    fs.rmSync(logsDir, { recursive: true, force: true });
  }
});
