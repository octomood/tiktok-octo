'use strict';

/**
 * Запуск Playwright-тестов так, чтобы они не мешали работе пользователя.
 *
 * Тесты поднимают настоящий Electron, а он на Linux с живым `DISPLAY`
 * открывает окна поверх других приложений. Поэтому на Linux тесты
 * перезапускаются через `xvfb-run`: окна рисуются в виртуальном дисплее и
 * никто их не видит. На macOS и Windows окно тоже нужно, но оно поднимается
 * в отдельной сессии пользователя — там запускаем напрямую.
 *
 * `OCTO_TEST_XVFB=1` ставит сам `xvfb-run`, чтобы не оборачивать рекурсивно.
 * `OCTO_TEST_WINDOW=1` оставляет настоящее окно: нужно, когда пользователь
 * просит посмотреть на тест глазами.
 */

const { spawnSync } = require('node:child_process');

const cli = require.resolve('@playwright/test/cli');
// `@playwright/test/cli` — общий CLI Playwright, подкоманду `test` передаём явно.
const args = ['test', ...process.argv.slice(2)];

function run(command, commandArgs, env) {
  return spawnSync(command, commandArgs, { stdio: 'inherit', env });
}

/**
 * Chromium выбирает Wayland по `WAYLAND_DISPLAY`, даже когда `DISPLAY` указывает
 * на Xvfb: тогда окна тестов уезжают на рабочий стол пользователя. Переменную
 * убираем, чтобы Electron остался на виртуальном X11.
 */
function headlessEnv() {
  const env = { ...process.env, OCTO_TEST_XVFB: '1' };
  delete env.WAYLAND_DISPLAY;
  env.XDG_SESSION_TYPE = 'x11';
  env.ELECTRON_OZONE_PLATFORM_HINT = 'x11';
  return env;
}

const wrapped = process.env.OCTO_TEST_XVFB === '1';
const wantXvfb = process.platform === 'linux' && !wrapped && !process.env.OCTO_TEST_WINDOW;
let result;

if (wantXvfb) {
  // 1280×1024 как у типичного рабочего стола: на дефолтных 640×480
  // адаптивный PiP упирается в минимальную ширину окна.
  result = run(
    'xvfb-run',
    ['-a', '-s', '-screen 0 1280x1024x24', process.execPath, cli, ...args],
    headlessEnv(),
  );

  // xvfb-run нет — не роняем тесты, но честно предупреждаем про окна.
  if (result.error && result.error.code === 'ENOENT') {
    console.warn('[octo] xvfb-run не найден: тесты откроют окна на рабочем столе.');
    result = run(process.execPath, [cli, ...args], process.env);
  }
} else {
  result = run(process.execPath, [cli, ...args], process.env);
}

process.exitCode = result.status ?? 1;
