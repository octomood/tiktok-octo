'use strict';

const { test, expect } = require('@playwright/test');
const { decodeArgument, targetFromArgv } = require('../src/main/deep-link-url');

/**
 * Ссылки из системы: схема tiktok-octo://, обычный argv и отказ чужим хостам.
 * Сам обработчик в main проверяется вручную: в тестах MPRIS и D-Bus выключены,
 * а открывать настоящий TikTok тест не должен.
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
