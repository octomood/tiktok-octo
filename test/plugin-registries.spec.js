'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Несколько каталогов: официальный (файл) и свой (локальный HTTP). Небезопасный
 * адрес отклоняется, плагины второго каталога видны и фильтруются по источнику.
 */

function release(version) {
  return {
    version,
    minAppVersion: '0.5.0',
    download: `https://example.test/plugin-${version}.octoplugin`,
    sha256: 'a'.repeat(64),
    size: 1024,
    publishedAt: '2026-01-01T00:00:00.000Z',
    permissions: ['page:css'],
    networkHosts: [],
  };
}

const PRIMARY = {
  schema: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  plugins: [
    {
      id: 'app.test.alpha',
      name: 'Alpha plugin',
      author: { name: 'octo' },
      description: 'Официальный каталог',
      license: 'MIT',
      releases: [release('1.0.0')],
    },
  ],
};

const EXTRA = {
  schema: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  plugins: [
    {
      id: 'app.test.extra',
      name: 'Extra plugin',
      author: { name: 'octo' },
      description: 'Свой каталог',
      license: 'MIT',
      releases: [release('2.0.0')],
    },
  ],
};

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('несколько каталогов: свой источник рядом с официальным', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-registries-'));
  const registryFile = path.join(userData, 'registry.json');
  fs.writeFileSync(registryFile, JSON.stringify(PRIMARY, null, 2));

  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(EXTRA));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const extraUrl = `http://127.0.0.1:${server.address().port}/registry.json`;

  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
        OCTO_PLUGIN_REGISTRY_FILE: registryFile,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/index.html'),
      'полоса заголовка',
    );
    await page.evaluate(() => window.octo.cmd('plugins'));
    const manager = await waitForWindow(
      app,
      (candidate) => candidate.url().endsWith('/renderer/plugins.html'),
      'менеджер плагинов',
    );

    // Небезопасный адрес второго каталога отклоняется.
    const rejected = await manager.evaluate(() =>
      window.octoPlugins.action('setSettings', {
        patch: { registryUrls: ['http://evil.example/registry.json'] },
      }),
    );
    expect(rejected.ok).toBe(false);

    const saved = await manager.evaluate(
      (url) => window.octoPlugins.action('setSettings', { patch: { registryUrls: [url] } }),
      extraUrl,
    );
    expect(saved.ok).toBe(true);

    await manager.locator('#btnRefresh').click();
    const cards = manager.locator('#catalogList .card');
    await expect(cards).toHaveCount(2, { timeout: 15000 });
    await expect(manager.locator('#catalogList')).toContainText('Extra plugin');

    // Фильтр источников: свой каталог и «все».
    const source = manager.locator('#catalogSource');
    await expect(source.locator(`option[value="127.0.0.1"]`)).toHaveCount(1);
    await source.selectOption('127.0.0.1');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Extra plugin');
    await source.selectOption('');
    await expect(cards).toHaveCount(2);

    const settings = JSON.parse(
      fs.readFileSync(path.join(userData, 'plugins-state.json'), 'utf8'),
    ).settings;
    expect(settings.registryUrls).toEqual([extraUrl]);
  } finally {
    if (app) await app.close();
    server.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
