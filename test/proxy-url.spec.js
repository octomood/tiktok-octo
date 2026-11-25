'use strict';

const { test, expect } = require('@playwright/test');
const { stripProxyCredentials, stripRegionCredentials } = require('../src/main/proxy-url');

/**
 * Пароль прокси не должен уезжать в экспорт настроек, резервные копии и
 * «мой архив», но адрес без учётных данных остаётся полезным.
 */

test('адрес прокси без логина и пароля', () => {
  expect(stripProxyCredentials('http://user:pass@127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
  expect(stripProxyCredentials('socks5://user:100%@host:1080')).toBe('socks5://host:1080');
  expect(stripProxyCredentials('socks5://user@host:1080')).toBe('socks5://host:1080');
  expect(stripProxyCredentials('user:pass@host:1080')).toBe('host:1080');
  expect(stripProxyCredentials('http://user:p%40ss@host:8080')).toBe('http://host:8080');
  expect(stripProxyCredentials('http://user:[bad@host:8080')).toBe('http://host:8080');

  // Без учётных данных строку не переписываем: сохраняем вид адреса.
  expect(stripProxyCredentials('http://host:8080')).toBe('http://host:8080');
  expect(stripProxyCredentials('http://host:8080/path@x')).toBe('http://host:8080/path@x');
  expect(stripProxyCredentials('socks5://host')).toBe('socks5://host');
  expect(stripProxyCredentials('')).toBe('');
  expect(stripProxyCredentials('не адрес')).toBe('не адрес');
});

test('регион в файле: пароль убран, остальные ключи на месте', () => {
  expect(stripRegionCredentials({ preset: 'us', proxy: 'socks5://u:p@h:1080' })).toEqual({
    preset: 'us',
    proxy: 'socks5://h:1080',
  });
  expect(stripRegionCredentials({ preset: 'off' })).toEqual({ preset: 'off' });
  expect(stripRegionCredentials(null)).toEqual({});
});
