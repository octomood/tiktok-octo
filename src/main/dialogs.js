'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { ctx, setAppDialogOpen } = require('./app-context');
const { t } = require('./i18n');
const windowChrome = require('./window-chrome');

/**
 * Системные диалоги сообщений в стиле MD3 Expressive.
 *
 * `showMessageBox` и `showErrorBox` показывают кастомную модалку вместо
 * нативных Win32/GTK/Cocoa диалогов: оверлей в главном окне, если оно открыто,
 * или безрамочное модальное окно, если главное окно скрыто или диалог вызван
 * поверх дочернего окна. Файловые проводники (`showOpenDialog` / `showSaveDialog`)
 * остаются нативными.
 */

let nextToken = 1;
let active = null;
let queue = Promise.resolve();
let ipcInstalled = false;

function localizeRich(rich) {
  if (!rich || typeof rich !== 'object') return null;
  const next = { ...rich };
  if (next.summary && typeof next.summary === 'object') {
    next.summary = {
      ...next.summary,
      title: typeof next.summary.title === 'string' ? t(next.summary.title) : next.summary.title,
      subtitle:
        typeof next.summary.subtitle === 'string'
          ? t(next.summary.subtitle)
          : next.summary.subtitle,
      description:
        typeof next.summary.description === 'string'
          ? t(next.summary.description)
          : next.summary.description,
    };
  }
  if (Array.isArray(next.badges)) {
    next.badges = next.badges.map((item) =>
      item && typeof item === 'object'
        ? {
            ...item,
            label: typeof item.label === 'string' ? t(item.label) : item.label,
            value: typeof item.value === 'string' ? t(item.value) : item.value,
          }
        : item,
    );
  }
  if (typeof next.permissionsTitle === 'string') next.permissionsTitle = t(next.permissionsTitle);
  if (Array.isArray(next.permissions)) {
    next.permissions = next.permissions.map((perm) =>
      perm && typeof perm === 'object'
        ? {
            ...perm,
            label: typeof perm.label === 'string' ? t(perm.label) : perm.label,
            riskLabel: typeof perm.riskLabel === 'string' ? t(perm.riskLabel) : perm.riskLabel,
            description:
              typeof perm.description === 'string' ? t(perm.description) : perm.description,
          }
        : perm,
    );
  }
  if (typeof next.hostsTitle === 'string') next.hostsTitle = t(next.hostsTitle);
  if (typeof next.filesTitle === 'string') next.filesTitle = t(next.filesTitle);
  if (Array.isArray(next.sections)) {
    next.sections = next.sections.map((sec) =>
      sec && typeof sec === 'object'
        ? {
            ...sec,
            title: typeof sec.title === 'string' ? t(sec.title) : sec.title,
            items: Array.isArray(sec.items)
              ? sec.items.map((entry) => (typeof entry === 'string' ? t(entry) : entry))
              : sec.items,
          }
        : sec,
    );
  }
  if (Array.isArray(next.notices)) {
    next.notices = next.notices.map((line) => (typeof line === 'string' ? t(line) : line));
  }
  return next;
}

function localizeOptions(options) {
  if (!options || typeof options !== 'object') return options;
  const next = { ...options };

  for (const key of ['title', 'message', 'detail', 'buttonLabel']) {
    if (typeof next[key] === 'string') next[key] = t(next[key]);
  }

  if (Array.isArray(next.buttons)) {
    next.buttons = next.buttons.map((button) => (typeof button === 'string' ? t(button) : button));
  }

  if (Array.isArray(next.filters)) {
    next.filters = next.filters.map((filter) =>
      filter && typeof filter === 'object'
        ? { ...filter, name: typeof filter.name === 'string' ? t(filter.name) : filter.name }
        : filter,
    );
  }

  if (next.rich) {
    next.rich = localizeRich(next.rich);
  }

  return next;
}

function installIpc() {
  if (ipcInstalled) return;
  ipcInstalled = true;

  ipcMain.on('octo:app-dialog-ready', (event) => {
    if (!active || !active.standaloneWin || active.standaloneWin.isDestroyed()) return;
    if (event.sender !== active.standaloneWin.webContents) return;
    try {
      active.standaloneWin.webContents.send('octo:app-dialog', {
        action: 'open',
        token: active.token,
        ...active.payload,
      });
    } catch {
      /* окно закрывается */
    }
  });

  ipcMain.on('octo:app-dialog-result', (event, data) => {
    if (!active || !data || data.token !== active.token) return;
    const expectedWc = active.standaloneWin
      ? !active.standaloneWin.isDestroyed() && active.standaloneWin.webContents
      : ctx.win && !ctx.win.isDestroyed() && ctx.win.webContents;
    if (!expectedWc || event.sender !== expectedWc) return;
    const index = Number.isInteger(data.response) ? data.response : active.fallbackIndex;
    active.finish(index);
  });
}

function cancelActive() {
  if (!active) return;
  active.finish(active.fallbackIndex);
}

