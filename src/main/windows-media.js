'use strict';

const { nativeImage } = require('electron');
const { t } = require('./i18n');

/**
 * Кнопки в превью панели задач Windows.
 *
 * SMTC для метаданных и play/pause даёт Chromium через media session сайта,
 * а здесь добавляем быстрые действия в thumbnail toolbar. На других
 * платформах модуль молча выключен.
 */

const ICONS = {
  play: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVR42tXTsQ0AIAzAsP7/tDmCINEhq7cM5qb5ElAACkABKAAFoAAUgALwHFg20wGF3jL4YEvgrAAAAABJRU5ErkJggg==',
  pause:
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIUlEQVR42mP4//8/AyWYYVAagAwIio8aMGoAzQwYYpkJAGG2OPJPg2PtAAAAAElFTkSuQmCC',
  pip: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKUlEQVR42mP4//8/AyWYYVAZQA6gjQHEOH2IGUBxGAxBAwYuIQ1MZgIA7WdgyulUs4cAAAAASUVORK5CYII=',
  messages:
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALElEQVR42mP4//8/AyWYYVAZQA6gjQHEOH3UAFrHAtkG4DKMrKRMsQH0y0wAROlK4OihvAAAAAAASUVORK5CYII=',
  mute: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR42mP4//8/AyWYYdQADAPQAcUGEDRoBBgwmhLpYQAAd5sdDoKbhEEAAAAASUVORK5CYII=',
};

let target = null;

/** Ленивый require: модуль грузится из view раньше команд. */
function run(command) {
  try {
    require('./commands').handleCommand(command);
  } catch {
    /* окно уже закрывается */
  }
}

function icon(name) {
  return nativeImage.createFromDataURL(`data:image/png;base64,${ICONS[name]}`);
}

function install(win, playing = false) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  target = win;
  try {
    win.setThumbarButtons([
      {
        tooltip: playing ? t('Пауза') : t('Воспроизведение'),
        icon: icon(playing ? 'pause' : 'play'),
        click: () => run('togglePlayback'),
      },
      {
        tooltip: t('Картинка в картинке'),
        icon: icon('pip'),
        click: () => run('pip'),
      },
      {
        tooltip: t('Сообщения'),
        icon: icon('messages'),
        click: () => run('chat'),
      },
      {
        tooltip: t('Без звука'),
        icon: icon('mute'),
        click: () => run('mute'),
      },
    ]);
  } catch {
    /* старая версия Windows или тема без thumbnail toolbar */
  }
}

function setPlaying(playing) {
  if (target) install(target, playing === true);
}

module.exports = { install, setPlaying };
