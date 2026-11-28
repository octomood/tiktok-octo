'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  validateManifest,
  compareVersions,
  isSafeRelativePath,
} = require('../src/main/plugins/manifest');
const { scanFiles } = require('../src/main/plugins/security');
const { createZip } = require('../src/main/plugins/zip');
const {
  sha256,
  signPayload,
  createSignatureManifest,
  SIGNATURE_FILE,
  SIGNATURE_FILES,
} = require('../src/main/plugins/signature');
const { TRUSTED_KEYS, keyId } = require('../src/main/plugins/plugin-trust');

/**
 * Упаковка плагина в .octoplugin.
 *
 *   node scripts/pack-plugin.js plugins/examples/hello-octo \
 *     --out plugins/packages \
 *     --update-registry plugins/registry.json
 *
 * Пакет детерминирован: фиксированная дата внутри ZIP и сортировка файлов,
 * поэтому SHA-256 не меняется от перепаковки. Подпись — Ed25519, ключ берётся
 * из --key или OCTO_PLUGIN_SIGNING_KEY: путь к PEM или сам PEM (так его отдаёт
 * секрет GitHub Actions). --require-signature запрещает сборку без ключа.
 */

function usage(message) {
  if (message) console.error(`\n${message}\n`);
  console.error(
    [
      'Использование:',
      '  node scripts/pack-plugin.js <папка-плагина> [--out <папка>]',
      '    [--base-url <url>] [--update-registry <registry.json>] [--key <private.pem>]',
      '    [--require-signature]',
      '',
      'Пример:',
      '  node scripts/pack-plugin.js plugins/examples/hello-octo --out plugins/packages',
    ].join('\n'),
  );
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const result = {
    source: '',
    out: 'plugins/packages',
    baseUrl: '',
    registry: '',
    key: '',
    requireSignature: false,
  };
  const rest = [...argv];
  while (rest.length) {
    const item = rest.shift();
    if (item === '--help' || item === '-h') usage();
    if (item === '--out') result.out = rest.shift() || result.out;
    else if (item === '--base-url') result.baseUrl = rest.shift() || '';
    else if (item === '--update-registry') result.registry = rest.shift() || '';
    else if (item === '--key') result.key = rest.shift() || '';
    else if (item === '--require-signature') result.requireSignature = true;
    else if (item.startsWith('-')) usage(`Неизвестный аргумент: ${item}`);
    else if (!result.source) result.source = item;
    else usage(`Лишний аргумент: ${item}`);
  }
  if (!result.source) usage('Не указана папка плагина');
  result.baseUrl =
    result.baseUrl ||
    process.env.OCTO_PLUGIN_BASE_URL ||
    'https://raw.githubusercontent.com/octomood/tiktok-octo/main/plugins/packages';
  return result;
}

function readTree(root, prefix = '', files = new Map(), state = { total: 0 }) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
      continue;
    }
    if (entry.name.endsWith('.octoplugin') || entry.name.endsWith('.zip')) continue;
    if (SIGNATURE_FILES.includes(entry.name) && !prefix) continue;

    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!isSafeRelativePath(relative)) throw new Error(`Недопустимый путь: ${relative}`);
    const absolute = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Символические ссылки запрещены');
    if (entry.isDirectory()) {
      readTree(absolute, relative, files, state);
      continue;
    }
    if (!entry.isFile()) continue;

    const data = fs.readFileSync(absolute);
    state.total += data.length;
    if (state.total > 24 * 1024 * 1024) throw new Error('Плагин больше 24 МБ');
    files.set(relative, data);
  }
  return files;
}

function readRegistry(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || raw.schema !== 1 || !Array.isArray(raw.plugins)) {
      return { schema: 1, updatedAt: new Date().toISOString(), plugins: [] };
    }
    return raw;
  } catch {
    return { schema: 1, updatedAt: new Date().toISOString(), plugins: [] };
  }
}

