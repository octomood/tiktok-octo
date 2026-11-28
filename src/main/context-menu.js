'use strict';

const path = require('node:path');
const { WebContentsView, ipcMain } = require('electron');
const { ctx } = require('./app-context');

/**
 * Кастомное MD3-контекстное меню поверх WebContentsView.
 *
 * Реализовано как дочерний WebContentsView внутри главного окна: это работает
 * по точным локальным координатам окна даже на Wayland, где BrowserWindow не
 * может позиционировать себя у курсора.
 */

let menuView = null;
let viewReady = false;
let pendingOpen = null;
let ipcInstalled = false;
let nextToken = 1;
let active = null;
const winListenersAttached = new WeakSet();

function close() {
  if (!active && (!menuView || menuView.webContents.isDestroyed())) return;
  active = null;
  pendingOpen = null;
  if (menuView && !menuView.webContents.isDestroyed()) {
    try {
      menuView.setVisible(false);
      menuView.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    } catch {
      /* окно закрывается */
    }
  }
}

function isOpen() {
  return Boolean(active);
}

function dispose() {
  close();
  if (menuView) {
    try {
      if (ctx.win && !ctx.win.isDestroyed()) {
        ctx.win.contentView.removeChildView(menuView);
      }
      if (!menuView.webContents.isDestroyed()) menuView.webContents.close();
    } catch {
      /* уже уничтожено */
    }
  }
  menuView = null;
  viewReady = false;
}

function installIpc() {
  if (ipcInstalled) return;
  ipcInstalled = true;

  ipcMain.on('octo:ctx-menu-ready', (event) => {
    if (!menuView || menuView.webContents.isDestroyed() || event.sender !== menuView.webContents) {
      return;
    }
    viewReady = true;
    if (pendingOpen) {
      const payload = pendingOpen;
      pendingOpen = null;
      sendOpen(payload);
    }
  });

  ipcMain.on('octo:ctx-menu-size', (event, data) => {
    if (!menuView || menuView.webContents.isDestroyed() || event.sender !== menuView.webContents) {
      return;
    }
    if (!active || !data || data.token !== active.token) return;
    if (!ctx.win || ctx.win.isDestroyed()) return;

    const [winW, winH] = ctx.win.getContentSize();
    const width = Math.max(120, Math.min(winW - 8, Number(data.width) || 230));
    const height = Math.max(40, Math.min(winH - 8, Number(data.height) || 120));
    const margin = 4;

    let x = Math.round(active.anchorX);
    let y = Math.round(active.anchorY);
    if (x + width > winW - margin) x = Math.max(margin, active.anchorX - width);
    if (y + height > winH - margin) y = Math.max(margin, active.anchorY - height);
    x = Math.max(margin, Math.min(winW - width - margin, x));
    y = Math.max(margin, Math.min(winH - height - margin, y));

    try {
      // Переносим на самый верх стека поверх view и chatView.
      ctx.win.contentView.addChildView(menuView);
      menuView.setBounds({ x, y, width, height });
      menuView.setVisible(true);
      menuView.webContents.focus();
    } catch {
      close();
    }
  });

  ipcMain.on('octo:ctx-menu-pick', (event, data) => {
    if (!menuView || menuView.webContents.isDestroyed() || event.sender !== menuView.webContents) {
      return;
    }
    if (!active || !data || data.token !== active.token) return;
    const handler = active.actions.get(data.id);
    const targetWc = active.targetWc;
    close();
    if (targetWc && !targetWc.isDestroyed()) {
      try {
        targetWc.focus();
      } catch {
        /* view закрывается */
      }
    }
    if (typeof handler === 'function') {
      setTimeout(() => {
        try {
          handler();
        } catch {
          /* действие контекстного меню */
        }
      }, 0);
    }
  });

  ipcMain.on('octo:ctx-menu-close', (event) => {
    if (!menuView || menuView.webContents.isDestroyed() || event.sender !== menuView.webContents) {
      return;
    }
    const targetWc = active?.targetWc;
    close();
    if (targetWc && !targetWc.isDestroyed()) {
      try {
        targetWc.focus();
      } catch {
        /* view закрывается */
      }
    }
  });
}

