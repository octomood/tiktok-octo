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

  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
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

module.exports = { extract };
