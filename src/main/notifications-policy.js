'use strict';

/**
 * Правила уведомлений без Electron: их удобно проверять обычным тестом.
 *
 * Заголовок TikTok даёт только число непрочитанных, поэтому тип сообщения
 * определить нельзя. Зато можно не беспокоить, когда окно активно, и уважать
 * расписание «не беспокоить», в том числе через полночь.
 */

function minutesOfTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function inQuietHours(nowMinutes, from, to) {
  const start = minutesOfTime(from);
  const end = minutesOfTime(to);
  if (start === null || end === null || start === end) return false;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

function shouldNotify(options = {}) {
  if (!options.enabled) return false;
  if (!(Number(options.next) > Number(options.previous || 0))) return false;
  if (options.quietFocused && options.focused) return false;
  if (
    options.dnd &&
    inQuietHours(Number(options.nowMinutes) || 0, options.dndFrom, options.dndTo)
  ) {
    return false;
  }
  return true;
}

module.exports = { minutesOfTime, inQuietHours, shouldNotify };
