'use strict';

// Unicode-приближения публичных текстовых кодов TikTok, без загрузки картинок.
// Локализованные имена добавляем только по подтверждённым примерам: неизвестный
// текст в скобках не должен превращаться в случайный эмодзи.
const EMOJI = Object.freeze({
  smile: '🙂',
  happy: '😊',
  angry: '😠',
  cry: '😢',
  embarrassed: '😳',
  surprised: '😮',
  wronged: '🥺',
  shout: '😫',
  flushed: '😳',
  yummy: '😋',
  complacent: '😏',
  drool: '🤤',
  scream: '😱',
  weep: '😭',
  speechless: '😶',
  funnyface: '😜',
  laughwithtears: '😂',
  wicked: '😈',
  facewithrollingeyes: '🙄',
  sulk: '😒',
  thinking: '🤔',
  lovely: '🥰',
  greedy: '🤑',
  wow: '😲',
  joyful: '😄',
  hehe: '🤭',
  slap: '🤦',
  tears: '😥',
  stun: '😵',
  cute: '🥰',
  blink: '😉',
  disdain: '😒',
  astonish: '😲',
  rage: '😡',
  cool: '😎',
  excited: '🤩',
  proud: '😌',
  smileface: '☺️',
  evil: '😈',
  angel: '😇',
  laugh: '😆',
  pride: '😏',
  nap: '😴',
  loveface: '😍',
  awkward: '😅',
  shock: '😱',
  'глаза-сердечки': '😍',
});

function replaceEmojiCodes(text, emoji = EMOJI) {
  return text.replace(/\[([^\[\]\r\n]+)\]/gu, (code, name) => {
    const key = name.toLowerCase();
    return Object.prototype.hasOwnProperty.call(emoji, key) ? emoji[key] : code;
  });
}

// Сериализуется в страницу, не использует Node или внешнее состояние.
function installEmoji(emoji, replace) {
  if (window.__octoEmoji) return;
  const excluded =
    'head, script, style, noscript, template, textarea, input, select, option, ' +
    'pre, code, svg, math, [contenteditable], [role="textbox"]';
  const pending = new Set();
  let timer = null;

  function replaceNode(node) {
    if (!node.data.includes('[') || node.parentElement?.closest(excluded)) return;
    const next = replace(node.data, emoji);
    // Не пересоздаём элементы: обработчики, ссылки и разметка остаются на месте.
    if (next !== node.data) node.data = next;
  }

  function scan(root) {
    if (!root.isConnected) return;
    if (root.nodeType === 3) {
      replaceNode(root);
      return;
    }
    if (root.nodeType !== 1 || root.closest(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === 1) {
          return node.matches(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) replaceNode(walker.currentNode);
  }

  function flush() {
    timer = null;
    const roots = [...pending];
    pending.clear();
    for (const root of roots) scan(root);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        if (mutation.target.data.includes('[')) pending.add(mutation.target);
      } else {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 3) {
            if (node.data.includes('[')) pending.add(node);
          } else if (node.nodeType === 1) {
            if (
              node.childElementCount > 20 ||
              (node.textContent && node.textContent.includes('['))
            ) {
              pending.add(node);
            }
          }
        }
      }
    }
    if (pending.size && timer === null) timer = setTimeout(flush, 32);
  });
  // Наблюдаем документ, чтобы пережить замену body и SPA-переходы.
  observer.observe(document, { childList: true, characterData: true, subtree: true });
  window.__octoEmoji = { observer };
  if (document.documentElement) scan(document.documentElement);
}

const EMOJI_SCRIPT = `(${installEmoji.toString()})(${JSON.stringify(EMOJI)}, ${replaceEmojiCodes.toString()})`;

module.exports = { EMOJI, replaceEmojiCodes, EMOJI_SCRIPT };
