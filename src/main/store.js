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
    fs.mkdirSync(path.dirname(statePath()), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(next, null, 2));
  } catch {
    /* состояние — не критично, молча игнорируем */
  }
}

module.exports = { readState, writeState, statePath };
