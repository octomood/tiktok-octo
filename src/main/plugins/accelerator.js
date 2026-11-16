'use strict';

/**
 * Разбор сочетаний клавиш для плагинов.
 *
 * Плагины получают только внутриприложенческие сочетания: обрабатываются
 * через before-input-event, когда окно приложения активно. Глобальные
 * системные клавиши им недоступны.
 */

const KEY_RE =
  /^(?:[a-z0-9]|f(?:[1-9]|1[0-9]|2[0-4])|arrow(?:up|down|left|right)|enter|escape|space|tab|backspace|delete|home|end|pageup|pagedown|insert|\[|\]|;|'|,|\.|\/|\\|`|-|=)$/i;

const ALIASES = {
  ctrl: 'control',
  control: 'control',
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  super: 'meta',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
};

function normalizeAccelerator(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > 80) return null;

  const parts = value.split('+').map((part) => part.trim().toLowerCase());
  if (!parts.length) return null;

  const key = parts.pop();
  if (!KEY_RE.test(key)) return null;

  const result = { control: false, meta: false, alt: false, shift: false, key };
  for (const part of parts) {
    const modifier = ALIASES[part];
    if (!modifier) return null;
    result[modifier] = true;
  }
  // Без Ctrl/Cmd/Alt плагин перехватывал бы обычный ввод.
  if (!result.control && !result.meta && !result.alt) return null;
  return result;
}

function matchesInput(accelerator, input) {
  if (!accelerator || !input || input.type !== 'keyDown') return false;
  const key = String(input.key || '').toLowerCase();
  const expected = accelerator.key === 'space' ? ' ' : accelerator.key;
  return (
    Boolean(input.control) === accelerator.control &&
    Boolean(input.meta) === accelerator.meta &&
    Boolean(input.alt) === accelerator.alt &&
    Boolean(input.shift) === accelerator.shift &&
    key === expected
  );
}

module.exports = { normalizeAccelerator, matchesInput, KEY_RE };
