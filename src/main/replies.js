'use strict';

const { ctx, pushState, toast } = require('./app-context');
const { readState, writeState } = require('./store');
const { evalInPage } = require('./page-eval');

/**
 * Быстрые ответы.
 *
 * Свои шаблоны живут в палитре команд. Выбор шаблона вставляет текст в поле
 * сообщения открытого диалога и не отправляет его: последнее слово за
 * пользователем. Вставка идёт страничным скриптом, потому что поле ввода
 * бывает и textarea, и contenteditable.
 */

const MAX_REPLIES = 20;
const MAX_LENGTH = 400;

function readSettings() {
  const saved = readState().replies;
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((item) => typeof item === 'string' && item.trim())
    .slice(0, MAX_REPLIES)
    .map((item) => item.trim().slice(0, MAX_LENGTH));
}

function sync() {
  ctx.replies = readSettings();
}

function set(text) {
  const list = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_REPLIES)
    .map((line) => line.slice(0, MAX_LENGTH));

  writeState({ replies: list });
  sync();
  pushState();
  toast(list.length ? `Быстрых ответов: ${list.length}` : 'Быстрые ответы очищены');
}

function insertScript(text) {
  return `(() => {
    const value = ${JSON.stringify(text)};
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const nodes = [
      ...document.querySelectorAll(
        'textarea, input[type="text"], [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]',
      ),
    ].filter((node) => visible(node) && !node.disabled && !node.readOnly);
    const field = nodes[nodes.length - 1];
    if (!field) return false;

    field.focus();
    const tag = field.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(field);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, value);
    } catch (err) {
      inserted = false;
    }
    if (!inserted) {
      field.textContent = (field.textContent || '') + value;
      field.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }),
      );
    }
    return true;
  })()`;
}

function insert(index) {
  const text = ctx.replies[Number(index)];
  if (typeof text !== 'string') {
    toast('Быстрый ответ не найден');
    return false;
  }

  const chatWc = ctx.chatOpen ? ctx.chatView?.webContents : null;
  const wc = chatWc && !chatWc.isDestroyed() ? chatWc : ctx.view?.webContents;
  if (!wc || wc.isDestroyed()) {
    toast('Страница TikTok ещё не готова');
    return false;
  }

  evalInPage(wc, [insertScript(text)]);
  toast('Ответ вставлен в поле сообщения');
  return true;
}

sync();

module.exports = { sync, set, insert };
