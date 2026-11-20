'use strict';

/**
 * Клавиша из события без привязки к раскладке.
 *
 * before-input-event и DOM отдают key с учётом раскладки: на русской
 * Ctrl+Shift+C приходит как Ctrl+Shift+С, и сочетание перестаёт совпадать.
 * Для таких клавиш берём физический code. Латинский символ оставляем по key:
 * на AZERTY и Dvorak пользователь ожидает назначенную букву, а не позицию.
 */

const NAMED = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Space',
  'Escape',
  'Esc',
  'Enter',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
]);

const CODE_KEYS = {
  Space: ' ',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  NumpadAdd: '+',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadDecimal: '.',
};

/** Физическая клавиша → символ для сочетаний. */
function keyFromCode(code) {
  if (typeof code !== 'string' || !code) return '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return CODE_KEYS[code] || '';
}

/** ASCII-символ или именованная клавиша: их key не зависит от языка. */
function printable(key) {
  return typeof key === 'string' && /^[\x20-\x7e]$/.test(key);
}

/** Клавиша события: key для латиницы, code для нелатинской раскладки. */
function keyFromInput(input) {
  if (!input || typeof input !== 'object') return '';
  const key = input.key;
  if (typeof key === 'string' && (NAMED.has(key) || printable(key))) return key;
  return keyFromCode(input.code);
}

module.exports = { keyFromCode, keyFromInput };
