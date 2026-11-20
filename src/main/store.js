'use strict';

const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const FILE = 'octo-state.json';

function statePath() {
  return path.join(app.getPath('userData'), FILE);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(patch) {
  try {
    const next = { ...readState(), ...patch };
    const file = statePath();
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    // В состоянии лежит адрес прокси с паролем: файл — только для владельца.
    fs.writeFileSync(file, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      /* Windows и файловые системы без прав доступа */
    }
  } catch {
    /* состояние — не критично, молча игнорируем */
  }
}

/** Полная замена состояния: нужна восстановлению резервной копии. */
function replaceState(value) {
  const next = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const file = statePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* Windows и файловые системы без прав доступа */
  }
}

module.exports = { readState, writeState, replaceState, statePath };
