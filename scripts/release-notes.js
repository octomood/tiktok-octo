'use strict';

/**
 * Заметки к релизу из CHANGELOG.md.
 *
 * Использование:
 *   node scripts/release-notes.js            # версия из package.json
 *   node scripts/release-notes.js v0.5.1     # версия или тег
 *
 * Скрипт печатает markdown-раздел этой версии без заголовка «## 0.5.1»,
 * чтобы его можно было отдать в `gh release edit --notes-file`.
 * Вызывается из release workflow, но годится и руками.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

function versionFromPackage() {
  return require(path.join(ROOT, 'package.json')).version;
}

/**
 * Склеивает мягкие переносы внутри абзацев и пунктов списка: GitHub Releases
 * рендерит одиночный `\n` как жёсткий `<br>`, поэтому 80-колоночная разметка
 * из CHANGELOG.md обрывается на каждой строке.
 */
function unwrap(section) {
  const out = [];
  let buffer = '';
  let inFence = false;

  const flush = () => {
    if (!buffer) return;
    out.push(buffer);
    buffer = '';
  };

  for (const rawLine of section.split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      flush();
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flush();
      out.push('');
      continue;
    }

    if (/^(#{1,6}\s|>\s?|[-*_]{3,}$|\|)/.test(trimmed)) {
      flush();
      out.push(line);
      continue;
    }

    if (/^(\s*[-*+]\s|\s*\d+\.\s)/.test(line)) {
      flush();
      buffer = line;
      continue;
    }

    buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
  }

  flush();
  return out.join('\n').trim();
}

function extract(version, source) {
  const lines = source.split('\n');
  const heading = `## ${version}`;
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }

  return unwrap(lines.slice(start + 1, end).join('\n'));
}

function main() {
  const raw = process.argv[2] || versionFromPackage();
  const version = raw.replace(/^v/, '');
  const text = fs.readFileSync(CHANGELOG, 'utf8');
  const section = extract(version, text);

  if (!section) {
    console.error(`В CHANGELOG.md нет раздела «## ${version}»`);
    process.exit(1);
  }

  process.stdout.write(`${section}\n`);
}

if (require.main === module) main();

module.exports = { extract, unwrap };
