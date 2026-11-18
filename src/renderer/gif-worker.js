'use strict';

/**
 * Кодировщик GIF для скрытого окна.
 *
 * Кадры приходят JPEG-ами из страницы сайта, здесь декодируются на canvas и
 * упаковываются в GIF библиотекой gifenc. Ничего никуда не уходит: результат
 * возвращается в main как base64.
 */

import { GIFEncoder, quantize, applyPalette } from './vendor/gifenc.esm.js';

const canvas = document.createElement('canvas');

function decode(dataUrl, width, height) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(context.getImageData(0, 0, width, height));
    };
    image.onerror = () => reject(new Error('frame decode failed'));
    image.src = dataUrl;
  });
}

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
  }
  return window.btoa(binary);
}

async function encode(job) {
  const frames = Array.isArray(job.frames) ? job.frames : [];
  const width = Math.max(2, Math.round(Number(job.width) || 320));
  const height = Math.max(2, Math.round(Number(job.height) || 320));
  const delay = Math.max(20, Math.round(Number(job.delay) || 100));
  if (!frames.length) throw new Error('no frames');

  const gif = GIFEncoder();
  for (const frame of frames) {
    const data = await decode(frame, width, height);
    const palette = quantize(data.data, 256);
    const index = applyPalette(data.data, palette);
    gif.writeFrame(index, width, height, { palette, delay });
  }
  gif.finish();
  return gif.bytes();
}

window.gifWorker.onJob(async (job) => {
  try {
    const bytes = await encode(job);
    window.gifWorker.done({ ok: true, base64: toBase64(bytes) });
  } catch (error) {
    window.gifWorker.done({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
});