function estimateStandaloneHeight(payload) {
  let height = 210;
  if (payload.rich) {
    height += 120;
    height += Math.min(260, (payload.rich.permissions?.length || 0) * 56);
    if (payload.rich.hosts?.length) height += 70;
    if (payload.rich.notices?.length) height += 80;
  } else if (payload.detail) {
    const lines = String(payload.detail).split('\n').length;
    height += Math.min(340, Math.max(48, lines * 22));
  }
  return Math.max(220, Math.min(680, height));
}

function openSingleDialog(parent, options) {
  installIpc();
  const localized = localizeOptions(options || {});
  const buttons =
    Array.isArray(localized.buttons) && localized.buttons.length ? localized.buttons : [t('ОК')];
  const cancelId = Number.isInteger(localized.cancelId)
    ? localized.cancelId
    : buttons.length > 1
      ? buttons.length - 1
      : 0;
  const defaultId = Number.isInteger(localized.defaultId) ? localized.defaultId : 0;
  const fallbackIndex = cancelId >= 0 && cancelId < buttons.length ? cancelId : 0;

  const payload = {
    type: localized.type || 'info',
    title: localized.title || '',
    message: localized.message || '',
    detail: localized.detail || '',
    buttons,
    defaultId,
    cancelId,
    brandIcon: Boolean(localized.icon && fs.existsSync(localized.icon)),
    destructive: Boolean(localized.destructive),
    rich: localized.rich || null,
  };

  const canOverlay = Boolean(
    ctx.win && !ctx.win.isDestroyed() && ctx.win.isVisible() && (!parent || parent === ctx.win),
  );

  return new Promise((resolve) => {
    const token = `app-dlg-${nextToken++}`;
    let done = false;

    const finish = (responseIndex) => {
      if (done) return;
      done = true;
      const current = active;
      active = null;

      if (current?.standaloneWin && !current.standaloneWin.isDestroyed()) {
        try {
          current.standaloneWin.close();
        } catch {
          /* уже закрывается */
        }
      } else {
        setAppDialogOpen(false);
        if (ctx.win && !ctx.win.isDestroyed()) {
          try {
            ctx.win.webContents.send('octo:app-dialog', { action: 'close', token });
          } catch {
            /* окно закрывается */
          }
        }
      }

      const safeIndex =
        Number.isInteger(responseIndex) && responseIndex >= 0 && responseIndex < buttons.length
          ? responseIndex
          : fallbackIndex;
      resolve({ response: safeIndex, checkboxChecked: false });
    };

    if (canOverlay) {
      active = { token, payload, fallbackIndex, finish, standaloneWin: null };
      setAppDialogOpen(true);
      try {
        ctx.win.webContents.send('octo:app-dialog', {
          action: 'open',
          token,
          ...payload,
        });
      } catch {
        finish(fallbackIndex);
      }
      return;
    }

    const modalParent = parent && !parent.isDestroyed() && parent.isVisible() ? parent : undefined;
    const dlgWin = new BrowserWindow(
      windowChrome.framelessOptions({
        width: payload.rich ? 560 : 480,
        height: estimateStandaloneHeight(payload),
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        center: true,
        show: false,
        parent: modalParent,
        modal: Boolean(modalParent),
        title: payload.title || payload.message || 'TikTok Octo',
        webPreferences: {
          preload: path.join(__dirname, 'dialog-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      }),
    );
    windowChrome.attach(dlgWin, { closeOnEscape: false });

    active = { token, payload, fallbackIndex, finish, standaloneWin: dlgWin };
    dlgWin.on('closed', () => finish(fallbackIndex));
    dlgWin.once('ready-to-show', () => {
      if (!dlgWin.isDestroyed()) {
        dlgWin.show();
        dlgWin.focus();
      }
    });
    dlgWin.loadFile(path.join(__dirname, '../renderer/dialog.html'));
  });
}

function showMessageBox(parentOrOptions, maybeOptions) {
  const hasParent = maybeOptions !== undefined;
  const parent = hasParent ? parentOrOptions : undefined;
  const options = hasParent ? maybeOptions : parentOrOptions;

  if (!app.isReady()) {
    return hasParent
      ? dialog.showMessageBox(parent, localizeOptions(options))
      : dialog.showMessageBox(localizeOptions(options));
  }

  const run = () => openSingleDialog(parent, options);
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

function showOpenDialog(parentOrOptions, maybeOptions) {
  if (maybeOptions === undefined) {
    return dialog.showOpenDialog(localizeOptions(parentOrOptions));
  }
  return dialog.showOpenDialog(parentOrOptions, localizeOptions(maybeOptions));
}

function showSaveDialog(parentOrOptions, maybeOptions) {
  if (maybeOptions === undefined) {
    return dialog.showSaveDialog(localizeOptions(parentOrOptions));
  }
  return dialog.showSaveDialog(parentOrOptions, localizeOptions(maybeOptions));
}

function showErrorBox(title, content) {
  if (!app.isReady()) {
    return dialog.showErrorBox(t(title), typeof content === 'string' ? t(content) : content);
  }
  return showMessageBox({
    type: 'error',
    title,
    message: typeof content === 'string' ? content : String(content || ''),
    buttons: ['ОК'],
    defaultId: 0,
    cancelId: 0,
  });
}

module.exports = {
  showMessageBox,
  showOpenDialog,
  showSaveDialog,
  showErrorBox,
  cancelActive,
};
