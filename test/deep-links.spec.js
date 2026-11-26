'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const {
  decodeArgument,
  targetFromArgv,
  externalHttpUrlFromArgv,
} = require('../src/main/deep-link-url');
const linkHandler = require('../src/main/link-handler');

/**
 * Ссылки из системы: схема tiktok-octo://, обычный argv, отказ чужим хостам
 * и разбор .desktop Exec= для проброса остальных URL в браузер.
 */

test('ссылки: схема tiktok-octo и argv открывают только TikTok', () => {
  expect(decodeArgument('tiktok-octo://www.tiktok.com/@octo/video/123')).toBe(
    'https://www.tiktok.com/@octo/video/123',
  );
  expect(
    decodeArgument('tiktok-octo://open?url=https%3A%2F%2Fwww.tiktok.com%2F%40octo%2Fvideo%2F9'),
  ).toBe('https://www.tiktok.com/@octo/video/9');
  expect(decodeArgument('https://www.tiktok.com/@octo/video/1?is_from_webapp=1')).toBe(
    'https://www.tiktok.com/@octo/video/1?is_from_webapp=1',
  );
  expect(decodeArgument('http://vm.tiktok.com/ZS12345/')).toBe('https://vm.tiktok.com/ZS12345/');
  expect(decodeArgument('https://vt.tiktok.com/ZS12345/')).toBe('https://vt.tiktok.com/ZS12345/');

  expect(
    targetFromArgv([
      '/opt/tiktok-octo/tiktok-octo',
      '--no-sandbox',
      'tiktok-octo://open?url=https%3A%2F%2Fwww.tiktok.com%2F%40octo%2Fvideo%2F7',
    ]),
  ).toBe('https://www.tiktok.com/@octo/video/7');

  // Чужие хосты и мусор не считаются ссылкой TikTok.
  expect(targetFromArgv(['https://evil.example/video/1'])).toBe('');
  expect(targetFromArgv(['tiktok-octo://open?url=https%3A%2F%2Fevil.example%2F'])).toBe('');
  expect(decodeArgument('not a url')).toBe('');
  expect(decodeArgument('')).toBe('');
});

test('внешние http/https ссылки из argv отделяются от TikTok и флагов', () => {
  expect(
    externalHttpUrlFromArgv([
      '/opt/tiktok-octo/tiktok-octo',
      '--open-link',
      'https://github.com/octomood/tiktok-octo',
    ]),
  ).toBe('https://github.com/octomood/tiktok-octo');

  expect(externalHttpUrlFromArgv(['--open-link', 'http://example.com/path?a=1'])).toBe(
    'http://example.com/path?a=1',
  );

  expect(externalHttpUrlFromArgv(['--open-link', 'https://www.tiktok.com/@octo/video/1'])).toBe('');
  expect(externalHttpUrlFromArgv(['--open-link', 'http://vt.tiktok.com/ZS123/'])).toBe('');
  expect(externalHttpUrlFromArgv(['tiktok-octo://open?url=https%3A%2F%2Fexample.com%2F'])).toBe('');
  expect(externalHttpUrlFromArgv(['file:///etc/passwd'])).toBe('');
});

test('parseExecLine и readDesktopExec корректно разбирают .desktop браузера', () => {
  expect(linkHandler.parseExecLine('/usr/bin/firefox %u', 'https://example.com/')).toEqual({
    cmd: '/usr/bin/firefox',
    args: ['https://example.com/'],
  });

  expect(
    linkHandler.parseExecLine(
      '"/opt/google/chrome/chrome" --profile-directory="Default" %U',
      'https://example.com/?a=1',
    ),
  ).toEqual({
    cmd: '/opt/google/chrome/chrome',
    args: ['--profile-directory=Default', 'https://example.com/?a=1'],
  });

  expect(linkHandler.parseExecLine('chromium --new-window', 'https://example.com/')).toEqual({
    cmd: 'chromium',
    args: ['--new-window', 'https://example.com/'],
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-desktop-'));
  try {
    const desktopFile = path.join(tmp, 'test-browser.desktop');
    fs.writeFileSync(
      desktopFile,
      [
        '[Desktop Entry]',
        'Name=Test Browser',
        'Exec=/usr/bin/test-browser %U',
        '[Desktop Action new-window]',
        'Exec=/usr/bin/test-browser --new-window',
      ].join('\n'),
    );
    expect(linkHandler.readDesktopExec(desktopFile)).toBe('/usr/bin/test-browser %U');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