function updateRegistry(file, manifest, release) {
  const registry = readRegistry(file);
  const existing = registry.plugins.find((plugin) => plugin.id === manifest.id);

  const metadata = {
    id: manifest.id,
    name: manifest.name,
    author: manifest.author,
    description: manifest.description,
    homepage: manifest.homepage,
    source: manifest.source,
    license: manifest.license,
    categories: manifest.categories,
  };

  if (existing) {
    Object.assign(existing, metadata);
    existing.releases = Array.isArray(existing.releases) ? existing.releases : [];
    existing.releases = existing.releases.filter((item) => item.version !== release.version);
    existing.releases.push(release);
    existing.releases.sort((left, right) => compareVersions(right.version, left.version));
  } else {
    registry.plugins.push({ ...metadata, releases: [release] });
  }

  registry.plugins.sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  registry.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`);
}

/** Путь к PEM или сам PEM; переносы строк в секрете могут прийти как литерал \n. */
function readSigningKey(value) {
  const text = String(value || '').trim();
  if (text.includes('-----BEGIN')) return `${text.replace(/\\n/g, '\n')}\n`;
  return fs.readFileSync(path.resolve(text), 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = path.resolve(args.source);
  if (!fs.existsSync(path.join(source, 'plugin.json'))) {
    usage(`В ${source} нет plugin.json`);
  }

  const files = readTree(source);
  if (!files.has('plugin.json')) usage('plugin.json не попал в пакет');

  let raw;
  try {
    raw = JSON.parse(files.get('plugin.json').toString('utf8'));
  } catch {
    usage('plugin.json — некорректный JSON');
  }

  const validation = validateManifest(raw);
  if (!validation.ok) {
    console.error('Манифест не прошёл проверку:');
    for (const error of validation.errors) console.error(`  • ${error}`);
    process.exit(1);
  }
  const manifest = validation.manifest;
  if (!files.has(manifest.main)) {
    console.error(`Нет точки входа «${manifest.main}»`);
    process.exit(1);
  }
  if (files.get(manifest.main).length > 2 * 1024 * 1024) {
    console.error('Точка входа больше 2 МБ');
    process.exit(1);
  }

  const report = scanFiles(files, manifest);
  if (report.verdict === 'blocked') {
    console.error('Статическая проверка запретила публикацию:');
    for (const finding of report.findings.filter((item) => item.severity === 'block')) {
      console.error(`  • ${finding.file}:${finding.line} — ${finding.message}`);
    }
    process.exit(1);
  }
  if (report.verdict === 'review') {
    console.warn('Предупреждения статической проверки:');
    for (const finding of report.findings.filter((item) => item.severity === 'warn')) {
      console.warn(`  • ${finding.file}:${finding.line} — ${finding.message}`);
    }
  }

  const keySource = args.key || process.env.OCTO_PLUGIN_SIGNING_KEY || '';
  let signature = '';
  let privateKey = '';
  let signer = '';
  if (!keySource && args.requireSignature) {
    console.error('Нет ключа подписи: задайте OCTO_PLUGIN_SIGNING_KEY или --key');
    process.exit(1);
  }
  if (keySource) {
    privateKey = readSigningKey(keySource);
    signer = keyId(privateKey);
    if (!signer) {
      console.error('OCTO_PLUGIN_SIGNING_KEY — не приватный ключ Ed25519');
      process.exit(1);
    }
    files.set(
      SIGNATURE_FILE,
      Buffer.from(
        createSignatureManifest(privateKey, {
          id: manifest.id,
          version: manifest.version,
          files,
        }),
        'utf8',
      ),
    );
  }

  const zip = createZip(files);
  const hash = sha256(zip);
  const fileName = `${manifest.id}-${manifest.version}.octoplugin`;
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const output = path.join(outDir, fileName);
  fs.writeFileSync(output, zip);

  if (privateKey) {
    signature = signPayload(privateKey, {
      id: manifest.id,
      version: manifest.version,
      sha256: hash,
    });
  }

  const release = {
    version: manifest.version,
    minAppVersion: manifest.minAppVersion,
    download: `${args.baseUrl.replace(/\/$/, '')}/${encodeURIComponent(fileName)}`,
    sha256: hash,
    ...(signature ? { signature } : {}),
    size: zip.length,
    publishedAt: new Date().toISOString(),
    changelog: manifest.changelog,
    permissions: manifest.permissions,
    networkHosts: manifest.networkHosts,
  };

  if (args.registry) updateRegistry(args.registry, manifest, release);

  console.log(`\nПакет: ${output}`);
  console.log(`Размер: ${(zip.length / 1024).toFixed(1)} КБ`);
  console.log(`SHA-256: ${hash}`);
  console.log(
    `Подпись: ${signature ? `есть, ключ ${signer}` : 'нет (OCTO_PLUGIN_SIGNING_KEY не задан)'}`,
  );
  if (signer && !TRUSTED_KEYS.some((item) => item.id === signer)) {
    console.warn(
      `Ключ ${signer} не лежит в src/main/plugins/trusted-keys/: приложение покажет пакет ` +
        'как неподписанный. Добавьте публичный ключ: node scripts/plugin-keygen.js --trust',
    );
  }
  if (report.verdict === 'review') console.log(`Предупреждений проверки: ${report.warnings}`);
  console.log('\nЗапись для registry.json:\n');
  console.log(JSON.stringify(release, null, 2));
  if (args.registry) console.log(`\nКаталог обновлён: ${path.resolve(args.registry)}`);
}

main();
