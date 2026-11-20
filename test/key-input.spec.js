'use strict';

const { test, expect } = require('@playwright/test');
const { keyFromCode, keyFromInput } = require('../src/main/key-input');
const { normalizeAccelerator, matchesInput } = require('../src/main/plugins/accelerator');

/**
 * Сочетания не должны зависеть от раскладки: на русской клавиатуре
 * Ctrl+Shift+C приходит с key «С», но физическая клавиша та же.
 */

test('ключ события: латиница по символу, остальное по code', () => {
  // Русская раскладка: key кириллический, code остаётся латинским.
  expect(keyFromInput({ key: 'С', code: 'KeyC' })).toBe('C');
  expect(keyFromInput({ key: 'и', code: 'KeyB' })).toBe('B');
  expect(keyFromInput({ key: 'Ф', code: 'KeyA' })).toBe('A');
  // Латинскую раскладку не переводим на позиции: важен назначенный символ.
  expect(keyFromInput({ key: 'c', code: 'KeyC' })).toBe('c');
  expect(keyFromInput({ key: 'q', code: 'KeyA' })).toBe('q');
  // Именованные клавиши и служебные символы раскладка не меняет.
  expect(keyFromInput({ key: 'Escape', code: 'Escape' })).toBe('Escape');
  expect(keyFromInput({ key: 'ArrowLeft', code: 'ArrowLeft' })).toBe('ArrowLeft');
  expect(keyFromInput({ key: 'F11', code: 'F11' })).toBe('F11');
  expect(keyFromInput({ key: '+', code: 'Equal' })).toBe('+');
  // Без ASCII key остаётся физическая клавиша, включая цифры и знаки.
  expect(keyFromInput({ key: '', code: 'Digit0' })).toBe('0');
  expect(keyFromInput({ key: '', code: 'Minus' })).toBe('-');
  expect(keyFromInput({ key: 'Process', code: 'KeyZ' })).toBe('Z');
  expect(keyFromInput({ key: 'Shift', code: 'ShiftLeft' })).toBe('');
  expect(keyFromCode('NumpadAdd')).toBe('+');
});

test('сочетание плагина совпадает на нелатинской раскладке', () => {
  const accelerator = normalizeAccelerator('Ctrl+Shift+Y');
  expect(accelerator).not.toBeNull();
  expect(
    matchesInput(accelerator, {
      type: 'keyDown',
      key: 'Н',
      code: 'KeyY',
      control: true,
      shift: true,
    }),
  ).toBe(true);
  expect(
    matchesInput(accelerator, {
      type: 'keyDown',
      key: 'y',
      code: 'KeyY',
      control: true,
      shift: true,
    }),
  ).toBe(true);
});