function ensureView() {
  if (!ctx.win || ctx.win.isDestroyed()) return null;
  installIpc();

  if (!winListenersAttached.has(ctx.win)) {
    winListenersAttached.add(ctx.win);
    for (const eventName of ['blur', 'resize', 'hide', 'minimize', 'close']) {
      ctx.win.on(eventName, close);
    }
  }

  if (menuView && !menuView.webContents.isDestroyed()) return menuView;

  viewReady = false;
  menuView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'context-menu-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  menuView.setBackgroundColor('#00000000');
  ctx.win.contentView.addChildView(menuView);
  menuView.setVisible(false);
  menuView.setBounds({ x: 0, y: 0, width: 1, height: 1 });

  menuView.webContents.on('blur', close);
  menuView.webContents.on('destroyed', () => {
    menuView = null;
    viewReady = false;
    active = null;
  });

  menuView.webContents.loadFile(path.join(__dirname, '../renderer/context-menu.html'));
  return menuView;
}

function sendOpen(payload) {
  if (!menuView || menuView.webContents.isDestroyed()) return;
  try {
    menuView.webContents.send('octo:ctx-menu-open', payload);
  } catch {
    close();
  }
}

function anchorInWindow(targetWc, params) {
  const rawX = Number(params?.x) || 0;
  const rawY = Number(params?.y) || 0;
  if (ctx.view && !ctx.view.webContents.isDestroyed() && targetWc === ctx.view.webContents) {
    const b = ctx.view.getBounds();
    return { x: b.x + rawX, y: b.y + rawY };
  }
  if (
    ctx.chatView &&
    !ctx.chatView.webContents.isDestroyed() &&
    targetWc === ctx.chatView.webContents
  ) {
    const b = ctx.chatView.getBounds();
    return { x: b.x + rawX, y: b.y + rawY };
  }
  return { x: rawX, y: rawY };
}

function open({ targetWc, params, items }) {
  if (!ctx.win || ctx.win.isDestroyed()) return false;
  const view = ensureView();
  if (!view) return false;

  const actions = new Map();
  const serialized = [];
  let seq = 1;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'separator') {
      // Не ставим подряд или в начале/конце.
      if (serialized.length && serialized[serialized.length - 1].type !== 'separator') {
        serialized.push({ type: 'separator' });
      }
      continue;
    }
    const id = `item-${seq++}`;
    let handler = item.click;
    if (!handler && item.role) {
      const role = item.role;
      handler = () => {
        if (!targetWc || targetWc.isDestroyed()) return;
        if (role === 'cut') targetWc.cut();
        else if (role === 'copy') targetWc.copy();
        else if (role === 'paste') targetWc.paste();
        else if (role === 'selectAll') targetWc.selectAll();
      };
    }
    if (handler) actions.set(id, handler);
    serialized.push({
      id,
      type: 'item',
      label: String(item.label || ''),
      enabled: item.enabled !== false,
    });
  }

  while (serialized.length && serialized[serialized.length - 1].type === 'separator') {
    serialized.pop();
  }
  if (!serialized.length) return false;

  const token = `ctx-${nextToken++}`;
  const anchor = anchorInWindow(targetWc, params);
  active = {
    token,
    targetWc,
    anchorX: anchor.x,
    anchorY: anchor.y,
    actions,
  };

  const payload = { token, items: serialized };
  if (viewReady) sendOpen(payload);
  else pendingOpen = payload;
  return true;
}

function syncTheme(payload) {
  if (!menuView || menuView.webContents.isDestroyed()) return;
  try {
    menuView.webContents.send('octo:theme-changed', payload);
  } catch {
    /* view закрывается */
  }
}

function syncI18n(data) {
  if (!menuView || menuView.webContents.isDestroyed()) return;
  try {
    menuView.webContents.send('octo:i18n-changed', data);
  } catch {
    /* view закрывается */
  }
}

function syncUiCustom(payload) {
  if (!menuView || menuView.webContents.isDestroyed()) return;
  try {
    menuView.webContents.send('octo:ui-custom-changed', payload);
  } catch {
    /* view закрывается */
  }
}

module.exports = { open, close, isOpen, dispose, syncTheme, syncI18n, syncUiCustom };
