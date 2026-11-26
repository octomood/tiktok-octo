'use strict';

const { nativeImage } = require('electron');
const { ctx } = require('./app-context');

const LABEL = 'TikTok Octo';

/**
 * Подпись в углу снимка.
 *
 * В main нет ни canvas, ни своей отрисовки, поэтому PNG уходит в renderer
 * окна интерфейса: там картинка кладётся на canvas, поверх рисуется подпись,
 * а обратно приходит готовый data URL. Если окно недоступно, снимок остаётся
 * без подписи — терять кадр из-за оформления нельзя.
 */

function composeScript(dataUrl) {
  return `(() => {
    const source = ${JSON.stringify(dataUrl)};
    const label = ${JSON.stringify(LABEL)};
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const width = image.naturalWidth;
          const height = image.naturalHeight;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, width, height);

          const size = Math.max(12, Math.round(Math.min(width, height) * 0.026));
          const padX = Math.round(size * 0.7);
          const padY = Math.round(size * 0.38);
          const margin = Math.round(size * 0.9);
          context.font = '600 ' + size + 'px Inter, system-ui, sans-serif';
          const boxWidth = Math.ceil(context.measureText(label).width) + padX * 2;
          const boxHeight = size + padY * 2;
          const x = width - margin - boxWidth;
          const y = height - margin - boxHeight;

          context.beginPath();
          context.roundRect(x, y, boxWidth, boxHeight, boxHeight / 2);
          context.fillStyle = 'rgba(11, 11, 15, 0.58)';
          context.fill();

          context.fillStyle = 'rgba(255, 255, 255, 0.92)';
          context.textAlign = 'left';
          context.textBaseline = 'middle';
          context.fillText(label, x + padX, y + boxHeight / 2);

          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('watermark decode failed'));
      image.src = source;
    });
  })()`;
}

async function apply(image) {
  const win = ctx.win;
  if (!win || win.isDestroyed()) return image;
  const wc = win.webContents;
  if (!wc || wc.isDestroyed()) return image;

  try {
    const dataUrl = await wc.executeJavaScript(composeScript(image.toDataURL()), false);
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return image;
    const result = nativeImage.createFromDataURL(dataUrl);
    return result.isEmpty() ? image : result;
  } catch {
    return image;
  }
}

module.exports = { apply, LABEL };
