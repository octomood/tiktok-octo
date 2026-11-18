'use strict';

/**
 * Редактор снимка: стрелка, рамка и размытие на canvas.
 * Сохранение возвращает PNG в main — файл и буфер обмена.
 */

const api = window.octoAnnotate;
const canvas = document.getElementById('annotateCanvas');
const context = canvas.getContext('2d');
const baseCanvas = document.createElement('canvas');

let base = null;
let baseContext = baseCanvas.getContext('2d');
let shapes = [];
let drawing = null;
let tool = 'arrow';
let imageName = '';

function setTool(name) {
  tool = name;
  for (const button of document.querySelectorAll('[data-tool]')) {
    const active = button.dataset.tool === tool;
    button.classList.toggle('is-on', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function points(shape) {
  const x = Math.min(shape.x1, shape.x2);
  const y = Math.min(shape.y1, shape.y2);
  return { x, y, width: Math.abs(shape.x2 - shape.x1), height: Math.abs(shape.y2 - shape.y1) };
}

function drawShape(target, shape, source) {
  const block = points(shape);
  const scale = canvas.width / 900;

  if (shape.tool === 'blur') {
    if (block.width < 2 || block.height < 2) return;
    target.save();
    target.filter = `blur(${Math.max(6, Math.round(14 * scale))}px)`;
    target.drawImage(
      source,
      block.x,
      block.y,
      block.width,
      block.height,
      block.x,
      block.y,
      block.width,
      block.height,
    );
    target.filter = 'none';
    target.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    target.lineWidth = Math.max(1, Math.round(1.5 * scale));
    target.strokeRect(block.x, block.y, block.width, block.height);
    target.restore();
    return;
  }

  target.save();
  target.strokeStyle = '#ff3b30';
  target.fillStyle = '#ff3b30';
  target.lineWidth = Math.max(2, Math.round(3 * scale));
  target.lineCap = 'round';

  if (shape.tool === 'rect') {
    if (block.width < 2 || block.height < 2) return;
    target.strokeRect(block.x, block.y, block.width, block.height);
    target.restore();
    return;
  }

  const dx = shape.x2 - shape.x1;
  const dy = shape.y2 - shape.y1;
  const length = Math.hypot(dx, dy);
  if (length < 4) {
    target.restore();
    return;
  }

  target.beginPath();
  target.moveTo(shape.x1, shape.y1);
  target.lineTo(shape.x2, shape.y2);
  target.stroke();

  const angle = Math.atan2(dy, dx);
  const head = Math.max(10, Math.round(18 * scale));
  target.beginPath();
  target.moveTo(shape.x2, shape.y2);
  target.lineTo(
    shape.x2 - head * Math.cos(angle - Math.PI / 7),
    shape.y2 - head * Math.sin(angle - Math.PI / 7),
  );
  target.lineTo(
    shape.x2 - head * Math.cos(angle + Math.PI / 7),
    shape.y2 - head * Math.sin(angle + Math.PI / 7),
  );
  target.closePath();
  target.fill();
  target.restore();
}

function redraw() {
  if (!base) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(baseCanvas, 0, 0);
  for (const shape of shapes) drawShape(context, shape, baseCanvas);
  if (drawing) drawShape(context, drawing, baseCanvas);
}

function pointOf(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (!base) return;
  canvas.setPointerCapture?.(event.pointerId);
  const point = pointOf(event);
  drawing = { tool, x1: point.x, y1: point.y, x2: point.x, y2: point.y };
  redraw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drawing) return;
  const point = pointOf(event);
  drawing.x2 = point.x;
  drawing.y2 = point.y;
  redraw();
});

const finish = () => {
  if (!drawing) return;
  shapes.push(drawing);
  drawing = null;
  redraw();
};

canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', finish);

for (const button of document.querySelectorAll('[data-tool]')) {
  button.addEventListener('click', () => setTool(button.dataset.tool));
}

document.getElementById('btnUndo').addEventListener('click', () => {
  shapes.pop();
  redraw();
});

document.getElementById('btnClear').addEventListener('click', () => {
  shapes = [];
  redraw();
});

document.getElementById('btnSave').addEventListener('click', () => {
  if (!base) return;
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const target = output.getContext('2d');
  target.drawImage(baseCanvas, 0, 0);
  for (const shape of shapes) drawShape(target, shape, baseCanvas);
  api.save(output.toDataURL('image/png'), imageName);
});

document.getElementById('btnClose').addEventListener('click', () => api.close());

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    api.close();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    shapes.pop();
    redraw();
  }
});

api.onImage((image) => {
  if (!image || typeof image.dataUrl !== 'string') return;
  imageName = typeof image.name === 'string' ? image.name : '';

  const picture = new window.Image();
  picture.onload = () => {
    base = picture;
    canvas.width = picture.naturalWidth;
    canvas.height = picture.naturalHeight;
    baseCanvas.width = picture.naturalWidth;
    baseCanvas.height = picture.naturalHeight;
    baseContext = baseCanvas.getContext('2d');
    baseContext.drawImage(picture, 0, 0);
    redraw();
  };
  picture.src = image.dataUrl;
});

setTool('arrow');
