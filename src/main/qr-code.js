'use strict';

const qrcode = require('qrcode-generator');

/**
 * Матрица QR-кода без Electron: строки из «1» и «0», которые renderer
 * рисует на canvas. Вынесено отдельно, чтобы проверять кодирование тестом
 * без запуска приложения.
 */

function build(text, level = 'M') {
  if (typeof text !== 'string' || !text) throw new Error('empty text');
  const qr = qrcode(0, level);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const rows = [];
  for (let row = 0; row < count; row += 1) {
    let line = '';
    for (let column = 0; column < count; column += 1) {
      line += qr.isDark(row, column) ? '1' : '0';
    }
    rows.push(line);
  }
  return { count, rows };
}

module.exports = { build };
